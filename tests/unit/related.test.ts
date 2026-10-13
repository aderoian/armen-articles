import { describe, expect, it } from 'vitest';
import { relatedArticles, relatednessScore } from '@/lib/articles/related';
import { ids, makeArticle } from '../helpers/articles';

const current = makeArticle('current', { category: 'graphics', tags: ['math', 'shaders'] });
const sameCategoryTwoTags = makeArticle('cat-and-tags', {
	category: 'graphics',
	tags: ['math', 'shaders']
});
const sameCategory = makeArticle('cat-only', { category: 'graphics', tags: ['rust'] });
const oneTagNew = makeArticle('tag-new', {
	category: 'tooling',
	tags: ['math'],
	publishedAt: new Date('2026-05-01')
});
const oneTagOld = makeArticle('tag-old', {
	category: 'tooling',
	tags: ['shaders'],
	publishedAt: new Date('2025-05-01')
});
const unrelated = makeArticle('unrelated', { category: 'tooling', tags: ['cmake'] });
const draft = makeArticle('draft', {
	category: 'graphics',
	tags: ['math', 'shaders'],
	draft: true
});

const candidates = [
	unrelated,
	oneTagOld,
	draft,
	current,
	oneTagNew,
	sameCategory,
	sameCategoryTwoTags
];

describe('relatednessScore', () => {
	it('weights a shared category above a single shared tag', () => {
		expect(relatednessScore(current, sameCategory)).toBeGreaterThan(
			relatednessScore(current, oneTagNew)
		);
		expect(relatednessScore(current, unrelated)).toBe(0);
	});
});

describe('relatedArticles', () => {
	it('ranks by score, then newest, excluding self, drafts, and unrelated articles', () => {
		expect(ids(relatedArticles(current, candidates, 10))).toEqual([
			'cat-and-tags',
			'cat-only',
			'tag-new',
			'tag-old'
		]);
	});

	it('respects the limit', () => {
		expect(ids(relatedArticles(current, candidates, 2))).toEqual(['cat-and-tags', 'cat-only']);
	});

	it('is deterministic regardless of input order', () => {
		const reversed = [...candidates].reverse();
		expect(ids(relatedArticles(current, reversed, 10))).toEqual(
			ids(relatedArticles(current, candidates, 10))
		);
	});
});
