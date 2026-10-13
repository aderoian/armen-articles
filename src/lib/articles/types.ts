/**
 * The subset of an article collection entry that content logic depends on.
 * Kept independent of `astro:content` so the logic can be unit tested with
 * plain objects; real `CollectionEntry<'articles'>` values satisfy it.
 */
export interface ArticleData {
	title: string;
	description: string;
	publishedAt: Date;
	updatedAt?: Date | undefined;
	category: string;
	tags: string[];
	draft: boolean;
	featured: boolean;
	series?: string | undefined;
	seriesOrder?: number | undefined;
}

export interface ArticleLike {
	id: string;
	data: ArticleData;
	body?: string | undefined;
}
