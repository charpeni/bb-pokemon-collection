import { defineRpcContract } from "@get-bb/plugin-sdk";
import { isAbsolute } from "node:path";
import { z } from "zod";

const absolutePathSchema = z.string().min(1).refine(isAbsolute, "Expected an absolute path");

const worktreeSchema = z
	.object({
		path: absolutePathSchema,
		branch: z.string().min(1).nullable(),
	})
	.strict();

const repositorySchema = z
	.object({
		root: absolutePathSchema,
		repoId: absolutePathSchema,
		branches: z.array(z.string().min(1)),
		worktrees: z.array(worktreeSchema),
	})
	.strict();

export const hostContract = defineRpcContract({
	scanGitRoots: {
		input: z.object({ roots: z.array(absolutePathSchema).max(1_000) }).strict(),
		output: z.object({ repositories: z.array(repositorySchema) }).strict(),
	},
});
