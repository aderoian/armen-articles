import { describe, expect, it } from 'vitest';
import { draftArticles, pagefindFragments, publishedArticles } from './helpers';

describe('Pagefind search index', () => {
	const fragments = pagefindFragments();
	const urls = fragments.map((fragment) => fragment.url.replace(/\.html$/, ''));

	it('indexes exactly the published articles', () => {
		expect(urls.sort()).toEqual(publishedArticles.map((a) => `/articles/${a.slug}`).sort());
	});

	it('excludes drafts', () => {
		for (const draft of draftArticles) {
			expect(urls).not.toContain(`/articles/${draft.slug}`);
			expect(fragments.some((fragment) => fragment.content.includes(draft.title))).toBe(false);
		}
	});

	it('indexes titles, descriptions, headings, and body text with metadata', () => {
		const tour = fragments.find((f) => f.url.includes('feature-tour-math-and-diagrams'));
		expect(tour?.meta['title']).toBe('Feature Tour, Part 2: Math and Diagrams');
		expect(tour?.meta['category']).toBe('Graphics');
		expect(tour?.content).toContain('A demonstration of build-time KaTeX equations');
		expect(tour?.content).toContain('Linear interpolation between two values');
		expect(tour?.anchors.map((anchor) => anchor.text)).toContain('Inline and display math');
	});

	it('leaves navigation chrome and screen-reader hints out of the index', () => {
		for (const fragment of fragments) {
			expect(fragment.content).not.toMatch(/On this page|Related articles|\(external link\)/);
			expect(fragment.content).not.toMatch(/min read/);
		}
	});
});
