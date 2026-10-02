import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
	test: {
		// Unit tests live next to the code; Playwright owns e2e/*.test.ts.
		include: ['src/**/*.{test,spec}.ts'],
		passWithNoTests: true
	}
});
