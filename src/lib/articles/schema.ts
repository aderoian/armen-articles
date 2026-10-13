import { z } from 'astro/zod';
import { categories, categoryKeys } from '@/data/categories';
import { series, seriesKeys } from '@/data/series';
import { site } from '@/data/site';
import { normalizeTag, slugify, tagSlug } from '@/lib/utils/slug';

const list = (values: readonly string[]) => values.map((value) => `"${value}"`).join(', ');

const date = (field: string) =>
	z.coerce.date({
		error: `${field} must be a valid date, for example 2026-03-14 or 2026-03-14T09:30:00Z`
	});

const tags = z
	.array(
		z
			.string({ error: 'each tag must be a string' })
			.trim()
			.min(1, 'tags cannot be empty strings')
			.refine((tag) => tagSlug(tag).length > 0, {
				error: 'each tag must contain at least one letter or digit'
			}),
		{ error: 'tags must be a list, for example: tags: [rust, concurrency]' }
	)
	.min(1, 'at least one tag is required')
	.transform((values) => [...new Set(values.map(normalizeTag))]);

/**
 * Build the article frontmatter schema. `image` is Astro's `image()` schema
 * helper (or a stand-in in tests) so cover images are resolved and optimised.
 */
export function createArticleSchema<TImage extends z.ZodType>(image: () => TImage) {
	return z
		.strictObject(
			{
				title: z
					.string({ error: 'title is required' })
					.trim()
					.min(1, 'title cannot be empty')
					.max(120, 'title should be at most 120 characters'),
				description: z
					.string({ error: 'description is required (used for listings and meta tags)' })
					.trim()
					.min(1, 'description cannot be empty')
					.max(240, 'description should be at most 240 characters'),
				publishedAt: date('publishedAt'),
				updatedAt: date('updatedAt').optional(),
				category: z.enum(categoryKeys, {
					error: `category must be one of ${list(Object.keys(categories))} (defined in src/data/categories.ts)`
				}),
				tags,
				draft: z.boolean({ error: 'draft is required and must be true or false' }),
				featured: z.boolean().default(false),
				coverImage: image().optional(),
				coverImageAlt: z.string().trim().min(1, 'coverImageAlt cannot be empty').optional(),
				series: z
					.enum(seriesKeys, {
						error: `series must be one of ${list(Object.keys(series))} (defined in src/data/series.ts)`
					})
					.optional(),
				seriesOrder: z
					.number({ error: 'seriesOrder must be a number' })
					.int('seriesOrder must be a whole number')
					.positive('seriesOrder must be 1 or greater')
					.optional(),
				author: z.string().trim().min(1).default(site.author.name),
				canonicalUrl: z
					.url({
						protocol: /^https$/,
						error: 'canonicalUrl must be an absolute https:// URL'
					})
					.optional(),
				slug: z
					.string()
					.refine((value) => value === slugify(value) && value.length > 0, {
						error: 'slug must be lowercase letters, digits, and single hyphens, e.g. "my-article"'
					})
					.optional()
			},
			{
				error: (issue) =>
					issue.code === 'unrecognized_keys'
						? `unknown frontmatter field(s) ${list(issue.keys)}; check for typos (see docs/authoring.md)`
						: undefined
			}
		)
		.superRefine((data, ctx) => {
			if (data.updatedAt && data.updatedAt < data.publishedAt) {
				ctx.addIssue({
					code: 'custom',
					path: ['updatedAt'],
					message: 'updatedAt must be on or after publishedAt'
				});
			}
			if (data.coverImage !== undefined && !data.coverImageAlt) {
				ctx.addIssue({
					code: 'custom',
					path: ['coverImageAlt'],
					message: 'coverImageAlt is required when coverImage is set (describe the image)'
				});
			}
			if (data.series && data.seriesOrder === undefined) {
				ctx.addIssue({
					code: 'custom',
					path: ['seriesOrder'],
					message: 'seriesOrder is required when series is set'
				});
			}
			if (!data.series && data.seriesOrder !== undefined) {
				ctx.addIssue({
					code: 'custom',
					path: ['series'],
					message: 'series is required when seriesOrder is set'
				});
			}
		});
}
