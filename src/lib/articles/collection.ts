import { getCollection, type CollectionEntry } from 'astro:content';
import { filterVisible, sortByNewest } from './filters';
import { assertUniqueSeriesOrder } from './series';

export type Article = CollectionEntry<'articles'>;

/**
 * Drafts are only ever rendered by the dev server (`astro dev`). Production
 * builds and previews never include them in routes, listings, feeds, or search.
 */
export const includeDrafts = import.meta.env.DEV;

/** Every visible article, newest first. */
export async function getArticles(): Promise<Article[]> {
	const all = await getCollection('articles');
	assertUniqueSeriesOrder(all);
	return sortByNewest(filterVisible(all, { includeDrafts }));
}
