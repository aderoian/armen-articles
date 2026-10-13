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
		const planet = fragments.find((f) => f.url.includes('browser-procedural-planet'));
		expect(planet?.meta['title']).toBe('Devlog: Growing a Tiny Procedural Planet in the Browser');
		expect(planet?.meta['category']).toBe('Graphics');
		expect(planet?.content).toContain('How I built the seeded planet generator');
		expect(planet?.content).toContain('A sphere is easy. A world needs relationships.');
		expect(planet?.anchors.map((anchor) => anchor.text)).toContain(
			'The goal: a world, not a sphere'
		);
	});

	it('leaves navigation chrome and screen-reader hints out of the index', () => {
		for (const fragment of fragments) {
			expect(fragment.content).not.toMatch(/On this page|Related articles|\(external link\)/);
			expect(fragment.content).not.toMatch(/min read/);
		}
	});
});
