import { tagSlug } from '@/lib/utils/slug';
import type { ArticleLike } from './types';

export interface TagSummary {
	tag: string;
	slug: string;
	count: number;
}

/** All tags in use with article counts, most used first, then alphabetical. */
export function collectTags(articles: ArticleLike[]): TagSummary[] {
	const bySlug = new Map<string, TagSummary>();
	for (const article of articles) {
		for (const tag of article.data.tags) {
			const slug = tagSlug(tag);
			const existing = bySlug.get(slug);
			if (existing) {
				existing.count += 1;
			} else {
				bySlug.set(slug, { tag, slug, count: 1 });
			}
		}
	}
	return [...bySlug.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function filterByTagSlug<T extends ArticleLike>(articles: T[], slug: string): T[] {
	return articles.filter((article) => article.data.tags.some((tag) => tagSlug(tag) === slug));
}

/** Number of articles per category key. Categories without articles are omitted. */
export function countByCategory(articles: ArticleLike[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const article of articles) {
		counts.set(article.data.category, (counts.get(article.data.category) ?? 0) + 1);
	}
	return counts;
}
