import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { categories } from '@/data/categories';
import { site } from '@/data/site';
import { getArticles } from '@/lib/articles/collection';
import { filterPublished } from '@/lib/articles/filters';
import { absoluteUrl, routes } from '@/lib/utils/routes';

const escapeXml = (value: string) =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async () => {
	const articles = filterPublished(await getArticles());
	return rss({
		title: site.name,
		description: site.description,
		site: site.url,
		trailingSlash: false,
		xmlns: { atom: 'http://www.w3.org/2005/Atom', dc: 'http://purl.org/dc/elements/1.1/' },
		customData: [
			`<language>${site.locale.toLowerCase()}</language>`,
			`<atom:link href="${absoluteUrl(routes.rss)}" rel="self" type="application/rss+xml" />`
		].join(''),
		items: articles.map((article) => ({
			title: article.data.title,
			description: article.data.description,
			link: routes.article(article.id),
			pubDate: article.data.publishedAt,
			customData: `<dc:creator>${escapeXml(article.data.author)}</dc:creator>`,
			categories: [categories[article.data.category].title, ...article.data.tags]
		}))
	});
};
