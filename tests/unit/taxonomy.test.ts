import { describe, expect, it } from 'vitest';
import { collectTags, countByCategory, filterByTagSlug } from '@/lib/articles/taxonomy';
import { ids, makeArticle } from '../helpers/articles';

const articles = [
	makeArticle('a', { category: 'graphics', tags: ['c++', 'math'] }),
	makeArticle('b', { category: 'graphics', tags: ['math'] }),
	makeArticle('c', { category: 'tooling', tags: ['c', 'cmake'] })
];

describe('collectTags', () => {
	it('counts tag usage, most used first then alphabetical', () => {
		expect(collectTags(articles)).toEqual([
			{ tag: 'math', slug: 'math', count: 2 },
			{ tag: 'c', slug: 'c', count: 1 },
			{ tag: 'c++', slug: 'cpp', count: 1 },
			{ tag: 'cmake', slug: 'cmake', count: 1 }
		]);
	});
});

describe('filterByTagSlug', () => {
	it('matches tags by their URL slug', () => {
		expect(ids(filterByTagSlug(articles, 'cpp'))).toEqual(['a']);
		expect(ids(filterByTagSlug(articles, 'c'))).toEqual(['c']);
	});
});

describe('countByCategory', () => {
	it('counts articles per category', () => {
		expect(Object.fromEntries(countByCategory(articles))).toEqual({ graphics: 2, tooling: 1 });
	});
});
