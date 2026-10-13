export interface CategoryDefinition {
	title: string;
	description: string;
}

/**
 * Article categories. The object key is the value used in article frontmatter
 * and the URL segment for `/categories/{key}`. Every article must reference one
 * of these keys; the content schema rejects anything else at build time.
 */
export const categories = {
	'systems-programming': {
		title: 'Systems Programming',
		description:
			'Memory, concurrency, compilers, and the low-level details of C, C++, and Rust programs.'
	},
	graphics: {
		title: 'Graphics',
		description: 'Rendering pipelines, shaders, and the mathematics behind real-time graphics.'
	},
	tooling: {
		title: 'Tooling',
		description: 'Build systems, developer workflows, and the infrastructure around writing code.'
	},
	'site-notes': {
		title: 'Site Notes',
		description: 'Notes about this publication itself: how it is built and how content is authored.'
	},
	'game-development': {
		title: 'Game Development',
		description:
			'Engine architecture, simulation, physics, and multiplayer networking, mostly from building Gildenkrieg.'
	}
} as const satisfies Record<string, CategoryDefinition>;

export type CategoryKey = keyof typeof categories;

export const categoryKeys = Object.keys(categories) as [CategoryKey, ...CategoryKey[]];
