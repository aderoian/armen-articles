import type { Element, ElementContent, Root } from 'hast';
import { visit } from 'unist-util-visit';

function textContent(nodes: ElementContent[]): string {
	return nodes
		.map((node) => {
			if (node.type === 'text') return node.value;
			if (node.type === 'element') return textContent(node.children);
			return '';
		})
		.join('');
}

function isCheckbox(node: ElementContent): node is Element {
	return (
		node.type === 'element' && node.tagName === 'input' && node.properties['type'] === 'checkbox'
	);
}

/**
 * GFM task list checkboxes are rendered without a label. Name each one after
 * its list item so assistive technology announces what is (or isn't) done.
 */
export function rehypeTaskLists() {
	return (tree: Root) => {
		visit(tree, 'element', (node) => {
			if (node.tagName !== 'li') return;
			const checkbox = node.children.find(isCheckbox);
			if (!checkbox || checkbox.properties['ariaLabel']) return;
			const label = textContent(node.children).replace(/\s+/g, ' ').trim();
			if (label) checkbox.properties['ariaLabel'] = label;
		});
	};
}
