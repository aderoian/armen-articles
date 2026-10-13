export const WORDS_PER_MINUTE = 225;

/**
 * Count readable words in a Markdown/MDX body. MDX import/export statements,
 * HTML/JSX tags, URLs, and Markdown punctuation are ignored; code and math are
 * counted because readers spend time on them too.
 */
export function countWords(markdown: string): number {
	const text = markdown
		.replace(/^\s*(import|export)\s.*$/gm, ' ')
		.replace(/<[^>\n]+>/g, ' ')
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/https?:\/\/\S+/g, ' ')
		.replace(/[`*_~#>|=\-[\]{}()$\\]+/g, ' ');
	return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

export interface ReadingTime {
	words: number;
	minutes: number;
}

export function readingTime(markdown: string, wordsPerMinute = WORDS_PER_MINUTE): ReadingTime {
	const words = countWords(markdown);
	return { words, minutes: Math.max(1, Math.round(words / wordsPerMinute)) };
}
