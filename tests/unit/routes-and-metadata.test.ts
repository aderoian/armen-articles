import { describe, expect, it } from 'vitest';
import { articleJsonLd, breadcrumbJsonLd, serializeJsonLd } from '@/lib/metadata/structured-data';
import { absoluteUrl, publicPath, routes } from '@/lib/utils/routes';

describe('routes', () => {
	it('builds stable article URLs without category or date segments', () => {
		expect(routes.article('my-post')).toBe('/articles/my-post');
	});

	it('uses /articles for page 1 and /articles/page/N afterwards', () => {
		expect(routes.articlesPage(1)).toBe('/articles');
		expect(routes.articlesPage(3)).toBe('/articles/page/3');
	});

	it('slugifies tags in tag URLs', () => {
		expect(routes.tag('C++')).toBe('/tags/cpp');
	});
});

describe('publicPath', () => {
	it.each([
		['/index.html', '/'],
		['/articles.html', '/articles'],
		['/articles/foo.html', '/articles/foo'],
		['/articles/foo/', '/articles/foo'],
		['/articles/page/2', '/articles/page/2'],
		['/', '/']
	])('%s → %s', (input, expected) => {
		expect(publicPath(input)).toBe(expected);
	});
});

describe('absoluteUrl', () => {
	it('resolves against the production origin', () => {
		expect(absoluteUrl('/articles/foo')).toBe('https://articles.armenderoian.dev/articles/foo');
	});
});

describe('structured data', () => {
	it('describes an article with modified date falling back to published date', () => {
		const data = articleJsonLd({
			title: 'Title',
			description: 'Description',
			url: 'https://articles.armenderoian.dev/articles/foo',
			publishedAt: new Date('2026-01-02T00:00:00Z'),
			author: 'Armen Deroian',
			keywords: ['a', 'b'],
			section: 'Graphics'
		});
		expect(data).toMatchObject({
			'@type': 'TechArticle',
			headline: 'Title',
			datePublished: '2026-01-02T00:00:00.000Z',
			dateModified: '2026-01-02T00:00:00.000Z',
			keywords: 'a, b',
			author: { name: 'Armen Deroian', url: 'https://armenderoian.dev' }
		});
		expect(data).not.toHaveProperty('image');
	});

	it('numbers breadcrumb items with absolute URLs', () => {
		expect(breadcrumbJsonLd([{ name: 'Articles', path: '/articles' }]).itemListElement).toEqual([
			{
				'@type': 'ListItem',
				position: 1,
				name: 'Articles',
				item: 'https://articles.armenderoian.dev/articles'
			}
		]);
	});

	it('escapes < so JSON-LD cannot close its script element', () => {
		const json = serializeJsonLd({ title: '</script><script>alert(1)</script>' });
		expect(json).not.toContain('<');
		expect(JSON.parse(json)).toEqual({ title: '</script><script>alert(1)</script>' });
	});
});
