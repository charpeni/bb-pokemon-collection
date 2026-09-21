export const pokemonGenerations = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export type PokemonGeneration = (typeof pokemonGenerations)[number];

const generationEndNumbers: ReadonlyArray<readonly [PokemonGeneration, number]> = [
	[1, 151],
	[2, 251],
	[3, 386],
	[4, 493],
	[5, 649],
	[6, 721],
	[7, 809],
	[8, 905],
	[9, 1025],
];

export function generationForPokemon(number: number): PokemonGeneration {
	const generation = generationEndNumbers.find(([, finalNumber]) => number <= finalNumber)?.[0];
	if (generation === undefined || number < 1) throw new Error(`Unsupported National Pokedex number: ${number}`);
	return generation;
}
