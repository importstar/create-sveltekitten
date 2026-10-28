import { describe, expect, it } from 'vitest';
import { moveToDevDependencies } from '../dist/codemods/v1.1.3.js';

const pkg = (value: unknown, indent: string | number = '\t') => JSON.stringify(value, null, indent) + '\n';

describe('1.1.3 moveToDevDependencies', () => {
	it('keeps the version a project pinned and adds devDependencies when missing', () => {
		const result = moveToDevDependencies(
			pkg({ dependencies: { 'openapi-typescript': '7.0.0', zod: '^4.0.0' } })
		);
		expect(JSON.parse(result as string)).toEqual({
			dependencies: { zod: '^4.0.0' },
			devDependencies: { 'openapi-typescript': '7.0.0' }
		});
	});

	it('leaves a package.json that already moved them, or never had them, unchanged', () => {
		const moved = pkg({ dependencies: {}, devDependencies: { 'openapi-typescript': '^7.13.0' } });
		expect(moveToDevDependencies(moved)).toBe(moved);
	});

	it('warns instead of reformatting a package.json that is not tab-indented', () => {
		const spaces = pkg({ dependencies: { 'openapi-typescript': '^7.13.0' } }, 2);
		const result = moveToDevDependencies(spaces);
		expect(typeof result).toBe('object');
		expect(result).toMatchObject({ content: spaces, warnings: [expect.stringContaining('by hand')] });
	});
});
