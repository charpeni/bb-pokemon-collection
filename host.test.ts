import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { experimental_createHostEntryHarness } from "@get-bb/plugin-sdk/testing/host";
import { describe, expect, it, vi } from "vitest";
import hostEntry from "./host";

vi.mock("@get-bb/plugin-sdk/host", async () => {
	const sdk = await import("@get-bb/plugin-sdk");
	return { experimental_defineHostEntry: sdk.experimental_defineHostEntry };
});

function git(cwd: string, ...args: string[]) {
	execFileSync("git", args, { cwd, stdio: "pipe" });
}

describe("Pokemon Catcher host entry", () => {
	it("returns a validated Git snapshot", async () => {
		const repo = mkdtempSync(join(tmpdir(), "pokemon-host-"));
		git(repo, "init", "-q", "-b", "main");
		git(repo, "config", "user.email", "host@example.invalid");
		git(repo, "config", "user.name", "Pokemon Host");
		git(repo, "commit", "--allow-empty", "-qm", "initial");

		const harness = experimental_createHostEntryHarness(hostEntry);
		const result = await harness.experimental_call("scanGitRoots", { roots: [repo] });

		expect(result.repositories).toEqual([
			expect.objectContaining({
				root: repo,
				branches: ["main"],
				worktrees: [{ path: repo, branch: "main" }],
			}),
		]);
		await harness.experimental_dispose();
	});

	it("rejects relative roots at the RPC boundary", async () => {
		const harness = experimental_createHostEntryHarness(hostEntry);
		await expect(harness.experimental_call("scanGitRoots", { roots: ["relative"] })).rejects.toThrow(
			"absolute path",
		);
		await harness.experimental_dispose();
	});
});
