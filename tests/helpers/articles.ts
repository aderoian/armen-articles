import type { ArticleData, ArticleLike } from '@/lib/articles/types';

export function makeArticle(id: string, data: Partial<ArticleData> = {}): ArticleLike {
	return {
		id,
		body: '',
		data: {
			title: id,
			description: `Description of ${id}`,
			publishedAt: new Date('2026-01-01'),
			category: 'tooling',
			tags: [],
			draft: false,
			featured: false,
			...data
		}
	};
}

export const ids = (articles: ArticleLike[]) => articles.map((article) => article.id);
