import { describe, expect, it } from 'vitest';
import { markdownProcessor } from '@/lib/markdown/processor';

// The site's real pipeline (without Expressive Code, which Astro appends at build time).
const processor = await markdownProcessor().createRenderer({ syntaxHighlight: false });

async function render(markdown: string) {
	const result = await processor.render(markdown);
	return { html: result.code, frontmatter: result.metadata.frontmatter };
}

describe('remarkArticleFeatures', () => {
	it('turns mermaid fences into standalone figures with a text alternative', async () => {
		const { html, frontmatter } = await render(
			'```mermaid title="Flow"\nflowchart LR\n  A --> B\n```'
		);
		expect(html).toMatch(
			/^<figure class="mermaid-figure" data-mermaid="flowchart LR\n {2}A --> B"/
		);
		expect(html).toContain('data-title="Flow"');
		expect(html).toContain('<details class="mermaid-source" open>');
		expect(html).toContain('<figcaption>Flow</figcaption>');
		expect(html).not.toContain('<pre><figure');
		expect(frontmatter).toMatchObject({ hasMermaid: true, hasMath: false });
	});

	it('leaves ordinary code blocks alone', async () => {
		const { html, frontmatter } = await render('```js\nconst a = 1;\n```');
		expect(html).toContain('<pre');
		expect(html).not.toContain('mermaid-figure');
		expect(frontmatter).toMatchObject({ hasMermaid: false, hasMath: false });
	});

	it('detects inline and display math', async () => {
		expect((await render('Inline $x^2$ math.')).frontmatter).toMatchObject({ hasMath: true });
		expect((await render('$$\na + b\n$$')).frontmatter).toMatchObject({ hasMath: true });
	});
});

describe('links and headings', () => {
	it('marks external links and links section headings to themselves', async () => {
		const { html } = await render('## Setup\n\nSee [the spec](https://spec.commonmark.org/).');
		expect(html).toContain('<h2 id="setup"><a class="heading-link" href="#setup">Setup</a></h2>');
		expect(html).toContain(
			'<a href="https://spec.commonmark.org/" class="external-link" rel="noopener noreferrer">the spec<span class="sr-only" data-pagefind-ignore=""> (external link)</span></a>'
		);
	});
});

describe('rehypeScrollable', () => {
	it('wraps tables in a focusable, labelled scroll region', async () => {
		const { html } = await render('| a | b |\n| - | - |\n| 1 | 2 |');
		expect(html).toMatch(
			/^<div class="table-scroll" tabindex="0" role="region" aria-label="Scrollable table">\s*<table>/
		);
	});

	it('makes display math keyboard-scrollable', async () => {
		const { html } = await render('$$\na + b\n$$');
		expect(html).toMatch(/<span class="katex-display" tabindex="0">/);
	});
});

describe('rehypeTaskLists', () => {
	it('labels task list checkboxes with their item text', async () => {
		const { html } = await render('- [x] Ship **the** build\n- [ ] Write docs');
		expect(html).toContain('aria-label="Ship the build"');
		expect(html).toContain('aria-label="Write docs"');
	});
});
