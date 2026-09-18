import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakePluginHost, makeThreadResponse } from "@get-bb/plugin-sdk/testing";
import plugin, { chooseFallbackPokemonNumber, rarityForEncounterChance } from "./server";

afterEach(() => vi.unstubAllGlobals());

describe("Pokemon Catcher server", () => {
	it("preserves National Pokedex fallback selection and encounter rarity thresholds", () => {
		const numbers = Array.from({ length: 256 }, (_, index) => chooseFallbackPokemonNumber(`milestone-${index}`));
		expect(Math.max(...numbers)).toBeGreaterThan(900);
		expect(numbers.every((number) => number >= 1 && number <= 1025)).toBe(true);
		expect([rarityForEncounterChance(30), rarityForEncounterChance(15), rarityForEncounterChance(5)]).toEqual([
			"common", "uncommon", "rare",
		]);
	});

	it("persists fetched National Pokedex identity and encounter metadata", async () => {
		vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
			const url = String(input);
			if (url.endsWith("/encounters")) return { ok: true, json: async () => [{
				location_area: { name: "test-grove-area" },
				version_details: [{ version: { name: "platinum" }, encounter_details: [{ chance: 15, min_level: 8, max_level: 10, method: { name: "walk" } }] }],
			}] };
			if (url.includes("pokemon-species")) return { ok: true, json: async () => ({ hatch_counter: 20, is_legendary: false, is_mythical: false, flavor_text_entries: [] }) };
			return { ok: true, json: async () => ({ name: "testmon", height: 12, weight: 34, types: [{ type: { name: "grass" } }] }) };
		}));
		const { bb, harness } = createFakePluginHost({ pluginId: "pokemon-catcher", hasHostEntry: true, agentSkillIds: ["pokemon-catcher"] });
		await plugin(bb);
		await harness.behavior.callAgentTool("pokemon_record_milestone", {
			milestone: "commit_created", source: "git", reference: "national-dex", title: "National encounter",
		});
		const result = await harness.behavior.callRpc("collection_get", null) as { captures: Array<Record<string, unknown>> };
		expect(result.captures[0]).toMatchObject({
			pokemonId: "testmon", pokemonName: "Testmon", rarity: "uncommon",
			encounterLocation: "Test Grove", encounterVersion: "Platinum", encounterMethod: "Walk",
		});
		await harness.lifecycle.dispose();
	});

	it("restores demo rewards, token progression, egg incubation, evolution, and reset", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
		let totalTokens = 10_000;
		let lastTokens = 10_000;
		const { bb, harness } = createFakePluginHost({
			pluginId: "pokemon-catcher",
			hasHostEntry: true,
			agentSkillIds: ["pokemon-catcher"],
			sdk: {
				threads: {
					events: {
						list: async () => [{
							id: "evt_tokens",
							threadId: "thr_tokens",
							seq: 1,
							createdAt: 1,
							scope: { kind: "thread" as const },
							type: "thread/tokenUsage/updated" as const,
							data: {
								tokenUsage: {
									last: { cachedInputTokens: 0, inputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0, totalTokens: lastTokens },
									total: { cachedInputTokens: 0, inputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0, totalTokens },
									modelContextWindow: null,
								},
							},
						}],
					},
				},
			},
		});
		await plugin(bb);
		await harness.behavior.callRpc("starter_select", { starterId: "fennekin" });
		await harness.behavior.callRpc("demo_reward_add", { kind: "egg" });
		await harness.behavior.callRpc("demo_reward_add", { kind: "shiny" });

		await harness.behavior.emitThreadEvent("experimental_thread.events", {
			thread: makeThreadResponse({ id: "thr_tokens" }),
			sequence: 1,
		});
		await vi.waitFor(async () => {
			const next = await harness.behavior.callRpc("collection_get", null) as { companion: { totalTokens: number }; captures: Array<{ isEgg: boolean; eggSteps: number; isShiny: boolean }> };
			expect(next.companion.totalTokens).toBe(10_000);
			expect(next.captures.find((capture) => capture.isEgg)?.eggSteps).toBe(100);
			expect(next.captures.some((capture) => capture.isShiny)).toBe(true);
		});

		const evolutionTokens = (16 ** 3 - 5 ** 3) * 5_000;
		lastTokens = evolutionTokens;
		totalTokens += evolutionTokens;
		await harness.behavior.emitThreadEvent("experimental_thread.events", {
			thread: makeThreadResponse({ id: "thr_tokens" }),
			sequence: 2,
		});
		await vi.waitFor(async () => {
			const next = await harness.behavior.callRpc("collection_get", null) as { companion: { pokemonName: string; level: number } };
			expect(next.companion).toMatchObject({ pokemonName: "Braixen", level: 16 });
		});

		const reset = await harness.behavior.callRpc("collection_reset", null) as { starter: string | null; captures: unknown[]; companion: unknown };
		expect(reset).toMatchObject({ starter: null, captures: [], companion: null });
		await harness.lifecycle.dispose();
	});

	it("records concurrent reports of one milestone only once", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
		const { bb, harness } = createFakePluginHost({
			pluginId: "pokemon-catcher",
			hasHostEntry: true,
			agentSkillIds: ["pokemon-catcher"],
		});
		await plugin(bb);
		const milestone = {
			milestone: "commit_created" as const,
			source: "Git",
			reference: "abc123",
			title: "Concurrent milestone",
		};

		await Promise.all([
			harness.behavior.callAgentTool("pokemon_record_milestone", milestone),
			harness.behavior.callAgentTool("pokemon_record_milestone", milestone),
		]);

		expect((await harness.behavior.callRpc("collection_get", null) as { totalCaptures: number }).totalCaptures).toBe(1);
		await harness.lifecycle.dispose();
	});

	it("baselines Git state, then rewards a newly detected terminal branch once", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
		let scan = 0;
		const { bb, harness } = createFakePluginHost({
			pluginId: "pokemon-catcher",
			hasHostEntry: true,
			agentSkillIds: ["pokemon-catcher"],
			sdk: {
				projects: {
					list: async () => [{
						id: "proj_1", kind: "standard", name: "Repo", gitRemoteUrl: null,
						createdAt: 1, updatedAt: 1,
						sources: [{ id: "src_1", projectId: "proj_1", hostId: "host_1", type: "local_path", path: "/repo", isDefault: true, createdAt: 1, updatedAt: 1 }],
					}],
				},
				environments: { list: async () => [] },
			},
			experimental_callHostRpc: async () => ({
				repositories: [{
					root: "/repo", repoId: "/repo/.git",
					branches: scan++ === 0 ? ["main"] : ["feature/from-terminal", "main"],
					worktrees: [{ path: "/repo", branch: "main" }],
				}],
			}),
		});
		await plugin(bb);

		await harness.behavior.emitThreadEvent("thread.active", { thread: makeThreadResponse({ id: "thr_1" }) });
		await vi.waitFor(() => expect(scan).toBe(1));
		expect((await harness.behavior.callRpc("collection_get", null) as { totalCaptures: number }).totalCaptures).toBe(0);

		await harness.behavior.emitThreadEvent("thread.active", { thread: makeThreadResponse({ id: "thr_1" }) });
		await vi.waitFor(async () => expect((await harness.behavior.callRpc("collection_get", null) as { totalCaptures: number }).totalCaptures).toBe(1));

		await harness.behavior.emitThreadEvent("thread.active", { thread: makeThreadResponse({ id: "thr_1" }) });
		await vi.waitFor(() => expect(scan).toBe(3));
		expect((await harness.behavior.callRpc("collection_get", null) as { totalCaptures: number }).totalCaptures).toBe(1);
		await harness.lifecycle.dispose();
	});
});
