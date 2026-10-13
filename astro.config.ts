import { rehypeHeadingIds, unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import tailwindcss from '@tailwindcss/vite';
import expressiveCode from 'astro-expressive-code';
import { defineConfig } from 'astro/config';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { site } from './src/data/site';
import { rehypeScrollable } from './src/lib/markdown/rehype-scrollable';
import { remarkArticleFeatures } from './src/lib/markdown/remark-article-features';

export default defineConfig({
	site: site.url,
	trailingSlash: 'never',
	build: {
		format: 'file'
	},
	devToolbar: { enabled: false },
	markdown: {
		processor: unified({
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
				[
					rehypeExternalLinks,
					{
						rel: ['noopener', 'noreferrer'],
						protocols: ['http', 'https'],
						properties: { className: ['external-link'] },
						content: {
							type: 'element',
							tagName: 'span',
							properties: { className: ['sr-only'] },
							children: [{ type: 'text', value: ' (external link)' }]
						}
					}
				]
			]
		})
	},
	integrations: [
		expressiveCode({
			themes: ['github-light', 'github-dark'],
			themeCssSelector: (theme) => `[data-theme='${theme.type}']`,
			useDarkModeMediaQuery: false,
			plugins: [pluginLineNumbers()],
			defaultProps: {
				showLineNumbers: false,
				overridesByLang: {
					'bash,sh,shell,console,powershell': { frame: 'terminal' }
				}
			},
			styleOverrides: {
				borderRadius: '0.5rem',
				borderColor: 'var(--color-border)',
				codeFontFamily: 'var(--font-mono)',
				codeFontSize: '0.875rem',
				uiFontFamily: 'var(--font-sans)',
				frames: {
					shadowColor: 'transparent'
				}
			}
		}),
		mdx(),
		react(),
		sitemap({
			filter: (page) => !/\/404(\.html)?$/.test(page)
		})
	],
	vite: {
		plugins: [tailwindcss()],
		build: {
			// Emit every script as a file so pages carry no inline executable code.
			assetsInlineLimit: 0,
			// Mermaid's optional layout engines are large lazy chunks, loaded only on demand.
			chunkSizeWarningLimit: 1600
		}
	}
});
