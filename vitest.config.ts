import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// Root tests only: template test files and fixture files (some named *.test.ts) never run here.
		include: ['test/**/*.test.ts'],
		exclude: [...configDefaults.exclude, 'test/fixtures/**'],
		testTimeout: 30_000
	}
});
