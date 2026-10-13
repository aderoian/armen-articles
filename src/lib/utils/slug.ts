/**
 * Convert arbitrary text into a URL-safe, lowercase, hyphen-separated slug.
 * Diacritics are stripped (`Ångström` → `angstrom`) and apostrophes are dropped
 * so that `don't` becomes `dont` rather than `don-t`.
 */
export function slugify(input: string): string {
	return input
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/['’]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Derive an article's URL slug from its path relative to the articles directory.
 *
 * Only the file name participates (folders are ignored), so articles can be
 * reorganised into subdirectories without changing their URLs. A file named
 * `index.md`/`index.mdx` takes the name of its parent folder, which allows
 * co-locating images next to the article.
 */
export function articleSlugFromPath(entryPath: string): string {
	const segments = entryPath.replace(/\\/g, '/').split('/').filter(Boolean);
	const fileName = segments.at(-1) ?? '';
	const baseName = fileName.replace(/\.(md|mdx)$/i, '');
	const name = baseName.toLowerCase() === 'index' ? (segments.at(-2) ?? '') : baseName;
	const slug = slugify(name);
	if (!slug) {
		throw new Error(`Cannot derive an article slug from "${entryPath}".`);
	}
	return slug;
}

/** Normalise a tag for display and comparison: trimmed, single-spaced, lowercase. */
export function normalizeTag(tag: string): string {
	return tag.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * URL segment for a tag. Symbols that carry meaning in technical tags are
 * spelled out before slugifying so that `c++`, `c#`, and `c` stay distinct.
 */
export function tagSlug(tag: string): string {
	return slugify(
		normalizeTag(tag)
			.replace(/\+\+/g, 'pp')
			.replace(/\+/g, ' plus ')
			.replace(/#/g, 'sharp')
			.replace(/(^|\s)\.(?=[a-z0-9])/g, '$1dot')
	);
}
