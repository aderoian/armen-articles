export interface SeriesDefinition {
	title: string;
	description: string;
}

/**
 * Article series. The object key is the value used in the `series` frontmatter
 * field and the URL segment for `/series/{key}`. Articles in a series are ordered
 * by their `seriesOrder` field, not by publication date.
 */
export const series = {
	'publication-demo': {
		title: 'Publication Feature Tour',
		description:
			'A demonstration series that walks through the rendering features of this site: code, math, diagrams, and interactive components.'
	}
} as const satisfies Record<string, SeriesDefinition>;

export type SeriesKey = keyof typeof series;

export const seriesKeys = Object.keys(series) as [SeriesKey, ...SeriesKey[]];
