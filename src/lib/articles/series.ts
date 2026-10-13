import type { ArticleLike } from './types';

/** Articles in a series ordered by `seriesOrder` (not by publication date). */
export function seriesArticles<T extends ArticleLike>(articles: T[], seriesKey: string): T[] {
	return articles
		.filter((article) => article.data.series === seriesKey)
		.sort(
			(a, b) =>
				(a.data.seriesOrder ?? Number.MAX_SAFE_INTEGER) -
					(b.data.seriesOrder ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id)
		);
}

export interface SeriesPosition<T extends ArticleLike> {
	key: string;
	articles: T[];
	/** Zero-based index of the current article within `articles`. */
	index: number;
	previous: T | undefined;
	next: T | undefined;
}

export function seriesPosition<T extends ArticleLike>(
	articles: T[],
	current: T
): SeriesPosition<T> | undefined {
	const key = current.data.series;
	if (!key) return undefined;
	const ordered = seriesArticles(articles, key);
	const index = ordered.findIndex((article) => article.id === current.id);
	if (index === -1) return undefined;
	return {
		key,
		articles: ordered,
		index,
		previous: ordered[index - 1],
		next: ordered[index + 1]
	};
}

/**
 * Fail the build when two articles claim the same position in a series, which
 * would make the reading order ambiguous.
 */
export function assertUniqueSeriesOrder(articles: ArticleLike[]): void {
	const seen = new Map<string, string>();
	const problems: string[] = [];
	for (const article of articles) {
		const { series, seriesOrder } = article.data;
		if (!series || seriesOrder === undefined) continue;
		const key = `${series}#${seriesOrder}`;
		const other = seen.get(key);
		if (other) {
			problems.push(
				`"${article.id}" and "${other}" both use seriesOrder ${seriesOrder} in series "${series}"`
			);
		} else {
			seen.set(key, article.id);
		}
	}
	if (problems.length > 0) {
		throw new Error(`Invalid series ordering:\n  - ${problems.join('\n  - ')}`);
	}
}
