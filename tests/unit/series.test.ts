import { describe, expect, it } from 'vitest';
import { assertUniqueSeriesOrder, seriesArticles, seriesPosition } from '@/lib/articles/series';
import { ids, makeArticle } from '../helpers/articles';

// Publication dates deliberately disagree with the series order.
const part1 = makeArticle('part-1', {
	series: 'demo',
	seriesOrder: 1,
	publishedAt: new Date('2026-03-01')
});
const part2 = makeArticle('part-2', {
	series: 'demo',
	seriesOrder: 2,
	publishedAt: new Date('2026-01-01')
});
const part3 = makeArticle('part-3', {
	series: 'demo',
	seriesOrder: 3,
	publishedAt: new Date('2026-02-01')
});
const other = makeArticle('other', { series: 'other', seriesOrder: 1 });
const standalone = makeArticle('standalone');
const all = [part3, other, part1, standalone, part2];

describe('seriesArticles', () => {
	it('orders by seriesOrder, not publication date', () => {
		expect(ids(seriesArticles(all, 'demo'))).toEqual(['part-1', 'part-2', 'part-3']);
	});

	it('returns an empty list for unknown series', () => {
		expect(seriesArticles(all, 'missing')).toEqual([]);
	});
});

describe('seriesPosition', () => {
	it('reports position with previous and next parts', () => {
		const position = seriesPosition(all, part2);
		expect(position?.index).toBe(1);
		expect(position?.previous?.id).toBe('part-1');
		expect(position?.next?.id).toBe('part-3');
		expect(ids(position?.articles ?? [])).toEqual(['part-1', 'part-2', 'part-3']);
	});

	it('has no previous part at the start and no next part at the end', () => {
		expect(seriesPosition(all, part1)?.previous).toBeUndefined();
		expect(seriesPosition(all, part3)?.next).toBeUndefined();
	});

	it('is undefined for articles outside a series', () => {
		expect(seriesPosition(all, standalone)).toBeUndefined();
	});
});

describe('assertUniqueSeriesOrder', () => {
	it('accepts distinct positions', () => {
		expect(() => assertUniqueSeriesOrder(all)).not.toThrow();
	});

	it('rejects two articles at the same position with an actionable message', () => {
		const clash = makeArticle('clash', { series: 'demo', seriesOrder: 2 });
		expect(() => assertUniqueSeriesOrder([...all, clash])).toThrow(
			/"clash" and "part-2" both use seriesOrder 2 in series "demo"/
		);
	});
});
