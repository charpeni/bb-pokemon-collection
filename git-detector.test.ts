import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { diffGitSnapshots, scanGitRoots } from "./git-detector";

function git(cwd: string, ...args: string[]) {
	execFileSync("git", args, { cwd, stdio: "pipe" });
}

describe("Git milestone detection", () => {
	it("baselines repositories discovered after scanning begins", async () => {
		const firstRepo = mkdtempSync(join(tmpdir(), "pokemon-git-first-"));
		const laterRepo = mkdtempSync(join(tmpdir(), "pokemon-git-later-"));
		for (const repo of [firstRepo, laterRepo]) {
			git(repo, "init", "-q");
			git(repo, "config", "user.email", "repro@example.invalid");
			git(repo, "config", "user.name", "Pokemon Repro");
			git(repo, "commit", "--allow-empty", "-qm", "initial");
		}

		const before = await scanGitRoots([firstRepo]);
		const after = await scanGitRoots([laterRepo, firstRepo, firstRepo]);

		expect(diffGitSnapshots(before, after)).toEqual([]);
		expect(after.map((repository) => repository.repoId)).toEqual(
			[...after.map((repository) => repository.repoId)].sort(),
		);
	});

	it("detects terminal branches and worktrees once without rewarding the baseline", async () => {
		const repo = mkdtempSync(join(tmpdir(), "pokemon-git-detector-"));
		git(repo, "init", "-q");
		git(repo, "config", "user.email", "repro@example.invalid");
		git(repo, "config", "user.name", "Pokemon Repro");
		git(repo, "commit", "--allow-empty", "-qm", "initial");

		const baseline = await scanGitRoots([repo]);
		expect(diffGitSnapshots([], baseline)).toEqual([]);

		git(repo, "branch", "feature/terminal-branch");
		const afterBranch = await scanGitRoots([repo]);
		expect(diffGitSnapshots(baseline, afterBranch)).toEqual([
			expect.objectContaining({
				kind: "branch_opened",
				branch: "feature/terminal-branch",
			}),
		]);
		expect(diffGitSnapshots(afterBranch, afterBranch)).toEqual([]);

		git(repo, "switch", "-q", "feature/terminal-branch");
		const afterCheckout = await scanGitRoots([repo]);
		expect(diffGitSnapshots(afterBranch, afterCheckout)).toEqual([
			expect.objectContaining({
				kind: "branch_checked_out",
				branch: "feature/terminal-branch",
				path: repo,
			}),
		]);
		expect(diffGitSnapshots(afterCheckout, afterCheckout)).toEqual([]);

		const worktree = `${repo}-worktree`;
		git(repo, "worktree", "add", "-q", "-b", "feature/bb-worktree", worktree);
		const afterWorktree = await scanGitRoots([repo]);
		const events = diffGitSnapshots(afterCheckout, afterWorktree);
		expect(events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "branch_opened",
					branch: "feature/bb-worktree",
				}),
				expect.objectContaining({
					kind: "worktree_opened",
					branch: "feature/bb-worktree",
					path: worktree,
				}),
			]),
		);
		expect(diffGitSnapshots(afterWorktree, afterWorktree)).toEqual([]);
	});

	it("continues scanning when a configured root no longer exists", async () => {
		const repo = mkdtempSync(join(tmpdir(), "pokemon-git-valid-"));
		git(repo, "init", "-q", "-b", "main");
		git(repo, "config", "user.email", "repro@example.invalid");
		git(repo, "config", "user.name", "Pokemon Repro");
		git(repo, "commit", "--allow-empty", "-qm", "initial");

		const snapshot = await scanGitRoots([repo, `${repo}-removed`]);

		expect(snapshot).toHaveLength(1);
		expect(snapshot[0]?.root).toBe(repo);
	});

	it("rewards git switch -c as one new branch instead of a branch plus checkout", async () => {
		const repo = mkdtempSync(join(tmpdir(), "pokemon-git-switch-create-"));
		git(repo, "init", "-q", "-b", "main");
		git(repo, "config", "user.email", "repro@example.invalid");
		git(repo, "config", "user.name", "Pokemon Repro");
		git(repo, "commit", "--allow-empty", "-qm", "initial");
		const baseline = await scanGitRoots([repo]);

		git(repo, "switch", "-q", "-c", "feature/single-reward");
		const afterSwitch = await scanGitRoots([repo]);

		expect(diffGitSnapshots(baseline, afterSwitch)).toEqual([
			expect.objectContaining({ kind: "branch_opened", branch: "feature/single-reward" }),
		]);
	});
});
