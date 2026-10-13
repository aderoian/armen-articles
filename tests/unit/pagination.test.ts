import { describe, expect, it } from 'vitest';
import { pageCount, paginate } from '@/lib/articles/pagination';

const items = Array.from({ length: 23 }, (_, index) => index + 1);

describe('pageCount', () => {
	it('rounds up and never returns fewer than one page', () => {
		expect(pageCount(23, 10)).toBe(3);
		expect(pageCount(20, 10)).toBe(2);
		expect(pageCount(0, 10)).toBe(1);
	});

	it('rejects invalid page sizes', () => {
		expect(() => pageCount(5, 0)).toThrow(RangeError);
	});
});

describe('paginate', () => {
	it('returns the requested slice and neighbours', () => {
		const page = paginate(items, 10, 2);
		expect(page.items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
		expect(page).toMatchObject({ current: 2, total: 3, previous: 1, next: 3 });
	});

	it('handles the first and last pages', () => {
		expect(paginate(items, 10, 1).previous).toBeUndefined();
		const last = paginate(items, 10, 3);
		expect(last.items).toEqual([21, 22, 23]);
		expect(last.next).toBeUndefined();
	});

	it('returns a single empty page for no items', () => {
		expect(paginate([], 10, 1)).toMatchObject({ items: [], total: 1 });
	});

	it('rejects out-of-range pages', () => {
		expect(() => paginate(items, 10, 0)).toThrow(RangeError);
		expect(() => paginate(items, 10, 4)).toThrow(/out of range/);
		expect(() => paginate(items, 10, 1.5)).toThrow(RangeError);
	});
});
