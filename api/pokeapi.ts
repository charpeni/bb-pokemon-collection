import { createHash } from "node:crypto";
import { cryUrl } from "../pokemon";

export type PokemonCandidate = { id: string; name: string; number: number };

export type PokemonDetails = {
	id: string;
	name: string;
	height: number;
	weight: number;
	types: string[];
	flavorText: string | null;
	hatchCounter: number;
	isLegendary: boolean;
	isMythical: boolean;
	cryUrl: string;
};

export type PokemonEncounter = {
	location: string;
	version: string;
	method: string;
	chance: number;
	level: number;
};

export type EvolutionRequirement =
	| { kind: "level"; level: number; method: string }
	| { kind: "tokens"; tokens: number; method: string };

export type EvolutionStage = PokemonCandidate & { requirement: EvolutionRequirement | null };

const ITEM_EVOLUTION_TOKENS = 500_000;
const TRADE_EVOLUTION_TOKENS = 1_000_000;
const SPECIAL_EVOLUTION_TOKENS = 750_000;

function formatPokemonName(name: string) {
	return name.split("-").map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
}

function numberFromUrl(url: string) {
	const match = url.match(/\/(\d+)\/?$/u);
	return match === null ? null : Number(match[1]);
}

type EvolutionChainNode = {
	species: { name: string; url: string };
	evolution_details: Array<{
		min_level?: number | null;
		trigger?: { name?: string };
		item?: { name?: string } | null;
		held_item?: { name?: string } | null;
	}>;
	evolves_to: EvolutionChainNode[];
};

function evolutionRequirement(node: EvolutionChainNode): EvolutionRequirement {
	const details = node.evolution_details[0];
	if (details?.min_level != null) return { kind: "level", level: details.min_level, method: `Reach level ${details.min_level}` };
	const item = details?.item?.name ?? details?.held_item?.name;
	if (item !== undefined) return { kind: "tokens", tokens: ITEM_EVOLUTION_TOKENS, method: `Use ${formatPokemonName(item)}` };
	if (details?.trigger?.name === "trade") return { kind: "tokens", tokens: TRADE_EVOLUTION_TOKENS, method: "Trade" };
	return { kind: "tokens", tokens: SPECIAL_EVOLUTION_TOKENS, method: "Complete a special evolution" };
}

function pathFrom(node: EvolutionChainNode, pokemonNumber: number): EvolutionStage[] | null {
	const number = numberFromUrl(node.species.url);
	if (number === pokemonNumber) {
		const path: EvolutionStage[] = [{ id: node.species.name, name: formatPokemonName(node.species.name), number, requirement: null }];
		let current = node;
		while (current.evolves_to[0] !== undefined) {
			current = current.evolves_to[0];
			const nextNumber = numberFromUrl(current.species.url);
			if (nextNumber === null) break;
			path.push({ id: current.species.name, name: formatPokemonName(current.species.name), number: nextNumber, requirement: evolutionRequirement(current) });
		}
		return path;
	}
	for (const child of node.evolves_to) {
		const path = pathFrom(child, pokemonNumber);
		if (path !== null) return path;
	}
	return null;
}

export async function fetchEvolutionPath(pokemonNumber: number): Promise<EvolutionStage[]> {
	try {
		const speciesResponse = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonNumber}`, { signal: AbortSignal.timeout(5000) });
		if (!speciesResponse.ok) return [];
		const species = await speciesResponse.json() as { evolution_chain?: { url?: string } };
		if (species.evolution_chain?.url === undefined) return [];
		const chainResponse = await fetch(species.evolution_chain.url, { signal: AbortSignal.timeout(5000) });
		if (!chainResponse.ok) return [];
		const chain = await chainResponse.json() as { chain?: EvolutionChainNode };
		return chain.chain === undefined ? [] : pathFrom(chain.chain, pokemonNumber) ?? [];
	} catch {
		return [];
	}
}

export async function fetchPokemonDetails(candidate: PokemonCandidate): Promise<PokemonDetails> {
	let height = 0;
	let weight = 0;
	let types: string[] = [];
	let flavorText: string | null = null;
	let hatchCounter = 0;
	let isLegendary = false;
	let isMythical = false;
	let id = candidate.id;
	let name = candidate.name;
	let resolvedCryUrl = cryUrl(candidate.number);

	try {
		const [pokemonResponse, speciesResponse] = await Promise.all([
			fetch(`https://pokeapi.co/api/v2/pokemon/${candidate.number}`, { signal: AbortSignal.timeout(5000) }),
			fetch(`https://pokeapi.co/api/v2/pokemon-species/${candidate.number}`, { signal: AbortSignal.timeout(5000) }),
		]);
		if (pokemonResponse.ok) {
			const data = await pokemonResponse.json() as { name?: string; height?: number; weight?: number; types?: Array<{ type?: { name?: string } }>; cries?: { latest?: string; legacy?: string } };
			id = data.name ?? candidate.id;
			name = data.name === undefined ? candidate.name : formatPokemonName(data.name);
			height = data.height ?? 0;
			weight = data.weight ?? 0;
			types = data.types?.flatMap((entry) => entry.type?.name === undefined ? [] : [entry.type.name]) ?? [];
			resolvedCryUrl = data.cries?.latest ?? data.cries?.legacy ?? resolvedCryUrl;
		}
		if (speciesResponse.ok) {
			const data = await speciesResponse.json() as { hatch_counter?: number; is_legendary?: boolean; is_mythical?: boolean; flavor_text_entries?: Array<{ flavor_text?: string; language?: { name?: string } }> };
			flavorText = data.flavor_text_entries?.find((entry) => entry.language?.name === "en")?.flavor_text?.replace(/\s+/gu, " ") ?? null;
			hatchCounter = data.hatch_counter ?? 0;
			isLegendary = data.is_legendary ?? false;
			isMythical = data.is_mythical ?? false;
		}
	} catch {}

	return { id, name, height, weight, types, flavorText, hatchCounter, isLegendary, isMythical, cryUrl: resolvedCryUrl };
}

export async function fetchPokemonEncounter(number: number, eventKey: string): Promise<PokemonEncounter | null> {
	try {
		const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${number}/encounters`, { signal: AbortSignal.timeout(5000) });
		if (!response.ok) return null;
		const locations = await response.json() as Array<{
			location_area: { name: string };
			version_details: Array<{
				version: { name: string };
				encounter_details: Array<{ chance: number; min_level: number; max_level: number; method: { name: string } }>;
			}>;
		}>;
		const choices = locations.flatMap((location) => location.version_details.flatMap((version) => version.encounter_details.map((detail) => ({
			location: formatPokemonName(location.location_area.name.replace(/-area$/u, "")),
			version: formatPokemonName(version.version.name),
			method: formatPokemonName(detail.method.name),
			chance: detail.chance,
			minLevel: detail.min_level,
			maxLevel: detail.max_level,
		}))));
		if (choices.length === 0) return null;
		const digest = createHash("sha256").update(`${eventKey}:encounter`).digest();
		const total = choices.reduce((sum, choice) => sum + Math.max(1, choice.chance), 0);
		let roll = digest.readUInt32BE(0) % total;
		const choice = choices.find((candidate) => (roll -= Math.max(1, candidate.chance)) < 0) ?? choices[0]!;
		const range = Math.max(1, choice.maxLevel - choice.minLevel + 1);
		return { location: choice.location, version: choice.version, method: choice.method, chance: choice.chance, level: choice.minLevel + digest.readUInt32BE(4) % range };
	} catch {
		return null;
	}
}
