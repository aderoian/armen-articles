import { expect, test } from '@playwright/test';

test.describe('search', () => {
	test('finds published articles from the homepage form', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('searchbox', { name: 'Search articles' }).fill('two’s complement');
		await page.getByRole('button', { name: 'Search' }).click();
		await expect(page).toHaveURL(/\/search\?q=/);
		const results = page.getByRole('list', { name: 'Search results' });
		await expect(results.getByRole('link', { name: /Interactive Components/ })).toBeVisible();
		await expect(page.getByRole('status')).toContainText(/match/);
	});

	test('is keyboard accessible and never returns drafts', async ({ page }) => {
		await page.goto('/search');
		const input = page.getByRole('searchbox', { name: 'Search articles' });
		await expect(input).toBeFocused();
		await input.pressSequentially('draft');
		await expect(page.getByRole('status')).toContainText(/match/);
		await expect(page.getByText('Draft Preview Example')).toHaveCount(0);

		await input.fill('');
		await input.pressSequentially('mermaid');
		const first = page.getByRole('list', { name: 'Search results' }).getByRole('link').first();
		await expect(first).toBeVisible();
		await input.press('ArrowDown');
		await expect(first).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/\/articles\//);
	});

	test('reports when nothing matches', async ({ page }) => {
		await page.goto('/search?q=qwertyuiopasdf');
		await expect(page.getByRole('status')).toHaveText(/No articles match/);
	});
});

test.describe('theme', () => {
	test('defaults to the system preference', async ({ browser }) => {
		const context = await browser.newContext({ colorScheme: 'dark' });
		const page = await context.newPage();
		await page.goto('/');
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		await context.close();
	});

	test('toggle switches themes and persists across pages', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'light' });
		await page.goto('/');
		const html = page.locator('html');
		await expect(html).toHaveAttribute('data-theme', 'light');
		const toggle = page.getByRole('button', { name: 'Dark theme' });
		await expect(toggle).toHaveAttribute('aria-pressed', 'false');

		await toggle.click();
		await expect(html).toHaveAttribute('data-theme', 'dark');
		await expect(toggle).toHaveAttribute('aria-pressed', 'true');

		await page.goto('/articles');
		await expect(html).toHaveAttribute('data-theme', 'dark');
	});

	test('re-renders diagrams for the new theme', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'light' });
		await page.goto('/articles/feature-tour-math-and-diagrams');
		const svg = page.locator('figure[data-rendered] svg').first();
		await expect(svg).toBeVisible();
		const before = await svg.innerHTML();
		await page.getByRole('button', { name: 'Dark theme' }).click();
		await expect.poll(async () => svg.innerHTML()).not.toBe(before);
	});
});

test.describe('rendering', () => {
	test('renders math at build time and diagrams only where used', async ({ page }) => {
		const mermaidRequests: string[] = [];
		page.on('request', (request) => {
			if (/mermaid/i.test(request.url())) mermaidRequests.push(request.url());
		});

		await page.goto('/articles/feature-tour-code-blocks');
		await page.waitForLoadState('networkidle');
		expect(mermaidRequests).toEqual([]);
		await expect(page.locator('.katex')).toHaveCount(0);
		await expect(page.locator('link[href*="katex"]')).toHaveCount(0);

		await page.goto('/articles/feature-tour-math-and-diagrams');
		await expect(page.locator('.katex-display').first()).toBeVisible();
		await expect(page.locator('figure[data-rendered] svg')).toHaveCount(2);
		await expect(page.getByRole('img', { name: /Site build pipeline/ })).toBeVisible();
		expect(mermaidRequests.length).toBeGreaterThan(0);
	});

	test('code blocks have copy buttons and titles', async ({ page }) => {
		await page.goto('/articles/feature-tour-code-blocks');
		await expect(page.getByText('ring_buffer.c')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Copy to clipboard' }).first()).toBeAttached();
	});

	test('the React island hydrates only on its article', async ({ page }) => {
		await page.goto('/articles/feature-tour-code-blocks');
		await expect(page.locator('astro-island')).toHaveCount(0);

		await page.goto('/articles/feature-tour-interactive-mdx');
		const explorer = page.getByRole('group', { name: /Bit explorer/ });
		await explorer.scrollIntoViewIfNeeded();
		const bit7 = explorer.getByRole('button', { name: /Bit 7/ });
		await bit7.click();
		await expect(bit7).toHaveAttribute('aria-pressed', 'true');
		await expect(explorer.getByText('-86')).toBeVisible();
		await expect(explorer.getByText('0xAA')).toBeVisible();
	});
});
