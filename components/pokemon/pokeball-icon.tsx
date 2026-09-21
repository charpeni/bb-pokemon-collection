export function PokeballIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<circle cx="12" cy="12" r="9" />
			<path d="M3 12h6m6 0h6" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	);
}
