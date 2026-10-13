import { site } from '@/data/site';
import { tagSlug } from './slug';

export const routes = {
	home: '/',
	articles: '/articles',
	articlesPage: (page: number) => (page <= 1 ? '/articles' : `/articles/page/${page}`),
	article: (slug: string) => `/articles/${slug}`,
	categories: '/categories',
	category: (key: string) => `/categories/${key}`,
	tags: '/tags',
	tag: (tag: string) => `/tags/${tagSlug(tag)}`,
	seriesIndex: '/series',
	series: (key: string) => `/series/${key}`,
	search: '/search',
	rss: '/rss.xml'
} as const;

/**
 * Public path for a generated page. Static builds emit `foo.html` and
 * `index.html` files, but the site is served at `/foo` and `/`.
 */
export function publicPath(pathname: string): string {
	const path = pathname
		.replace(/\.html$/, '')
		.replace(/\/index$/, '')
		.replace(/\/+$/, '');
	return path === '' ? '/' : path;
}

/** Resolve a site-relative path against the production origin. */
export function absoluteUrl(path: string, base: string = site.url): string {
	return new URL(path, base).toString();
}
