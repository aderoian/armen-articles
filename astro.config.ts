import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import tailwindcss from '@tailwindcss/vite';
import expressiveCode from 'astro-expressive-code';
import { defineConfig } from 'astro/config';
import { site } from './src/data/site';
import { markdownProcessor } from './src/lib/markdown/processor';

export default defineConfig({
	site: site.url,
	trailingSlash: 'never',
	build: {
		format: 'file'
	},
	devToolbar: { enabled: false },
	markdown: {
		processor: markdownProcessor()
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
				},
				lineNumbers: {
					foreground: 'var(--theme-muted)',
					highlightForeground: 'var(--theme-text)'
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
