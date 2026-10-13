import { describe, expect, it } from 'vitest';
import { countWords, readingTime, WORDS_PER_MINUTE } from '@/lib/articles/reading-time';

describe('countWords', () => {
	it('counts plain words', () => {
		expect(countWords('One two three.')).toBe(3);
	});

	it('ignores Markdown syntax, link targets, and MDX imports', () => {
		const markdown = [
			"import Callout from '@/components/ui/Callout.astro';",
			'## A heading',
			'Read the [docs](https://example.com/very/long/path) **now**.',
			'<Callout type="tip">Hello</Callout>'
		].join('\n');
		expect(countWords(markdown)).toBe(7);
	});

	it('returns zero for empty content', () => {
		expect(countWords('')).toBe(0);
		expect(countWords('---\n\n***')).toBe(0);
	});
});

describe('readingTime', () => {
	it('rounds to whole minutes with a minimum of one', () => {
		expect(readingTime('short').minutes).toBe(1);
		expect(readingTime('word '.repeat(WORDS_PER_MINUTE * 3)).minutes).toBe(3);
		expect(readingTime('word '.repeat(Math.round(WORDS_PER_MINUTE * 4.6))).minutes).toBe(5);
	});

	it('supports a custom reading speed', () => {
		expect(readingTime('word '.repeat(400), 100)).toEqual({ words: 400, minutes: 4 });
	});
});
