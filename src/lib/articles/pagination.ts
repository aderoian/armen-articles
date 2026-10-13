export interface Page<T> {
	items: T[];
	/** One-based page number. */
	current: number;
	total: number;
	previous: number | undefined;
	next: number | undefined;
}

export function pageCount(itemCount: number, pageSize: number): number {
	if (pageSize < 1) throw new RangeError('pageSize must be at least 1');
	return Math.max(1, Math.ceil(itemCount / pageSize));
}

/** Slice `items` into the given one-based page. Throws for out-of-range pages. */
export function paginate<T>(items: T[], pageSize: number, page: number): Page<T> {
	const total = pageCount(items.length, pageSize);
	if (!Number.isInteger(page) || page < 1 || page > total) {
		throw new RangeError(`Page ${page} is out of range (1–${total})`);
	}
	const start = (page - 1) * pageSize;
	return {
		items: items.slice(start, start + pageSize),
		current: page,
		total,
		previous: page > 1 ? page - 1 : undefined,
		next: page < total ? page + 1 : undefined
	};
}
