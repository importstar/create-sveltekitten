/// <reference types="node" />
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
		// adapter-node assumes https unless PROTOCOL_HEADER names a header (webServer.env below);
		// over plain http the CSRF check would reject form posts.
		extraHTTPHeaders: { 'x-forwarded-proto': 'http' },
		trace: 'on-first-retry',
		launchOptions: {
			args: ['--no-sandbox', '--disable-setuid-sandbox']
		}
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: [
		{
			command: 'node e2e/mock-api.js',
			url: 'http://localhost:9001/v1/health',
			reuseExistingServer: !process.env.CI,
			timeout: 15_000
		},
		{
			command: `${process.execPath} build`,
			url: 'http://localhost:3000',
			reuseExistingServer: !process.env.CI,
			env: {
				BACKEND_API_URL: 'http://localhost:9001',
				NODE_ENV: 'test',
				PROTOCOL_HEADER: 'x-forwarded-proto'
			},
			timeout: 120_000
		}
	]
});
