import { execFile } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitWorktreeSnapshot {
	path: string;
	branch: string | null;
}

export interface GitRepositorySnapshot {
	root: string;
	repoId: string;
	branches: string[];
	worktrees: GitWorktreeSnapshot[];
}

export type GitRepoSnapshot = GitRepositorySnapshot;
export type GitSnapshot = GitRepositorySnapshot[];

export type GitSnapshotEvent =
	| {
			kind: "branch_opened";
			root: string;
			branch: string;
	  }
	| {
			kind: "worktree_opened";
			root: string;
			path: string;
			branch: string | null;
	  }
	| {
			kind: "branch_checked_out";
			root: string;
			path: string;
			branch: string;
	  };

interface ScanOptions {
	signal?: AbortSignal;
}

async function runGit(root: string, args: string[], signal?: AbortSignal): Promise<string> {
	const { stdout } = await execFileAsync("git", ["-C", root, ...args], {
		encoding: "utf8",
		maxBuffer: 4 * 1024 * 1024,
		signal,
	});
	return stdout;
}

interface ValidatedRoot {
	path: string;
	canonicalPath: string;
}

async function validateRoot(root: string): Promise<ValidatedRoot> {
	if (!isAbsolute(root)) {
		throw new Error(`Git scan root must be an absolute path: ${root}`);
	}

	const canonicalRoot = await realpath(root);
	if (!(await stat(canonicalRoot)).isDirectory()) {
		throw new Error(`Git scan root must be a directory: ${root}`);
	}
	return { path: root, canonicalPath: canonicalRoot };
}

function parseBranches(output: string): string[] {
	return output
		.split("\0")
		.map((branch) => branch.trim())
		.filter((branch) => branch.length > 0)
		.sort((left, right) => left.localeCompare(right));
}

function parseWorktrees(output: string, root: ValidatedRoot): GitWorktreeSnapshot[] {
	const worktrees: GitWorktreeSnapshot[] = [];
	for (const record of output.split("\0\0")) {
		let path: string | undefined;
		let branch: string | null = null;
		for (const field of record.split("\0")) {
			if (field.startsWith("worktree ")) path = field.slice("worktree ".length);
			if (field.startsWith("branch refs/heads/")) {
				branch = field.slice("branch refs/heads/".length);
			}
		}
		if (path !== undefined) {
			const displayPath = resolve(
				dirname(root.path),
				relative(dirname(root.canonicalPath), path),
			);
			worktrees.push({ path: displayPath, branch });
		}
	}
	return worktrees.sort((left, right) => left.path.localeCompare(right.path));
}

async function scanRepository(root: ValidatedRoot, signal?: AbortSignal): Promise<GitRepositorySnapshot | null> {
	let commonDir: string;
	try {
		commonDir = (
			await runGit(root.path, ["rev-parse", "--path-format=absolute", "--git-common-dir"], signal)
		).trim();
	} catch (error) {
		if (signal?.aborted) throw error;
		return null;
	}

	const [branchOutput, worktreeOutput] = await Promise.all([
		runGit(root.path, ["for-each-ref", "--format=%(refname:short)%00", "refs/heads"], signal),
		runGit(root.path, ["worktree", "list", "--porcelain", "-z"], signal),
	]);
	const worktrees = parseWorktrees(worktreeOutput, root);

	return {
		root: worktrees[0]?.path ?? root.path,
		repoId: commonDir,
		branches: parseBranches(branchOutput),
		worktrees,
	};
}

export async function scanGitRoots(roots: readonly string[], options: ScanOptions = {}): Promise<GitSnapshot> {
	const validationResults = await Promise.allSettled(
		[...new Set(roots)].sort((left, right) => left.localeCompare(right)).map(validateRoot),
	);
	const validatedRoots = validationResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
	const repositories = await Promise.all(
		validatedRoots
			.filter(
				(root, index) =>
					validatedRoots.findIndex((candidate) => candidate.canonicalPath === root.canonicalPath) === index,
			)
			.map((root) => scanRepository(root, options.signal)),
	);

	const byCommonDir = new Map<string, GitRepositorySnapshot>();
	for (const repository of repositories) {
		if (repository !== null && !byCommonDir.has(repository.repoId)) {
			byCommonDir.set(repository.repoId, repository);
		}
	}
	return [...byCommonDir.values()].sort((left, right) => left.repoId.localeCompare(right.repoId));
}

export function diffGitSnapshots(previous: GitSnapshot, current: GitSnapshot): GitSnapshotEvent[] {
	if (previous.length === 0) return [];

	const previousByCommonDir = new Map(previous.map((repository) => [repository.repoId, repository]));
	const events: GitSnapshotEvent[] = [];

	for (const repository of current) {
		const before = previousByCommonDir.get(repository.repoId);
		if (before === undefined) continue;

		const previousBranches = new Set(before.branches);
		for (const branch of repository.branches) {
			if (!previousBranches.has(branch)) {
				events.push({ kind: "branch_opened", root: repository.root, branch });
			}
		}

		const previousWorktrees = new Map(before.worktrees.map((worktree) => [worktree.path, worktree]));
		for (const worktree of repository.worktrees) {
			const previousWorktree = previousWorktrees.get(worktree.path);
			if (previousWorktree === undefined) {
				events.push({
					kind: "worktree_opened",
					root: repository.root,
					path: worktree.path,
					branch: worktree.branch,
				});
		} else if (worktree.branch !== null && previousBranches.has(worktree.branch) && worktree.branch !== previousWorktree.branch) {
				events.push({
					kind: "branch_checked_out",
					root: repository.root,
					path: worktree.path,
					branch: worktree.branch,
				});
			}
		}
	}

	return events;
}
