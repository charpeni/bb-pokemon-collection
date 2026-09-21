import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchEvolutionPath } from "./pokeapi";

afterEach(() => vi.unstubAllGlobals());

describe("fetchEvolutionPath", () => {
	it("maps level, item, and trade evolutions to token-aware requirements", async () => {
		vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
			const url = String(input);
			if (url.includes("pokemon-species")) return { ok: true, json: async () => ({ evolution_chain: { url: "https://pokeapi.co/api/v2/evolution-chain/1" } }) };
			return { ok: true, json: async () => ({
				chain: {
					species: { name: "test-base", url: "https://pokeapi.co/api/v2/pokemon-species/1/" }, evolution_details: [],
					evolves_to: [{
						species: { name: "test-level", url: "https://pokeapi.co/api/v2/pokemon-species/2/" },
						evolution_details: [{ min_level: 16, trigger: { name: "level-up" } }],
						evolves_to: [{
							species: { name: "test-item", url: "https://pokeapi.co/api/v2/pokemon-species/3/" },
							evolution_details: [{ min_level: null, trigger: { name: "use-item" }, item: { name: "coding-stone" } }],
							evolves_to: [{
								species: { name: "test-trade", url: "https://pokeapi.co/api/v2/pokemon-species/4/" },
								evolution_details: [{ min_level: null, trigger: { name: "trade" } }], evolves_to: [],
							}],
						}],
					}],
				},
			}) };
		}));

		const path = await fetchEvolutionPath(1);
		expect(path.map((stage) => stage.requirement)).toEqual([
			null,
			{ kind: "level", level: 16, method: "Reach level 16" },
			{ kind: "tokens", tokens: 500_000, method: "Use Coding Stone" },
			{ kind: "tokens", tokens: 1_000_000, method: "Trade" },
		]);
	});
});
