import type { ElementContent } from 'hast';
import type { Code, Root, RootContent } from 'mdast';
import { visit } from 'unist-util-visit';
import type { VFile } from 'vfile';

export interface ArticleFeatures {
	hasMath: boolean;
	hasMermaid: boolean;
}

const TITLE_META = /title="([^"]*)"/;

function mermaidFigureChildren(source: string, title: string | undefined): ElementContent[] {
	const children: ElementContent[] = [
		{
			type: 'element',
			tagName: 'div',
			properties: { className: ['mermaid-render'] },
			children: []
		},
		{
			type: 'element',
			tagName: 'details',
			properties: { className: ['mermaid-source'], open: true },
			children: [
				{
					type: 'element',
					tagName: 'summary',
					properties: {},
					children: [{ type: 'text', value: 'Diagram source' }]
				},
				{
					type: 'element',
					tagName: 'pre',
					properties: { tabIndex: 0 },
					children: [{ type: 'text', value: source }]
				}
			]
		}
	];
	if (title) {
		children.push({
			type: 'element',
			tagName: 'figcaption',
			properties: {},
			children: [{ type: 'text', value: title }]
		});
	}
	return children;
}

/**
 * Turns ```mermaid fences into `<figure data-mermaid>` elements (rendered in the
 * browser by the Mermaid island; the source stays available as a text
 * alternative) and records which heavy features an article uses so that their
 * assets are only loaded where needed. Flags are exposed through
 * `remarkPluginFrontmatter` from `render(entry)`.
 */
export function remarkArticleFeatures() {
	return (tree: Root, file: VFile) => {
		const features: ArticleFeatures = { hasMath: false, hasMermaid: false };

		visit(tree, (node) => {
			const type: string = node.type;
			if (type === 'math' || type === 'inlineMath') {
				features.hasMath = true;
			}
		});

		visit(tree, 'code', (node: Code, index, parent) => {
			if (node.lang !== 'mermaid' || !parent || index === undefined) return;
			features.hasMermaid = true;
			const title = node.meta?.match(TITLE_META)?.[1];
			// A custom node (rather than `code`) so remark-rehype emits a bare <figure>
			// instead of wrapping it in <pre>, and Expressive Code leaves it alone.
			const figure = {
				type: 'mermaidFigure',
				data: {
					hName: 'figure',
					hProperties: {
						className: ['mermaid-figure'],
						dataMermaid: node.value,
						...(title ? { dataTitle: title } : {})
					},
					hChildren: mermaidFigureChildren(node.value, title)
				}
			};
			parent.children[index] = figure as unknown as RootContent;
		});

		file.data.astro ??= {};
		file.data.astro.frontmatter = { ...file.data.astro.frontmatter, ...features };
	};
}
