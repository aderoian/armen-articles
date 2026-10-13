import { rehypeHeadingIds, unified } from '@astrojs/markdown-remark';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { rehypeScrollable } from './rehype-scrollable';
import { rehypeTaskLists } from './rehype-task-lists';
import { remarkArticleFeatures } from './remark-article-features';

/**
 * The Markdown/MDX pipeline shared by `.md` and `.mdx` articles. Expressive Code
 * appends its own rehype plugin to this processor for code blocks.
 */
export function markdownProcessor() {
	return unified({
		remarkPlugins: [remarkMath, remarkArticleFeatures],
		rehypePlugins: [
			rehypeHeadingIds,
			[
				rehypeAutolinkHeadings,
				{
					behavior: 'wrap',
					test: ['h2', 'h3', 'h4'],
					properties: { className: ['heading-link'] }
				}
			],
			[rehypeKatex, { output: 'htmlAndMathml', trust: false, strict: 'warn' }],
			rehypeScrollable,
			rehypeTaskLists,
			[
				rehypeExternalLinks,
				{
					rel: ['noopener', 'noreferrer'],
					protocols: ['http', 'https'],
					properties: { className: ['external-link'] },
					content: { type: 'text', value: ' (external link)' },
					contentProperties: { className: ['sr-only'], dataPagefindIgnore: '' }
				}
			]
		]
	});
}
