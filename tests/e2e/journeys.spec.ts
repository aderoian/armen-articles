import { expect, test } from '@playwright/test';

test('home → featured article → back to the archive', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1, name: 'Armen Deroian' })).toBeVisible();
	await expect(page.getByRole('link', { name: /armenderoian\.dev/ }).first()).toHaveAttribute(
		'href',
		'https://armenderoian.dev'
	);

	const featured = page.getByRole('region', { name: 'Featured' });
	await featured.getByRole('link', { name: 'Feature Tour, Part 1: Code Blocks' }).click();
	await expect(page).toHaveURL(/\/articles\/feature-tour-code-blocks$/);
	await expect(
		page.getByRole('heading', { level: 1, name: 'Feature Tour, Part 1: Code Blocks' })
	).toBeVisible();
	await expect(page.getByText('2 min read').first()).toBeVisible();

	await page.getByRole('link', { name: 'Back to all articles' }).click();
	await expect(page).toHaveURL(/\/articles$/);
	await expect(page.getByRole('heading', { level: 1, name: 'All articles' })).toBeVisible();
});

test('table of contents links jump to sections', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/articles/feature-tour-code-blocks');
	const toc = page.getByRole('navigation', { name: 'On this page' });
	await toc.getByRole('link', { name: 'Shading languages' }).click();
	await expect(page).toHaveURL(/#shading-languages$/);
	await expect(page.getByRole('heading', { name: 'Shading languages' })).toBeInViewport();
});

test('category page lists only its articles', async ({ page }) => {
	await page.goto('/');
	await page
		.getByRole('navigation', { name: 'Categories' })
		.getByRole('link', { name: /Site Notes/ })
		.click();
	await expect(page).toHaveURL(/\/categories\/site-notes$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Site Notes' })).toBeVisible();
	const articles = page.getByRole('list', { name: 'Articles in Site Notes' }).getByRole('article');
	await expect(articles).toHaveCount(2);
	await expect(page.getByText('Feature Tour, Part 1')).toHaveCount(0);
});

test('series pages follow seriesOrder and link parts in sequence', async ({ page }) => {
	await page.goto('/series/publication-demo');
	const parts = page.getByRole('list', { name: 'Parts in reading order' }).getByRole('heading');
	await expect(parts).toHaveText([/Part 1: Code Blocks/, /Part 2: Math/, /Part 3: Interactive/]);

	await page.getByRole('link', { name: /Part 1: Code Blocks/ }).click();
	await expect(page.getByText('Part 1 of 3 in the series')).toBeVisible();
	await page.getByRole('link', { name: /Next part.*Math and Diagrams/ }).click();
	await expect(page).toHaveURL(/feature-tour-math-and-diagrams$/);
	await page.getByRole('link', { name: /Next part.*Interactive/ }).click();
	await expect(page).toHaveURL(/feature-tour-interactive-mdx$/);
	await expect(page.getByRole('link', { name: /Next part/ })).toHaveCount(0);
});

test('tag pages are reachable from article tags', async ({ page }) => {
	await page.goto('/articles/feature-tour-code-blocks');
	const tags = page.getByRole('list', { name: 'Tags' }).first();
	await tags.getByRole('link', { name: 'c++', exact: true }).click();
	await expect(page).toHaveURL(/\/tags\/cpp$/);
	await expect(page.getByRole('heading', { level: 1, name: /c\+\+/ })).toBeVisible();
});

test('unknown routes and drafts return the custom 404 page', async ({ page }) => {
	for (const path of ['/does-not-exist', '/articles/draft-preview-example']) {
		const response = await page.goto(path);
		expect(response?.status()).toBe(404);
		await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
	}
});
