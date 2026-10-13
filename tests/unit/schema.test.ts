import { z } from 'astro/zod';
import { describe, expect, it } from 'vitest';
import { createArticleSchema } from '@/lib/articles/schema';

// Stand-in for Astro's image() helper: accept any string path.
const schema = createArticleSchema(() => z.string());

const valid = {
	title: 'A valid article',
	description: 'Explains something useful.',
	publishedAt: '2026-03-14',
	category: 'graphics',
	tags: ['Math', 'math', ' Shaders '],
	draft: false
};

function issues(input: Record<string, unknown>): string[] {
	const result = schema.safeParse(input);
	if (result.success) return [];
	return result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

describe('article schema', () => {
	it('accepts valid frontmatter and applies defaults', () => {
		const data = schema.parse(valid);
		expect(data.publishedAt).toEqual(new Date('2026-03-14'));
		expect(data.featured).toBe(false);
		expect(data.author).toBe('Armen Deroian');
	});

	it('normalises and de-duplicates tags', () => {
		expect(schema.parse(valid).tags).toEqual(['math', 'shaders']);
	});

	it.each(['title', 'description', 'publishedAt', 'category', 'tags', 'draft'])(
		'requires %s',
		(field) => {
			const input: Record<string, unknown> = { ...valid };
			delete input[field];
			expect(issues(input).some((message) => message.startsWith(`${field}:`))).toBe(true);
		}
	);

	it('lists the allowed categories when the category is unknown', () => {
		expect(issues({ ...valid, category: 'gaming' })).toEqual([
			expect.stringMatching(
				/category: category must be one of .*"graphics".*src\/data\/categories\.ts/
			)
		]);
	});

	it('rejects invalid dates and updates before publication', () => {
		expect(issues({ ...valid, publishedAt: 'yesterday' })[0]).toMatch(/publishedAt: .*valid date/);
		expect(issues({ ...valid, updatedAt: '2026-01-01' })).toEqual([
			'updatedAt: updatedAt must be on or after publishedAt'
		]);
	});

	it('rejects unknown fields to catch typos', () => {
		expect(issues({ ...valid, tag: ['oops'] })[0]).toMatch(/unknown frontmatter field\(s\) "tag"/);
	});

	it('requires alt text for cover images', () => {
		expect(issues({ ...valid, coverImage: './cover.png' })).toEqual([
			expect.stringMatching(/^coverImageAlt: coverImageAlt is required/)
		]);
		expect(issues({ ...valid, coverImage: './cover.png', coverImageAlt: 'A diagram' })).toEqual([]);
	});

	it('requires series and seriesOrder together', () => {
		expect(issues({ ...valid, series: 'publication-demo' })).toEqual([
			'seriesOrder: seriesOrder is required when series is set'
		]);
		expect(issues({ ...valid, seriesOrder: 2 })).toEqual([
			'series: series is required when seriesOrder is set'
		]);
		expect(issues({ ...valid, series: 'publication-demo', seriesOrder: 0 })[0]).toMatch(
			/seriesOrder must be 1 or greater/
		);
		expect(issues({ ...valid, series: 'unknown', seriesOrder: 1 })[0]).toMatch(
			/series must be one of/
		);
	});

	it('only accepts https canonical URLs', () => {
		expect(issues({ ...valid, canonicalUrl: 'https://example.com/post' })).toEqual([]);
		expect(issues({ ...valid, canonicalUrl: 'http://example.com/post' })[0]).toMatch(
			/canonicalUrl must be an absolute https/
		);
		expect(issues({ ...valid, canonicalUrl: 'javascript:alert(1)' })).toHaveLength(1);
	});

	it('validates slug overrides', () => {
		expect(issues({ ...valid, slug: 'my-article' })).toEqual([]);
		expect(issues({ ...valid, slug: 'My Article' })[0]).toMatch(/slug must be lowercase/);
	});

	it('rejects empty and symbol-only tags', () => {
		expect(issues({ ...valid, tags: [] })[0]).toMatch(/at least one tag/);
		expect(issues({ ...valid, tags: ['!!!'] })[0]).toMatch(/at least one letter or digit/);
	});
});
