#!/usr/bin/env node
// Writes codemod fixture inputs from git history, so fixtures are never hand-copied.
//
//   node scripts/make-codemod-fixture.mjs 0.3.24          # the codemod whose `to` is 0.3.24
//   node scripts/make-codemod-fixture.mjs --all           # every codemod from 0.3.0 on
//   node scripts/make-codemod-fixture.mjs --chain 0.3.0 0.3.3
//
// For each template/mode variant the codemod targets, it writes to
// test/fixtures/codemods/<to>/<variant>/ (or chain-<from>-<to>/<variant>/):
//   input/      the files the codemod touches, as a project scaffolded at `from` had them,
//               plus .sveltekitten.json
//   reference/  the same files as the template at `to` scaffolds them (from the commit with
//               version `to`, or the working tree when package.json already has it)
//   README.md   which commits these came from
// `expected/` is written by vitest (`pnpm test -- -u`); review it before committing.
//
// Run `pnpm build` first: the codemod list is read from dist/.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(ROOT, 'test/fixtures/codemods');
const PROJECT_NAME = 'demo';
const BACKEND_URL = 'http://localhost:9000';
const FIRST_TESTED = '0.3.0';

const { codemods, getApplicableCodemods } = await import(join(ROOT, 'dist/codemods/index.js'));

const git = (...args) =>
	execFileSync('git', args, { cwd: ROOT, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });

const WORKTREE = 'working tree';

function show(commit, path) {
	if (commit === WORKTREE) {
		const full = join(ROOT, path);
		if (!existsSync(full)) return undefined;
		return statSync(full).isDirectory() ? '' : readFileSync(full, 'utf-8');
	}
	try {
		return execFileSync('git', ['cat-file', '-p', `${commit}:${path}`], {
			cwd: ROOT,
			encoding: 'utf-8',
			stdio: ['ignore', 'pipe', 'ignore'],
			maxBuffer: 64 * 1024 * 1024
		});
	} catch {
		return undefined;
	}
}

function compareVersions(a, b) {
	const pa = a.split('.').map(Number);
	const pb = b.split('.').map(Number);
	for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
	return 0;
}

// Oldest first: [{ commit, version }] for every commit on HEAD's first-parent history.
const history = git('rev-list', '--first-parent', '--reverse', 'HEAD')
	.trim()
	.split('\n')
	.map((commit) => ({ commit, version: JSON.parse(show(commit, 'package.json') ?? '{}').version }))
	.filter((h) => h.version);

/**
 * The last commit released as `version`, else the working tree when its package.json has
 * that version (a release not committed yet), else with `fallback` the last commit before it.
 */
function commitFor(version, { fallback }) {
	const exact = history.filter((h) => h.version === version).at(-1);
	if (exact) return { ...exact, exact: true };
	if (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')).version === version) {
		return { commit: WORKTREE, version, exact: true };
	}
	if (!fallback) return undefined;
	const earlier = history.filter((h) => compareVersions(h.version, version) < 0).at(-1);
	return earlier && { ...earlier, exact: false };
}

/** Template variants a set of codemods targets: 'ssr', 'spa', 'ssr-fullstack', 'ssr-openapi' (older codemods: 'ssr-fastapi'). */
function variantsFor(list, fromCommit) {
	const transforms = list.flatMap((c) => c.transforms);
	const variants = [];
	if (transforms.some((t) => !t.template || t.template === 'spa')) variants.push({ template: 'spa' });
	const ssr = transforms.filter((t) => !t.template || t.template === 'ssr');
	if (ssr.length === 0) return variants;
	const hasOverlay = show(fromCommit, 'templates/ssr-fullstack') !== undefined;
	if (!hasOverlay && ssr.every((t) => !t.ssrMode)) {
		variants.unshift({ template: 'ssr' });
		return variants;
	}
	const tagged = [...new Set(ssr.map((t) => t.ssrMode).filter(Boolean))];
	// Transforms without ssrMode apply to every mode. Prefer openapi over the historical fastapi name.
	const modes = ssr.every((t) => t.ssrMode)
		? tagged
		: [...new Set([...tagged, 'fullstack', 'openapi'])];
	variants.unshift(...modes.sort().reverse().map((ssrMode) => ({ template: 'ssr', ssrMode })));
	return variants;
}

const variantName = (v) => (v.ssrMode ? `${v.template}-${v.ssrMode}` : v.template);

const applies = (t, v) =>
	(!t.template || t.template === v.template) && (!t.ssrMode || t.ssrMode === v.ssrMode);

/** BFF overlay directory names, preferred name first. Only one exists on a given commit. */
function overlayDirs(ssrMode) {
	if (ssrMode === 'openapi') return ['ssr-openapi', 'ssr-fastapi'];
	if (ssrMode === 'fastapi') return ['ssr-fastapi', 'ssr-openapi'];
	return [`ssr-${ssrMode}`];
}

function showOverlay(commit, ssrMode, file) {
	for (const dir of overlayDirs(ssrMode)) {
		const content = show(commit, `templates/${dir}/${file}`);
		if (content !== undefined) return content;
	}
	return undefined;
}

/** The `.env` the CLI at `commit` writes, read from its `envLines` expression. */
function envFile(commit, variant) {
	const source = show(commit, 'src/index.ts') ?? '';
	// From 1.0.0: spa ? … : ssrMode === 'fullstack' ? … : … (fastapi). Before: ssr ? … : … (spa).
	const perMode = source.match(
		/envLines\s*=\s*template === 'spa'\s*\?\s*`([^`]*)`\s*:\s*ssrMode === 'fullstack'\s*\?\s*`([^`]*)`\s*:\s*`([^`]*)`/
	);
	const shared = source.match(/envLines\s*=\s*template === 'ssr'\s*\?\s*`([^`]*)`\s*:\s*`([^`]*)`/);
	let lines;
	if (perMode) lines = perMode[variant.template === 'spa' ? 1 : variant.ssrMode === 'fullstack' ? 2 : 3];
	else if (shared) lines = shared[variant.template === 'ssr' ? 1 : 2];
	else throw new Error(`Cannot find envLines in src/index.ts at ${commit}`);
	return lines
		.replaceAll('${projectName}', PROJECT_NAME)
		.replaceAll('${backendUrl}', BACKEND_URL)
		.replaceAll('\\n', '\n');
}

/** A file as a project scaffolded by the CLI at `commit` has it, or undefined. */
function scaffoldedFile(commit, variant, file) {
	if (file === '.env') return envFile(commit, variant);
	// templates/ssr-<mode> overlays templates/ssr. The BFF overlay was templates/ssr-fastapi
	// through 2.1.1 and templates/ssr-openapi from 2.2.0; a fixture may read one commit of each.
	const fromOverlay = variant.ssrMode ? showOverlay(commit, variant.ssrMode, file) : undefined;
	let content = fromOverlay ?? show(commit, `templates/${variant.template}/${file}`);
	if (content === undefined) return undefined;
	content = content
		.replaceAll('{{PROJECT_NAME}}', PROJECT_NAME)
		.replaceAll('{{BACKEND_URL}}', BACKEND_URL);
	// Mirrors addFullstackPackageEntries in src/index.ts, for commits whose CLI has it.
	if (
		file === 'package.json' &&
		variant.ssrMode === 'fullstack' &&
		show(commit, 'src/index.ts')?.includes('addFullstackPackageEntries')
	) {
		const pkg = JSON.parse(content);
		pkg.scripts['user:create'] = 'tsx scripts/user-create.ts';
		content = JSON.stringify(pkg, null, '\t') + '\n';
	}
	return content;
}

const describe = (c) =>
	c.commit === WORKTREE
		? `${c.version} (the working tree; rerun after committing)`
		: c.exact
		? `${c.version} (commit ${c.commit.slice(0, 7)})`
		: `${c.version} (commit ${c.commit.slice(0, 7)}), the nearest earlier release: no commit has this version`;

async function writeFixture(dir, list, from, to) {
	const fromCommit = commitFor(from, { fallback: true });
	if (!fromCommit) throw new Error(`No commit at or before ${from}`);
	const toCommit = commitFor(to, { fallback: false });

	for (const variant of variantsFor(list, fromCommit.commit)) {
		const variantDir = join(dir, variantName(variant));
		const files = [...new Set(list.flatMap((c) => c.transforms.filter((t) => applies(t, variant)).map((t) => t.file)))];
		const created = new Set(list.flatMap((c) => c.transforms.filter((t) => t.create).map((t) => t.file)));
		const notes = [];

		await rm(join(variantDir, 'input'), { recursive: true, force: true });
		await rm(join(variantDir, 'reference'), { recursive: true, force: true });

		for (const file of files) {
			const content = scaffoldedFile(fromCommit.commit, variant, file);
			if (content === undefined) {
				if (!created.has(file)) notes.push(`- \`${file}\` is not in the ${fromCommit.version} template.`);
				continue;
			}
			await mkdir(dirname(join(variantDir, 'input', file)), { recursive: true });
			await writeFile(join(variantDir, 'input', file), content);
		}
		const config = { version: from, template: variant.template, ...(variant.ssrMode ? { ssrMode: variant.ssrMode } : {}) };
		await mkdir(join(variantDir, 'input'), { recursive: true });
		await writeFile(join(variantDir, 'input/.sveltekitten.json'), JSON.stringify(config, null, '\t') + '\n');

		if (toCommit) {
			for (const file of files) {
				const content = scaffoldedFile(toCommit.commit, variant, file);
				if (content === undefined) continue;
				await mkdir(dirname(join(variantDir, 'reference', file)), { recursive: true });
				await writeFile(join(variantDir, 'reference', file), content);
			}
		}

		const readme = [
			`# ${list.length > 1 ? `${from} → ${to} chain` : `codemod ${from} → ${to}`}, ${variantName(variant)}`,
			'',
			'Generated by `node scripts/make-codemod-fixture.mjs`; do not edit `input/` or `reference/` by hand.',
			'',
			`- \`input/\`: the ${from} project, from the template at ${describe(fromCommit)}.`,
			toCommit
				? `- \`reference/\`: the template at ${describe(toCommit)}.`
				: `- No \`reference/\`: no commit has version ${to}.`,
			'- `expected/`: the codemod output, a vitest file snapshot.',
			...notes,
			''
		].join('\n');
		await writeFile(join(variantDir, 'README.md'), readme);
		console.log(`wrote ${join(variantDir).slice(ROOT.length + 1)}${fromCommit.exact ? '' : ` (input from ${fromCommit.version})`}`);
	}
}

const args = process.argv.slice(2);
if (args[0] === '--chain') {
	const [, from, to] = args;
	const list = getApplicableCodemods(from, to);
	if (list.length === 0) throw new Error(`No codemods for ${from} → ${to}`);
	await writeFixture(join(FIXTURES, `chain-${from}-${to}`), list, from, to);
} else {
	const targets =
		args[0] === '--all'
			? codemods.filter((c) => compareVersions(c.to, FIRST_TESTED) >= 0)
			: args.map((to) => {
					const codemod = codemods.find((c) => c.to === to);
					if (!codemod) throw new Error(`No codemod with to === ${to} in dist/codemods (run pnpm build)`);
					return codemod;
				});
	if (targets.length === 0) {
		console.error('usage: node scripts/make-codemod-fixture.mjs <to-version>... | --all | --chain <from> <to>');
		process.exit(1);
	}
	for (const codemod of targets) {
		await writeFixture(join(FIXTURES, codemod.to), [codemod], codemod.from, codemod.to);
	}
}
