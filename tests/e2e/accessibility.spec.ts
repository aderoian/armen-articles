import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = [
	'/',
	'/articles',
	'/articles/feature-tour-code-blocks',
	'/articles/feature-tour-math-and-diagrams',
	'/articles/feature-tour-interactive-mdx',
	'/articles/markdown-reference',
	'/categories',
	'/tags',
	'/series/publication-demo',
	'/search?q=code',
	'/does-not-exist'
];

for (const theme of ['light', 'dark'] as const) {
	test.describe(`axe (${theme})`, () => {
		for (const path of pages) {
			test(`${path} has no WCAG 2.2 AA violations`, async ({ page }) => {
				await page.emulateMedia({ colorScheme: theme });
				await page.goto(path);
				await page.waitForLoadState('networkidle');
				const results = await new AxeBuilder({ page })
					.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
					.analyze();
				const summary = results.violations.map((violation) => ({
					id: violation.id,
					targets: violation.nodes.map((node) => node.target.join(' ')).slice(0, 5)
				}));
				expect(summary).toEqual([]);
			});
		}
	});
}

test('skip link is the first focus stop and moves focus to the content', async ({ page }) => {
	await page.goto('/articles/feature-tour-code-blocks');
	await page.keyboard.press('Tab');
	const skip = page.getByRole('link', { name: 'Skip to content' });
	await expect(skip).toBeFocused();
	await expect(skip).toBeVisible();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/#main-content$/);
	await expect(page.locator('#main-content')).toBeFocused();
});

test('header navigation is reachable by keyboard with visible focus', async ({ page }) => {
	await page.goto('/');
	await page.keyboard.press('Tab');
	await page.keyboard.press('Tab');
	await page.keyboard.press('Tab');
	const focused = page.locator(':focus');
	await expect(focused).toBeVisible();
	const outline = await focused.evaluate((el) => getComputedStyle(el).outlineStyle);
	expect(outline).not.toBe('none');
});

test.describe('mobile layout', () => {
	test.use({ viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true });

	for (const path of [
		'/',
		'/articles/feature-tour-code-blocks',
		'/articles/feature-tour-math-and-diagrams',
		'/articles/markdown-reference'
	]) {
		test(`${path} does not overflow horizontally`, async ({ page }) => {
			await page.goto(path);
			await page.waitForLoadState('networkidle');
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			);
			expect(overflow).toBeLessThanOrEqual(0);
		});
	}

	test('wide code, tables, and equations scroll inside their own containers', async ({ page }) => {
		await page.goto('/articles/feature-tour-code-blocks');
		const longCode = page.locator('.expressive-code pre').last();
		expect(await longCode.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

		await page.goto('/articles/markdown-reference');
		const table = page.getByRole('region', { name: 'Scrollable table' });
		expect(await table.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
	});

	test('shows the table of contents inline instead of in a sidebar', async ({ page }) => {
		await page.goto('/articles/feature-tour-code-blocks');
		await expect(page.locator('details').filter({ hasText: 'On this page' })).toBeVisible();
		await page.getByText('On this page', { exact: true }).first().click();
		await expect(page.getByRole('navigation', { name: 'On this page' })).toBeVisible();
	});
});
