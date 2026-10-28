import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runCodemodChain, runCodemodFixture } from './helpers/codemods.js';

// Does a project patched to `to` get the same file the template at `to` scaffolds?
// `reference/` holds the template's copy (written by scripts/make-codemod-fixture.mjs when a
// commit has version `to`). Each known difference is pinned here with its reason, so a new
// one fails and a fixed one must be removed from the list.
const KNOWN_DIFFERENCES: Record<string, string> = {
	'0.3.0/ssr/.env': 'the codemod prepends DATABASE_URL; the 0.3.0 CLI writes it second. Same variables.',
	'0.3.0/ssr/package.json':
		'the codemod appends the new scripts and dependencies; the 0.3.0 template has them in another order. Same entries.',
	'0.3.3/ssr/src/lib/features/items/api.ts':
		'no commit has version 0.3.2, so the input is the 0.3.0 template without the 0.3.1 toggleItem fix; chain-0.3.0-0.3.3/ssr gets this file right',
	'0.3.9/ssr/src/lib/features/items/contract.ts':
		'by design: the codemod keeps the interface in port.ts and makes contract.ts re-export it',
	'0.3.9/ssr/src/lib/features/items/port.ts': 'by design: codemods never delete files; the template has no port.ts',
	'0.3.9/spa/src/lib/features/items/contract.ts':
		'by design: the codemod keeps the interface in port.ts and makes contract.ts re-export it',
	'0.3.9/spa/src/lib/features/items/port.ts': 'by design: codemods never delete files; the template has no port.ts',
	'1.1.0/spa/agent-role.md':
		'no commit has version 1.0.1, so the input is the 1.0.0 file without the 1.0.1 Prettier formatting; chain-1.0.0-1.1.0 gets this file right',
	'1.1.0/ssr-fastapi/agent-role.md':
		'no commit has version 1.0.1, so the input is the 1.0.0 file without the 1.0.1 Prettier formatting; chain-1.0.0-1.1.0 gets this file right',
	'1.1.0/ssr-fullstack/agent-role.md':
		'no commit has version 1.0.1, so the input is the 1.0.0 file without the 1.0.1 Prettier formatting; chain-1.0.0-1.1.0 gets this file right'
};

const FIXTURES = fileURLToPath(new URL('./fixtures/codemods/', import.meta.url));

const cases = readdirSync(FIXTURES).flatMap((dir) =>
	readdirSync(join(FIXTURES, dir))
		.filter((variant) => existsSync(join(FIXTURES, dir, variant, 'reference')))
		.map((variant) => ({ dir, variant }))
);

describe('codemod output vs the template at its target version', () => {
	it.each(cases)('$dir/$variant', async ({ dir, variant }) => {
		const input = join(FIXTURES, dir, variant, 'input');
		const chain = dir.match(/^chain-(.+)-(.+)$/);
		const files = chain
			? (await runCodemodChain(chain[1], chain[2], input)).files
			: await runCodemodFixture(dir, input);

		const differences = [...files]
			.filter(([file, content]) => {
				const reference = join(FIXTURES, dir, variant, 'reference', file);
				return !existsSync(reference) || readFileSync(reference, 'utf-8') !== content;
			})
			.map(([file]) => `${dir}/${variant}/${file}`);

		const known = Object.keys(KNOWN_DIFFERENCES).filter((key) => key.startsWith(`${dir}/${variant}/`));
		expect(differences.sort()).toEqual(known.sort());
	});
});
