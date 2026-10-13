import type { ArticleLike } from './types';

export interface VisibilityOptions {
	/** Include drafts. Only the dev server sets this; production builds never do. */
	includeDrafts: boolean;
}

export function isVisible(article: ArticleLike, { includeDrafts }: VisibilityOptions): boolean {
	return includeDrafts || !article.data.draft;
}

export function filterVisible<T extends ArticleLike>(
	articles: T[],
	options: VisibilityOptions
): T[] {
	return articles.filter((article) => isVisible(article, options));
}

/** Only articles that are never drafts — used for feeds and indexes even in dev. */
export function filterPublished<T extends ArticleLike>(articles: T[]): T[] {
	return articles.filter((article) => !article.data.draft);
}

/** Newest first by publication date; ties broken by slug for a stable order. */
export function compareNewestFirst(a: ArticleLike, b: ArticleLike): number {
	const diff = b.data.publishedAt.getTime() - a.data.publishedAt.getTime();
	return diff !== 0 ? diff : a.id.localeCompare(b.id);
}

export function sortByNewest<T extends ArticleLike>(articles: T[]): T[] {
	return [...articles].sort(compareNewestFirst);
}

export function filterByCategory<T extends ArticleLike>(articles: T[], category: string): T[] {
	return articles.filter((article) => article.data.category === category);
}

export function featuredArticles<T extends ArticleLike>(articles: T[], limit: number): T[] {
	return sortByNewest(articles.filter((article) => article.data.featured)).slice(0, limit);
}

/** The latest date an article changed, for feeds, sitemaps, and `dateModified`. */
export function lastModified(article: ArticleLike): Date {
	return article.data.updatedAt ?? article.data.publishedAt;
}
