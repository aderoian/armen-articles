import { site } from '@/data/site';
import { absoluteUrl } from '@/lib/utils/routes';

export interface BreadcrumbItem {
	name: string;
	path: string;
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((item, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: item.name,
			item: absoluteUrl(item.path)
		}))
	};
}

export interface ArticleJsonLdInput {
	title: string;
	description: string;
	url: string;
	publishedAt: Date;
	updatedAt?: Date | undefined;
	author: string;
	image?: string | undefined;
	keywords: string[];
	section: string;
}

export function articleJsonLd(input: ArticleJsonLdInput) {
	return {
		'@context': 'https://schema.org',
		'@type': 'TechArticle',
		headline: input.title,
		description: input.description,
		url: input.url,
		mainEntityOfPage: { '@type': 'WebPage', '@id': input.url },
		datePublished: input.publishedAt.toISOString(),
		dateModified: (input.updatedAt ?? input.publishedAt).toISOString(),
		author: {
			'@type': 'Person',
			name: input.author,
			...(input.author === site.author.name ? { url: site.author.url } : {})
		},
		publisher: { '@type': 'Person', name: site.author.name, url: site.author.url },
		articleSection: input.section,
		keywords: input.keywords.join(', '),
		inLanguage: site.language,
		...(input.image ? { image: input.image } : {})
	};
}

/**
 * Serialise JSON-LD for embedding in a `<script type="application/ld+json">`.
 * `<` is escaped so content can never close the script element early.
 */
export function serializeJsonLd(data: unknown): string {
	return JSON.stringify(data).replace(/</g, '\\u003c');
}
