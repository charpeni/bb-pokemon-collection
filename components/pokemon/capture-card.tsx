import type { Capture } from "../../server";
import { playPokemonCry, shinySpriteUrl, spriteUrl } from "../../lib/pokemon/media";

export function CaptureCard({ capture, activeCompanion, onSelectCompanion }: { capture: Capture; activeCompanion?: boolean; onSelectCompanion?: (captureId: string) => void }) {
	const displaySprite = capture.isShiny
		? (capture.shinySpriteUrl ?? shinySpriteUrl(capture.pokemonNumber))
		: (capture.spriteUrl ?? spriteUrl(capture.pokemonNumber));

	return (
		<article className={`pokemon-card group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card ${capture.isShiny ? "border-yellow-400 ring-1 ring-yellow-400/30" : capture.isEgg ? "border-violet-400/60 ring-1 ring-violet-400/20" : "border-border"}`}>
			<div className="pokemon-art-stage relative flex h-36 items-center justify-center overflow-hidden border-b border-border p-4">
				<span className="absolute left-4 top-3 font-mono text-xs font-semibold tracking-widest text-muted-foreground">
					{capture.isEgg ? "RARE EGG" : `#${String(capture.pokemonNumber).padStart(3, "0")}`}
				</span>
				<span className="absolute bottom-3 left-4 rounded-full border border-border bg-card/90 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Gen {capture.generation}</span>
				{capture.isShiny ? <span className="absolute right-3 top-3 text-lg" title="Shiny!">✨</span> : null}
				{capture.isEgg ? (
					<div className="pokemon-egg" role="img" aria-label="Mystery Pokemon egg" />
				) : (
					<button type="button" aria-label={`Play ${capture.pokemonName}'s cry`} title={`Play ${capture.pokemonName}'s cry`} className="h-full w-full max-w-24 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => playPokemonCry(capture.cryUrl)}>
						<img src={displaySprite} alt="" loading="lazy" className="h-full w-full object-contain [image-rendering:pixelated] transition-transform duration-300 group-hover:scale-125" />
					</button>
				)}
			</div>
			<div className="flex flex-1 flex-col p-4">
				<div className="flex items-start justify-between gap-3">
					<h3 className="text-lg font-bold tracking-tight text-foreground">{capture.isShiny ? `✨ ${capture.pokemonName}` : capture.pokemonName}</h3>
					<div className="flex flex-wrap justify-end gap-1">
						<span data-rarity={capture.rarity} className="pokemon-rarity rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{capture.rarity}</span>
						{capture.types.map((type) => <span key={type} data-type={type} className="pokemon-type rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{type}</span>)}
					</div>
				</div>
				{capture.isEgg ? (
					<div className="mt-3">
						<div className="flex justify-between text-xs text-muted-foreground"><span>Incubation</span><span>{capture.eggSteps.toLocaleString()} / {capture.eggStepsRequired.toLocaleString()} steps</span></div>
						<div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Egg incubation progress" aria-valuemin={0} aria-valuemax={capture.eggStepsRequired} aria-valuenow={capture.eggSteps}>
							<div className="pokemon-egg-progress h-full rounded-full" style={{ width: `${capture.eggStepsRequired === 0 ? 0 : capture.eggSteps / capture.eggStepsRequired * 100}%` }} />
						</div>
						<p className="mt-1.5 text-[11px] text-muted-foreground">{capture.eggStepsRequired - capture.eggSteps > 2000 ? "It looks like this Egg will take a long time to hatch." : "Sounds can be heard coming from inside!"}</p>
					</div>
				) : null}
				{capture.heightDecimeters === null || capture.weightHectograms === null ? null : (
					<dl className="mt-2 flex gap-4 text-xs text-muted-foreground">
						<div><dt className="inline font-semibold text-foreground">HT </dt><dd className="inline">{(capture.heightDecimeters / 10).toFixed(1)} m</dd></div>
						<div><dt className="inline font-semibold text-foreground">WT </dt><dd className="inline">{(capture.weightHectograms / 10).toFixed(1)} kg</dd></div>
					</dl>
				)}
				{capture.flavorText === null ? null : <p className="mt-3 min-h-10 text-xs italic leading-5 text-muted-foreground">{capture.flavorText}</p>}
				{capture.encounterLocation === null ? null : <p className="mt-3 text-[11px] text-muted-foreground">{capture.encounterLocation}{capture.encounterLevel === null ? "" : ` · Lv. ${capture.encounterLevel}`}{capture.encounterMethod === null ? "" : ` · ${capture.encounterMethod}`}{capture.encounterVersion === null ? "" : ` · ${capture.encounterVersion}`}</p>}
				<div className="mt-auto pt-4">
					<div className="border-t border-dashed border-border pt-3">
						<p className="text-xs font-medium leading-5 text-foreground">{capture.description}</p>
						<time className="mt-1 block font-mono text-[10px] uppercase tracking-wide text-muted-foreground" dateTime={capture.caughtAt}>{capture.isEgg ? "Found" : "Caught"} {new Date(capture.caughtAt).toLocaleDateString()}</time>
						{capture.isEgg || onSelectCompanion === undefined ? null : (
							<button type="button" disabled={activeCompanion} className="mt-3 w-full rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-default disabled:bg-muted disabled:text-muted-foreground" onClick={() => onSelectCompanion(capture.id)}>
								{activeCompanion ? "Current companion" : "Make companion"}
							</button>
						)}
					</div>
				</div>
			</div>
		</article>
	);
}
