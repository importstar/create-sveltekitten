/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	globalSetup: './e2e/global-setup.ts',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	use: {
		baseURL: 'http://localhost:3000',
		trace: 'on-first-retry',
		launchOptions: {
			args: ['--no-sandbox', '--disable-setuid-sandbox']
		}
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: `${process.execPath} build`,
		url: 'http://localhost:3000',
		reuseExistingServer: !process.env.CI,
		env: {
			DATABASE_URL: 'e2e.db',
			NODE_ENV: 'test',
			ORIGIN: 'http://localhost:3000'
		},
		timeout: 120_000
	}
});
