import { describe, expect, it } from 'vitest';
import { toSigned, toUnsigned } from '@/components/interactive/BitExplorer';
import { cleanUrl } from '@/components/search/search-client';

const bits = (value: string) => [...value].map((bit) => bit === '1');

describe('BitExplorer conversions', () => {
	it.each([
		['00000000', 0, 0],
		['00101010', 42, 42],
		['01111111', 127, 127],
		['10000000', 128, -128],
		['11111111', 255, -1]
	])('%s is %i unsigned and %i signed', (pattern, unsigned, signed) => {
		expect(toUnsigned(bits(pattern))).toBe(unsigned);
		expect(toSigned(bits(pattern))).toBe(signed);
	});
});

describe('search result URLs', () => {
	it.each([
		['/articles/foo.html', '/articles/foo'],
		['/articles/foo.html#section', '/articles/foo#section'],
		['/index.html', '/'],
		['/articles/foo', '/articles/foo']
	])('%s → %s', (input, expected) => {
		expect(cleanUrl(input)).toBe(expected);
	});
});
