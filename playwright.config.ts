import { defineConfig, devices } from '@playwright/test';

const port = 4322;

/**
 * Browser tests run against the production build served by `astro preview`.
 * Run `npm run build` first; the Pagefind index only exists in the build output.
 */
export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: true,
	forbidOnly: Boolean(process.env['CI']),
	retries: process.env['CI'] ? 1 : 0,
	reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: `http://127.0.0.1:${port}`,
		trace: 'on-first-retry'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: `npx astro preview --host 127.0.0.1 --port ${port}`,
		url: `http://127.0.0.1:${port}`,
		reuseExistingServer: !process.env['CI'],
		env: { ASTRO_TELEMETRY_DISABLED: '1' }
	}
});
