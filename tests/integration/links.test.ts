import { describe, expect, it } from 'vitest';
import { SITE, distPath, htmlFiles, parseHtml, read, resolveToFile, servedPath } from './helpers';

interface Reference {
	from: string;
	url: string;
}

function internalReferences(): Reference[] {
	const references: Reference[] = [];
	for (const file of htmlFiles) {
		const page = parseHtml(read(file));
		const base = new URL(servedPath(file), SITE);
		for (const el of page.all((node) =>
			['a', 'link', 'img', 'script', 'source'].includes(node.name)
		)) {
			const values = [el.attribs['href'], el.attribs['src']];
			const srcset = el.attribs['srcset'];
			if (srcset) values.push(...srcset.split(',').map((part) => part.trim().split(/\s+/)[0]));
			for (const value of values) {
				if (!value || /^(mailto:|data:|javascript:)/.test(value)) continue;
				const url = new URL(value, base);
				if (url.origin !== SITE) continue;
				references.push({ from: distPath(file), url: url.pathname + url.hash });
			}
		}
	}
	return references;
}

describe('internal links', () => {
	const references = internalReferences();

	it('found links to check', () => {
		expect(references.length).toBeGreaterThan(100);
	});

	it('resolve to a built file under Cloudflare routing rules', () => {
		const broken = references.filter((ref) => !resolveToFile(ref.url));
		expect(broken).toEqual([]);
	});

	it('point at fragments that exist on the target page', () => {
		const idsByFile = new Map<string, Set<string>>();
		const missing: Reference[] = [];
		for (const ref of references) {
			const [path, fragment] = ref.url.split('#');
			if (!fragment) continue;
			const file = resolveToFile(path ?? '/');
			if (!file?.endsWith('.html')) continue;
			if (!idsByFile.has(file)) idsByFile.set(file, parseHtml(read(file)).ids as Set<string>);
			if (!idsByFile.get(file)?.has(decodeURIComponent(fragment))) missing.push(ref);
		}
		expect(missing).toEqual([]);
	});

	it('never link to .html paths or trailing slashes', () => {
		const unclean = references.filter(
			(ref) => /\.html(#|$)/.test(ref.url) || /.\/(#|$)/.test(ref.url)
		);
		expect(unclean).toEqual([]);
	});
});
