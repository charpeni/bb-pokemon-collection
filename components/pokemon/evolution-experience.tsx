import { useCallback, useEffect, useState } from "react";
import { useRealtime, useRpc } from "@get-bb/plugin-sdk/app";
import { Button } from "@/components/ui/button";
import type { rpcContract } from "../../server";

type Evolution = {
	fromName: string;
	fromSpriteUrl: string;
	toName: string;
	toSpriteUrl: string;
	key: string;
};

function readEvolutions(payload: unknown): Evolution[] {
	if (typeof payload !== "object" || payload === null) return [];
	const candidate = payload as { reason?: unknown; captureId?: unknown; evolutions?: unknown };
	if (candidate.reason !== "companion_evolved" || typeof candidate.captureId !== "string" || !Array.isArray(candidate.evolutions)) return [];
	return candidate.evolutions.flatMap((entry, index) => {
		if (typeof entry !== "object" || entry === null) return [];
		const evolution = entry as Record<string, unknown>;
		if (typeof evolution.fromName !== "string" || typeof evolution.fromSpriteUrl !== "string" || typeof evolution.toName !== "string" || typeof evolution.toSpriteUrl !== "string" || typeof evolution.toNumber !== "number") return [];
		return [{
			fromName: evolution.fromName,
			fromSpriteUrl: evolution.fromSpriteUrl,
			toName: evolution.toName,
			toSpriteUrl: evolution.toSpriteUrl,
			key: `${candidate.captureId}:${evolution.toNumber}:${index}`,
		}];
	});
}

function playEvolutionChime() {
	type AudioContextConstructor = new () => AudioContext;
	const AudioContextClass = (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).AudioContext
		?? (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
	if (AudioContextClass === undefined) return;
	try {
		const context = new AudioContextClass();
		void context.resume();
		const master = context.createGain();
		master.gain.setValueAtTime(0.0001, context.currentTime);
		master.gain.exponentialRampToValueAtTime(0.13, context.currentTime + 0.04);
		master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 3.45);
		master.connect(context.destination);
		[523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
			const oscillator = context.createOscillator();
			const gain = context.createGain();
			const start = context.currentTime + index * 0.18;
			oscillator.type = index === 3 ? "sine" : "triangle";
			oscillator.frequency.setValueAtTime(frequency, start);
			gain.gain.setValueAtTime(0.0001, start);
			gain.gain.exponentialRampToValueAtTime(0.8, start + 0.03);
			gain.gain.exponentialRampToValueAtTime(0.0001, start + (index === 3 ? 2.7 : 0.45));
			oscillator.connect(gain);
			gain.connect(master);
			oscillator.start(start);
			oscillator.stop(start + (index === 3 ? 2.75 : 0.5));
		});
		const timeout = window.setTimeout(() => void context.close(), 3_600);
		return () => {
			window.clearTimeout(timeout);
			if (context.state !== "closed") void context.close();
		};
	} catch {
		return;
	}
}

function EvolutionModal({ evolution, onClose }: { evolution: Evolution; onClose: () => void }) {
	const [complete, setComplete] = useState(false);

	useEffect(() => {
		const stopChime = playEvolutionChime();
		const completion = window.setTimeout(() => setComplete(true), 3_400);
		const dismissal = window.setTimeout(onClose, 6_500);
		return () => {
			stopChime?.();
			window.clearTimeout(completion);
			window.clearTimeout(dismissal);
		};
	}, [evolution.key, onClose]);

	useEffect(() => {
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", closeOnEscape);
		return () => document.removeEventListener("keydown", closeOnEscape);
	}, [onClose]);

	return (
		<div className="pokemon-evolution-modal fixed inset-0 z-[110] grid place-items-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
			<section className="pokemon-evolution-scene relative w-full max-w-2xl overflow-hidden rounded-xl border border-border shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="pokemon-evolution-title">
				<Button className="absolute right-3 top-3 z-20 border-white/30 bg-black/25 text-white hover:bg-black/45 hover:text-white" variant="outline" size="icon" aria-label="Close evolution" onClick={onClose}>
					<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
				</Button>
				<div className="pokemon-evolution-light" aria-hidden="true" />
				<div className="pokemon-evolution-arena relative flex min-h-[22rem] items-center justify-center px-8 pb-28 pt-12">
					<img src={evolution.fromSpriteUrl} alt="" className="pokemon-classic-evolution-sprite pokemon-classic-evolution-from" draggable={false} />
					<img src={evolution.toSpriteUrl} alt={evolution.toName} className="pokemon-classic-evolution-sprite pokemon-classic-evolution-to" draggable={false} />
				</div>
				<div className="pokemon-evolution-dialog absolute inset-x-3 bottom-3 z-10 rounded-lg border-4 border-double border-foreground bg-card p-4 pr-24 shadow-xl sm:inset-x-5 sm:bottom-5">
					<p id="pokemon-evolution-title" className="font-mono text-base font-semibold leading-7 text-foreground sm:text-lg">
						{complete ? <>Congratulations!<br />Your {evolution.fromName} evolved into {evolution.toName}!</> : <>What?<br />{evolution.fromName} is evolving!</>}
					</p>
					<Button className="absolute bottom-3 right-3" variant="outline" size="sm" onClick={onClose}>{complete ? "Continue" : "Skip"}</Button>
				</div>
			</section>
		</div>
	);
}

export function EvolutionExperience() {
	const rpc = useRpc<typeof rpcContract>();
	const [enabled, setEnabled] = useState<boolean | null>(null);
	const [evolutions, setEvolutions] = useState<Evolution[]>([]);

	const loadPreference = useCallback(() => {
		rpc.call("preferences_get").then(({ showEvolutionAnimations }) => setEnabled(showEvolutionAnimations), () => setEnabled(false));
	}, [rpc]);

	useEffect(loadPreference, [loadPreference]);
	useRealtime("preferences-changed", loadPreference);
	useRealtime("collection-changed", (payload) => {
		const next = readEvolutions(payload);
		if (next.length > 0) setEvolutions((current) => [...current, ...next]);
	});

	useEffect(() => {
		if (enabled === false) setEvolutions([]);
	}, [enabled]);

	if (enabled !== true || evolutions[0] === undefined) return null;
	return <EvolutionModal evolution={evolutions[0]} onClose={() => setEvolutions((current) => current.slice(1))} />;
}
