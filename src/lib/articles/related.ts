import { compareNewestFirst } from './filters';
import type { ArticleLike } from './types';

const CATEGORY_WEIGHT = 2;
const TAG_WEIGHT = 1;

export function relatednessScore(a: ArticleLike, b: ArticleLike): number {
	const sharedTags = a.data.tags.filter((tag) => b.data.tags.includes(tag)).length;
	const sameCategory = a.data.category === b.data.category ? 1 : 0;
	return sameCategory * CATEGORY_WEIGHT + sharedTags * TAG_WEIGHT;
}

/**
 * Deterministic related articles: scored by shared category and tags, then
 * newest first, then slug. Excludes the current article, drafts, and anything
 * with nothing in common.
 */
export function relatedArticles<T extends ArticleLike>(
	current: ArticleLike,
	candidates: T[],
	limit: number
): T[] {
	return candidates
		.filter((candidate) => candidate.id !== current.id && !candidate.data.draft)
		.map((candidate) => ({ candidate, score: relatednessScore(current, candidate) }))
		.filter(({ score }) => score > 0)
		.sort((a, b) => b.score - a.score || compareNewestFirst(a.candidate, b.candidate))
		.slice(0, limit)
		.map(({ candidate }) => candidate);
}
