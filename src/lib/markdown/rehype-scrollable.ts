import type { Element, Root } from 'hast';
import { visit } from 'unist-util-visit';

function hasClass(node: Element, className: string): boolean {
	const value = node.properties['className'];
	return Array.isArray(value) && value.includes(className);
}

/**
 * Wide tables and display equations scroll horizontally on narrow screens.
 * Wrap tables in a labelled, focusable region and make display math focusable
 * so keyboard users can scroll them too (WCAG 2.1.1).
 */
export function rehypeScrollable() {
	return (tree: Root) => {
		visit(tree, 'element', (node, index, parent) => {
			if (node.tagName === 'table' && parent && index !== undefined) {
				const isWrapped = parent.type === 'element' && hasClass(parent, 'table-scroll');
				if (isWrapped) return;
				parent.children[index] = {
					type: 'element',
					tagName: 'div',
					properties: {
						className: ['table-scroll'],
						tabIndex: 0,
						role: 'region',
						ariaLabel: 'Scrollable table'
					},
					children: [node]
				};
				return;
			}
			if (hasClass(node, 'katex-display')) {
				node.properties['tabIndex'] = 0;
			}
		});
	};
}
