import { describe, expect, it } from "vitest";
import { generationForPokemon } from "./generation";

describe("generationForPokemon", () => {
	it.each([
		[1, 1], [151, 1], [152, 2], [251, 2], [252, 3], [386, 3],
		[387, 4], [493, 4], [494, 5], [649, 5], [650, 6], [721, 6],
		[722, 7], [809, 7], [810, 8], [905, 8], [906, 9], [1025, 9],
	])("maps National Pokedex #%i to generation %i", (number, generation) => {
		expect(generationForPokemon(number)).toBe(generation);
	});

	it("rejects numbers outside the supported National Pokedex", () => {
		expect(() => generationForPokemon(0)).toThrow();
		expect(() => generationForPokemon(1026)).toThrow();
	});
});
