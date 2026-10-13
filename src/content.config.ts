import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { createArticleSchema } from '@/lib/articles/schema';
import { articleSlugFromPath } from '@/lib/utils/slug';

const articles = defineCollection({
	loader: glob({
		pattern: '**/[^_]*.{md,mdx}',
		base: './src/content/articles',
		generateId: ({ entry, data }) =>
			typeof data['slug'] === 'string' && data['slug'] ? data['slug'] : articleSlugFromPath(entry)
	}),
	schema: ({ image }) => createArticleSchema(image)
});

export const collections = { articles };
