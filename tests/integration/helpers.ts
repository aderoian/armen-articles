import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { DomUtils, parseDocument } from 'htmlparser2';
import { articleSlugFromPath } from '@/lib/utils/slug';

export const SITE = 'https://articles.armenderoian.dev';
export const DIST = join(import.meta.dirname, '../../dist');
const CONTENT = join(import.meta.dirname, '../../src/content/articles');

if (!existsSync(join(DIST, 'index.html'))) {
	throw new Error('dist/ is missing. Run `npm run build` before the integration tests.');
}

export function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? walk(path) : [path];
	});
}

export const distFiles = walk(DIST);
export const htmlFiles = distFiles.filter((file) => file.endsWith('.html'));
export const read = (file: string) => readFileSync(file, 'utf8');
export const distPath = (file: string) => `/${relative(DIST, file).split(sep).join('/')}`;

/** Site path served for a built HTML file (`/articles/foo.html` → `/articles/foo`). */
export function servedPath(file: string): string {
	const path = distPath(file)
		.replace(/\.html$/, '')
		.replace(/\/index$/, '');
	return path === '' ? '/' : path;
}

/**
 * Resolve a site path to a file in dist/ using Cloudflare's `auto-trailing-slash`
 * rules: exact file, then `path.html`, then `path/index.html`.
 */
export function resolveToFile(path: string): string | undefined {
	const clean = decodeURIComponent(path.split(/[?#]/)[0] ?? '/').replace(/\/+$/, '');
	const candidates =
		clean === '' ? ['/index.html'] : [clean, `${clean}.html`, `${clean}/index.html`];
	return candidates
		.map((candidate) => join(DIST, candidate))
		.find((file) => existsSync(file) && statSync(file).isFile());
}

export function parseHtml(html: string) {
	const document = parseDocument(html);
	const all = (
		predicate: (el: ReturnType<typeof DomUtils.getElementsByTagName>[number]) => boolean
	) => DomUtils.findAll(predicate, document.children);
	return {
		document,
		all,
		byTag: (tag: string) => DomUtils.getElementsByTagName(tag, document.children, true),
		meta: (key: string) =>
			all(
				(el) => el.name === 'meta' && (el.attribs['name'] === key || el.attribs['property'] === key)
			)[0]?.attribs['content'],
		link: (rel: string) =>
			all((el) => el.name === 'link' && el.attribs['rel'] === rel)[0]?.attribs['href'],
		text: (el: Parameters<typeof DomUtils.textContent>[0]) => DomUtils.textContent(el).trim(),
		ids: new Set(all((el) => typeof el.attribs['id'] === 'string').map((el) => el.attribs['id']))
	};
}

export interface SourceArticle {
	slug: string;
	title: string;
	draft: boolean;
	series?: string;
	seriesOrder?: number;
}

/** Article metadata read straight from the Markdown sources, independent of the build. */
export const sourceArticles: SourceArticle[] = walk(CONTENT)
	.filter((file) => /\.mdx?$/.test(file) && !file.split(sep).at(-1)?.startsWith('_'))
	.map((file) => {
		const { frontmatter } = parseFrontmatter(readFileSync(file, 'utf8'));
		return {
			slug:
				typeof frontmatter['slug'] === 'string'
					? frontmatter['slug']
					: articleSlugFromPath(relative(CONTENT, file)),
			title: String(frontmatter['title']),
			draft: frontmatter['draft'] === true,
			series: frontmatter['series'],
			seriesOrder: frontmatter['seriesOrder']
		};
	});

export const publishedArticles = sourceArticles.filter((article) => !article.draft);
export const draftArticles = sourceArticles.filter((article) => article.draft);

export interface PagefindFragment {
	url: string;
	content: string;
	meta: Record<string, string>;
	anchors: { element: string; id: string; text: string }[];
}

export function pagefindFragments(): PagefindFragment[] {
	const dir = join(DIST, 'pagefind/fragment');
	return readdirSync(dir).map((name) => {
		const raw = gunzipSync(readFileSync(join(dir, name))).toString('utf8');
		return JSON.parse(raw.replace(/^pagefind_dcd/, '')) as PagefindFragment;
	});
}
