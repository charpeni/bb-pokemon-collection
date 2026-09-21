import { type ReactNode, useEffect } from "react";

export function Modal({ children, onClose, wide = false }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
	useEffect(() => {
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", closeOnEscape);
		return () => document.removeEventListener("keydown", closeOnEscape);
	}, [onClose]);

	return (
		<div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
			<section className={`relative max-h-[86vh] w-full overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl ${wide ? "max-w-2xl" : "max-w-lg"}`} role="dialog" aria-modal="true">
				{children}
			</section>
		</div>
	);
}
