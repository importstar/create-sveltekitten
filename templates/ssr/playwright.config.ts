import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	use: {
		baseURL: 'http://localhost:3000',
		trace: 'on-first-retry',
		launchOptions: {
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
		},
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: [
		{
			command: 'node e2e/mock-api.js',
			url: 'http://localhost:9001',
			reuseExistingServer: !process.env.CI,
		},
		{
			command: 'pnpm build && node build',
			url: 'http://localhost:3000',
			reuseExistingServer: !process.env.CI,
			env: { BACKEND_API_URL: 'http://localhost:9001' },
		},
	],
});
