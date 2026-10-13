import { describe, expect, it } from 'vitest';
import { articleSlugFromPath, normalizeTag, slugify, tagSlug } from '@/lib/utils/slug';

describe('slugify', () => {
	it('lowercases and hyphenates words', () => {
		expect(slugify('Hello World')).toBe('hello-world');
	});

	it('strips diacritics and apostrophes', () => {
		expect(slugify('Ångström’s Café')).toBe('angstroms-cafe');
		expect(slugify("don't panic")).toBe('dont-panic');
	});

	it('collapses punctuation and trims hyphens', () => {
		expect(slugify('  --Rust: Ownership & Borrowing!--  ')).toBe('rust-ownership-borrowing');
	});

	it('returns an empty string when nothing is slug-safe', () => {
		expect(slugify('!!!')).toBe('');
	});
});

describe('articleSlugFromPath', () => {
	it('uses the file name without extension', () => {
		expect(articleSlugFromPath('my-article.md')).toBe('my-article');
		expect(articleSlugFromPath('Interactive Demo.mdx')).toBe('interactive-demo');
	});

	it('ignores folders so articles can move without changing URLs', () => {
		expect(articleSlugFromPath('2026/drafts/my-article.md')).toBe('my-article');
	});

	it('uses the folder name for index files', () => {
		expect(articleSlugFromPath('markdown-reference/index.md')).toBe('markdown-reference');
		expect(articleSlugFromPath('series/part-one/index.mdx')).toBe('part-one');
	});

	it('handles Windows separators', () => {
		expect(articleSlugFromPath('folder\\post.md')).toBe('post');
	});

	it('throws when no slug can be derived', () => {
		expect(() => articleSlugFromPath('index.md')).toThrow(/Cannot derive/);
	});
});

describe('tag normalization', () => {
	it('trims, collapses whitespace, and lowercases', () => {
		expect(normalizeTag('  Linear   Algebra ')).toBe('linear algebra');
	});

	it('keeps symbolic language names distinct in URLs', () => {
		expect(tagSlug('C++')).toBe('cpp');
		expect(tagSlug('C#')).toBe('csharp');
		expect(tagSlug('C')).toBe('c');
		expect(tagSlug('.NET')).toBe('dotnet');
		expect(tagSlug('a+b')).toBe('a-plus-b');
	});

	it('produces the same slug for equivalent spellings', () => {
		expect(tagSlug('Linear Algebra')).toBe(tagSlug('linear-algebra'));
	});
});
