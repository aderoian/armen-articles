import type { MermaidConfig } from 'mermaid';

type Theme = 'light' | 'dark';

const palettes: Record<Theme, NonNullable<MermaidConfig['themeVariables']>> = {
	light: {
		darkMode: false,
		background: '#fbfcfd',
		primaryColor: '#e3f1f5',
		primaryTextColor: '#0f1a24',
		primaryBorderColor: '#0b6378',
		secondaryColor: '#f1f5f8',
		tertiaryColor: '#ffffff',
		lineColor: '#4a5d6e',
		textColor: '#0f1a24',
		noteBkgColor: '#fff4e0',
		noteTextColor: '#0f1a24',
		noteBorderColor: '#8a4b00',
		edgeLabelBackground: '#fbfcfd',
		clusterBkg: '#f1f5f8',
		clusterBorder: '#9fb1c0'
	},
	dark: {
		darkMode: true,
		background: '#0b1118',
		primaryColor: '#14303a',
		primaryTextColor: '#e6eef5',
		primaryBorderColor: '#6ccbe5',
		secondaryColor: '#121b26',
		tertiaryColor: '#0b1118',
		lineColor: '#9db0c1',
		textColor: '#e6eef5',
		noteBkgColor: '#33240d',
		noteTextColor: '#e6eef5',
		noteBorderColor: '#ffc266',
		edgeLabelBackground: '#0b1118',
		clusterBkg: '#121b26',
		clusterBorder: '#4a6075'
	}
};

let renderId = 0;
let pending: Promise<void> = Promise.resolve();

async function renderAll(figures: HTMLElement[]): Promise<void> {
	const { default: mermaid } = await import('mermaid');
	const theme: Theme = document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light';
	mermaid.initialize({
		startOnLoad: false,
		securityLevel: 'strict',
		theme: 'base',
		fontFamily: getComputedStyle(document.body).fontFamily,
		themeVariables: palettes[theme]
	});

	for (const figure of figures) {
		const target = figure.querySelector<HTMLElement>('.mermaid-render');
		const source = figure.dataset['mermaid'];
		if (!target || !source) continue;
		try {
			const { svg } = await mermaid.render(`mermaid-diagram-${++renderId}`, source);
			// Mermaid sanitises its SVG output with DOMPurify under securityLevel "strict".
			target.innerHTML = svg;
			const element = target.querySelector('svg');
			if (element) {
				element.setAttribute('role', 'img');
				if (!element.hasAttribute('aria-labelledby')) {
					element.setAttribute('aria-label', figure.dataset['title'] ?? 'Diagram');
				}
			}
			if (!figure.hasAttribute('data-rendered')) {
				figure.setAttribute('data-rendered', '');
				figure.querySelector('details')?.removeAttribute('open');
			}
		} catch (error) {
			figure.setAttribute('data-error', '');
			console.error('Failed to render Mermaid diagram', error);
		}
	}
}

/** Render (or re-render after a theme change) every diagram, one pass at a time. */
export function renderDiagrams(figures: HTMLElement[]): Promise<void> {
	pending = pending
		.then(() => renderAll(figures))
		.catch((error: unknown) => console.error('Failed to load Mermaid', error));
	return pending;
}
