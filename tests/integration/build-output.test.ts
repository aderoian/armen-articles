import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inlineScriptHashes } from '@/lib/security/headers';
import {
	DIST,
	SITE,
	distFiles,
	draftArticles,
	htmlFiles,
	parseHtml,
	publishedArticles,
	read,
	servedPath,
	sourceArticles
} from './helpers';

const DRAFT_MARKER = 'zebra-quasar-draft-marker';
const articlePage = (slug: string) => join(DIST, 'articles', `${slug}.html`);

describe('article pages', () => {
	it('has sample content with at least one draft to verify', () => {
		expect(publishedArticles.length).toBeGreaterThan(0);
		expect(draftArticles.length).toBeGreaterThan(0);
	});

	it('generates a page for every published article', () => {
		for (const article of publishedArticles) {
			expect(existsSync(articlePage(article.slug)), article.slug).toBe(true);
			const page = parseHtml(read(articlePage(article.slug)));
			expect(page.text(page.byTag('h1')[0]!)).toBe(article.title);
		}
	});

	it('does not generate pages for drafts', () => {
		for (const article of draftArticles) {
			expect(existsSync(articlePage(article.slug)), article.slug).toBe(false);
		}
	});

	it('never leaks draft content into any built file', () => {
		const textFiles = distFiles.filter((file) => /\.(html|xml|txt|json|js|css)$/.test(file));
		for (const file of textFiles) {
			const content = read(file);
			expect(content.includes(DRAFT_MARKER), file).toBe(false);
			for (const draft of draftArticles) {
				expect(content.includes(`/articles/${draft.slug}`), file).toBe(false);
			}
		}
	});
});

describe('page metadata', () => {
	const pages = htmlFiles.filter((file) => !file.endsWith('404.html'));

	it('gives every page a canonical production URL that matches og:url', () => {
		for (const file of pages) {
			const page = parseHtml(read(file));
			const canonical = page.link('canonical');
			expect(canonical, file).toBe(new URL(servedPath(file), SITE).toString());
			expect(page.meta('og:url'), file).toBe(canonical);
		}
	});

	it('gives every page a unique title, a description, one h1, and a language', () => {
		const titles = new Set<string>();
		for (const file of pages) {
			const html = read(file);
			const page = parseHtml(html);
			const title = page.text(page.byTag('title')[0]!);
			expect(titles.has(title), `duplicate title "${title}"`).toBe(false);
			titles.add(title);
			expect(page.meta('description')?.length, file).toBeGreaterThan(10);
			expect(page.byTag('h1'), file).toHaveLength(1);
			expect(html).toMatch(/<html lang="en"/);
		}
	});

	it('marks the 404 page as noindex', () => {
		expect(parseHtml(read(join(DIST, '404.html'))).meta('robots')).toMatch(/noindex/);
	});

	it('describes articles with Open Graph and Schema.org data', () => {
		for (const article of publishedArticles) {
			const page = parseHtml(read(articlePage(article.slug)));
			expect(page.meta('og:type')).toBe('article');
			expect(page.meta('article:published_time')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
			expect(page.meta('og:image')).toMatch(new RegExp(`^${SITE}/`));
			const jsonLd = page
				.all((el) => el.name === 'script' && el.attribs['type'] === 'application/ld+json')
				.map((el) => JSON.parse(page.text(el)) as Record<string, unknown>);
			const schema = jsonLd.find((data) => data['@type'] === 'TechArticle');
			expect(schema?.['headline']).toBe(article.title);
			expect(schema?.['url']).toBe(`${SITE}/articles/${article.slug}`);
			expect(jsonLd.some((data) => data['@type'] === 'BreadcrumbList')).toBe(true);
		}
	});
});

describe('series navigation', () => {
	const seriesKeys = [...new Set(publishedArticles.flatMap((article) => article.series ?? []))];

	it.each(seriesKeys)('lists %s parts in seriesOrder and links them in sequence', (key) => {
		const parts = publishedArticles
			.filter((article) => article.series === key)
			.sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0));

		const seriesPage = parseHtml(read(join(DIST, 'series', `${key}.html`)));
		const listed = seriesPage
			.all((el) => el.name === 'a' && el.attribs['href']?.startsWith('/articles/') === true)
			.map((el) => el.attribs['href']);
		expect(listed).toEqual(parts.map((part) => `/articles/${part.slug}`));

		parts.forEach((part, index) => {
			const page = parseHtml(read(articlePage(part.slug)));
			const rel = (value: string) =>
				page.all((el) => el.name === 'a' && el.attribs['rel'] === value)[0]?.attribs['href'];
			expect(rel('prev')).toBe(index > 0 ? `/articles/${parts[index - 1]!.slug}` : undefined);
			expect(rel('next')).toBe(
				index < parts.length - 1 ? `/articles/${parts[index + 1]!.slug}` : undefined
			);
		});
	});
});

describe('feeds and crawler files', () => {
	it('publishes an RSS item for each published article and nothing else', () => {
		const rss = read(join(DIST, 'rss.xml'));
		const links = [...rss.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)].map((m) => m[1]);
		expect(links.sort()).toEqual(
			publishedArticles.map((article) => `${SITE}/articles/${article.slug}`).sort()
		);
		expect(rss).toContain(`<atom:link href="${SITE}/rss.xml" rel="self"`);
		expect([...rss.matchAll(/<pubDate>/g)]).toHaveLength(publishedArticles.length);
	});

	it('lists every public page in the sitemap with clean production URLs', () => {
		const sitemap = read(join(DIST, 'sitemap-0.xml'));
		const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
		for (const url of urls) {
			expect(url.startsWith(SITE)).toBe(true);
			expect(url).not.toMatch(/\.html$|\/404/);
		}
		for (const article of publishedArticles) {
			expect(urls).toContain(`${SITE}/articles/${article.slug}`);
		}
		for (const article of draftArticles) {
			expect(urls).not.toContain(`${SITE}/articles/${article.slug}`);
		}
	});

	it('points robots.txt at the sitemap', () => {
		expect(read(join(DIST, 'robots.txt'))).toContain(`Sitemap: ${SITE}/sitemap-index.xml`);
	});
});

describe('security headers', () => {
	it('allows every inline script that the build emitted', () => {
		const headers = read(join(DIST, '_headers'));
		for (const file of htmlFiles) {
			for (const hash of inlineScriptHashes(read(file))) {
				expect(headers, `${file} ${hash}`).toContain(hash);
			}
		}
	});

	it('ships no inline scripts except the island bootstrap on pages with islands', () => {
		for (const file of htmlFiles) {
			const html = read(file);
			if (!html.includes('<astro-island')) {
				expect(inlineScriptHashes(html), file).toEqual([]);
			}
		}
	});
});

describe('source sanity', () => {
	it('uses unique article slugs', () => {
		const slugs = sourceArticles.map((article) => article.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
	});
});
