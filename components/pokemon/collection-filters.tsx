import type { Capture, PokemonRarity } from "../../server";
import { pokemonGenerations, type PokemonGeneration } from "../../lib/pokemon/generation";

export type CollectionFilters = {
	shinyOnly: boolean;
	type: string;
	rarity: PokemonRarity | "all";
	generation: PokemonGeneration | "all";
};

export const defaultCollectionFilters: CollectionFilters = {
	shinyOnly: false,
	type: "all",
	rarity: "all",
	generation: "all",
};

export function filterCaptures(captures: Capture[], filters: CollectionFilters) {
	return captures.filter((capture) =>
		(!filters.shinyOnly || capture.isShiny) &&
		(filters.type === "all" || capture.types.includes(filters.type)) &&
		(filters.rarity === "all" || capture.rarity === filters.rarity) &&
		(filters.generation === "all" || capture.generation === filters.generation)
	);
}

export function CollectionFilterControls({ captures, filters, onChange }: { captures: Capture[]; filters: CollectionFilters; onChange: (filters: CollectionFilters) => void }) {
	const types = [...new Set(captures.flatMap((capture) => capture.types))].sort();
	const selectClass = "h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";
	return (
		<div className="flex flex-wrap items-center gap-2" aria-label="Filter Pokemon collection">
			<label className="text-xs text-muted-foreground">Type <select aria-label="Filter by type" className={selectClass} value={filters.type} onChange={(event) => onChange({ ...filters, type: event.target.value })}><option value="all">All</option>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
			<label className="text-xs text-muted-foreground">Rarity <select aria-label="Filter by rarity" className={selectClass} value={filters.rarity} onChange={(event) => onChange({ ...filters, rarity: event.target.value as CollectionFilters["rarity"] })}><option value="all">All</option><option value="common">Common</option><option value="uncommon">Uncommon</option><option value="rare">Rare</option><option value="legendary">Legendary</option></select></label>
			<label className="text-xs text-muted-foreground">Generation <select aria-label="Filter by generation" className={selectClass} value={filters.generation} onChange={(event) => onChange({ ...filters, generation: event.target.value === "all" ? "all" : Number(event.target.value) as PokemonGeneration })}><option value="all">All</option>{pokemonGenerations.map((generation) => <option key={generation} value={generation}>Gen {generation}</option>)}</select></label>
			<button type="button" aria-pressed={filters.shinyOnly} className={`h-8 rounded-md border px-3 text-xs font-semibold transition ${filters.shinyOnly ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`} onClick={() => onChange({ ...filters, shinyOnly: !filters.shinyOnly })}>✨ Shiny</button>
			{JSON.stringify(filters) === JSON.stringify(defaultCollectionFilters) ? null : <button type="button" className="h-8 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={() => onChange(defaultCollectionFilters)}>Clear filters</button>}
		</div>
	);
}
