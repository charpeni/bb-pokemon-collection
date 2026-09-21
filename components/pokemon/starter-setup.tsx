import { useState } from "react";
import { Button } from "@/components/ui/button";
import { starters, type StarterId } from "../../pokemon";
import { spriteUrl } from "../../lib/pokemon/media";
import { Modal } from "./modal";

function StarterChoices({ onSelect, pending }: { onSelect: (starter: StarterId) => void; pending: boolean }) {
	return (
		<div className="starter-scroll space-y-5 overflow-y-auto pr-1">
			{Array.from({ length: 9 }, (_, index) => index + 1).map((generation) => (
				<section key={generation}>
					<div className="mb-2 flex items-center gap-2">
						<span className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">Generation {generation}</span>
						<span className="h-px flex-1 bg-border" />
					</div>
					<div className="grid grid-cols-3 gap-2">
						{starters.slice((generation - 1) * 3, generation * 3).map((starter) => (
							<button key={starter.id} type="button" disabled={pending} onClick={() => onSelect(starter.id)} className="starter-choice group relative flex min-w-0 flex-col items-center overflow-hidden rounded-lg border border-border bg-card px-2 pb-3 pt-2 text-foreground transition hover:-translate-y-0.5 hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
								<span className="absolute right-2 top-2 font-mono text-[10px] text-muted-foreground">#{String(starter.number).padStart(3, "0")}</span>
								<img src={spriteUrl(starter.number)} alt="" loading="lazy" className="size-16 object-contain [image-rendering:pixelated] transition-transform group-hover:scale-110 sm:size-20" />
								<span className="w-full truncate text-xs font-semibold sm:text-sm">{starter.name}</span>
							</button>
						))}
					</div>
				</section>
			))}
		</div>
	);
}

export function StarterSetup({ error, onClose, selectStarter }: { error: string | null; onClose: () => void; selectStarter: (starter: StarterId) => Promise<void> }) {
	const [pending, setPending] = useState(false);
	const choose = async (starter: StarterId) => {
		setPending(true);
		await selectStarter(starter);
		setPending(false);
	};

	return (
		<Modal onClose={onClose} wide>
			<Button className="absolute right-3 top-3" variant="ghost" size="sm" aria-label="Close starter selection" onClick={onClose}>Close</Button>
			<div className="mb-4 space-y-1.5">
				<h2 className="text-lg font-semibold">Choose your coding companion</h2>
				<p className="text-sm text-muted-foreground">Pick a partner from any generation. They will hang out in every thread and spring into action while an agent is working.</p>
			</div>
			<StarterChoices onSelect={(starter) => void choose(starter)} pending={pending} />
			{error === null ? null : <p className="text-sm text-destructive">{error}</p>}
		</Modal>
	);
}
