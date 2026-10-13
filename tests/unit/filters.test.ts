import { describe, expect, it } from 'vitest';
import {
	featuredArticles,
	filterByCategory,
	filterPublished,
	filterVisible,
	lastModified,
	sortByNewest
} from '@/lib/articles/filters';
import { ids, makeArticle } from '../helpers/articles';

const articles = [
	makeArticle('old', { publishedAt: new Date('2025-01-01'), category: 'graphics' }),
	makeArticle('draft', { publishedAt: new Date('2026-06-01'), draft: true }),
	makeArticle('new', { publishedAt: new Date('2026-03-01'), featured: true }),
	makeArticle('b-same-day', { publishedAt: new Date('2026-02-01'), category: 'graphics' }),
	makeArticle('a-same-day', { publishedAt: new Date('2026-02-01'), featured: true })
];

describe('sortByNewest', () => {
	it('orders by publication date descending, then by slug', () => {
		expect(ids(sortByNewest(articles))).toEqual([
			'draft',
			'new',
			'a-same-day',
			'b-same-day',
			'old'
		]);
	});

	it('does not mutate its input', () => {
		const copy = [...articles];
		sortByNewest(articles);
		expect(articles).toEqual(copy);
	});
});

describe('draft exclusion', () => {
	it('hides drafts unless drafts are explicitly included', () => {
		expect(ids(filterVisible(articles, { includeDrafts: false }))).not.toContain('draft');
		expect(ids(filterVisible(articles, { includeDrafts: true }))).toContain('draft');
	});

	it('filterPublished always removes drafts', () => {
		expect(ids(filterPublished(articles))).toEqual(['old', 'new', 'b-same-day', 'a-same-day']);
	});
});

describe('filterByCategory', () => {
	it('returns only articles in the category', () => {
		expect(ids(filterByCategory(articles, 'graphics'))).toEqual(['old', 'b-same-day']);
		expect(filterByCategory(articles, 'missing')).toEqual([]);
	});
});

describe('featuredArticles', () => {
	it('returns featured articles newest first, limited', () => {
		expect(ids(featuredArticles(articles, 5))).toEqual(['new', 'a-same-day']);
		expect(ids(featuredArticles(articles, 1))).toEqual(['new']);
	});
});

describe('lastModified', () => {
	it('prefers updatedAt over publishedAt', () => {
		const updated = new Date('2026-05-05');
		expect(lastModified(makeArticle('x', { updatedAt: updated }))).toBe(updated);
		expect(lastModified(makeArticle('y')).toISOString()).toBe('2026-01-01T00:00:00.000Z');
	});
});
