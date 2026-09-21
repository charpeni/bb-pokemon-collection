import type { Capture } from "../../server";
import { Button } from "@/components/ui/button";

export const POKEDEX_PAGE_SIZE = 9;

export function paginateCaptures(captures: Capture[], page: number) {
	const pageCount = Math.max(1, Math.ceil(captures.length / POKEDEX_PAGE_SIZE));
	const currentPage = Math.min(Math.max(1, page), pageCount);
	const startIndex = (currentPage - 1) * POKEDEX_PAGE_SIZE;
	return {
		currentPage,
		pageCount,
		captures: captures.slice(startIndex, startIndex + POKEDEX_PAGE_SIZE),
		start: captures.length === 0 ? 0 : startIndex + 1,
		end: Math.min(startIndex + POKEDEX_PAGE_SIZE, captures.length),
	};
}

export function CollectionPagination({ page, total, onPageChange }: { page: number; total: number; onPageChange: (page: number) => void }) {
	const pageCount = Math.max(1, Math.ceil(total / POKEDEX_PAGE_SIZE));
	if (pageCount === 1) return null;
	const start = (page - 1) * POKEDEX_PAGE_SIZE + 1;
	const end = Math.min(page * POKEDEX_PAGE_SIZE, total);

	return (
		<nav className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4" aria-label="Pokedex pagination">
			<p className="text-xs text-muted-foreground">Showing {start}–{end} of {total}</p>
			<div className="flex items-center gap-2">
				<Button variant="outline" size="sm" disabled={page === 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
				<span className="min-w-20 text-center text-xs font-medium text-foreground">Page {page} of {pageCount}</span>
				<Button variant="outline" size="sm" disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>Next</Button>
			</div>
		</nav>
	);
}
