#!/usr/bin/env node
import * as p from '@clack/prompts';
import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { patch } from './patch.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '../templates');

async function getVersion(): Promise<string> {
	const pkg = JSON.parse(await readFile(join(__dirname, '../package.json'), 'utf-8'));
	return pkg.version;
}

async function replaceInFile(filePath: string, replacements: Record<string, string>) {
	let content = await readFile(filePath, 'utf-8');
	for (const [from, to] of Object.entries(replacements)) {
		content = content.replaceAll(from, to);
	}
	await writeFile(filePath, content);
}

async function walkDir(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walkDir(fullPath)));
		} else {
			files.push(fullPath);
		}
	}
	return files;
}

async function applyReplacements(targetDir: string, replacements: Record<string, string>) {
	const textExts = new Set([
		'.ts', '.svelte', '.js', '.json', '.css', '.html', '.md', '.env',
		'.prettierrc', '.gitignore', '.eslintrc', '.d.ts'
	]);
	const files = await walkDir(targetDir);
	for (const file of files) {
		const ext = '.' + file.split('.').slice(1).join('.') || file;
		const basename = file.split('/').pop() ?? '';
		const isText = textExts.has('.' + (file.split('.').pop() ?? '')) ||
			basename.startsWith('.') ||
			!file.includes('.');
		if (isText) {
			try {
				await replaceInFile(file, replacements);
			} catch {
				// skip binary files
			}
		}
	}
}

async function main() {
	const version = await getVersion();
	p.intro(`create-sveltekitten v${version}`);

	const projectName = await p.text({
		message: 'Project name',
		placeholder: 'my-app',
		validate: (v) => (v.trim() ? undefined : 'Required')
	});
	if (p.isCancel(projectName)) {
		p.cancel('Cancelled.');
		process.exit(0);
	}

	const template = await p.select<'ssr' | 'spa'>({
		message: 'Template',
		options: [
			{
				value: 'ssr',
				label: 'SSR',
				hint: `v${version} · adapter-node · server-side auth · proxy · pino logger`
			},
			{
				value: 'spa',
				label: 'SPA',
				hint: `v${version} · adapter-static · client-side auth · TanStack Query`
			}
		]
	});
	if (p.isCancel(template)) {
		p.cancel('Cancelled.');
		process.exit(0);
	}

	const backendUrlKey = template === 'ssr' ? 'BACKEND_API_URL' : 'PUBLIC_API_URL';
	const backendUrl = await p.text({
		message: `${backendUrlKey} (backend base URL)`,
		placeholder: 'http://localhost:9000',
		initialValue: 'http://localhost:9000'
	});
	if (p.isCancel(backendUrl)) {
		p.cancel('Cancelled.');
		process.exit(0);
	}

	const targetDir = join(process.cwd(), projectName as string);

	if (existsSync(targetDir)) {
		const overwrite = await p.confirm({
			message: `Directory "${projectName}" already exists. Overwrite?`,
			initialValue: false
		});
		if (!overwrite || p.isCancel(overwrite)) {
			p.cancel('Cancelled.');
			process.exit(0);
		}
	}

	const spinner = p.spinner();
	spinner.start('Scaffolding project...');

	try {
		await mkdir(targetDir, { recursive: true });

		const templateDir = join(TEMPLATES_DIR, template as string);
		await cp(templateDir, targetDir, { recursive: true, force: true });

		const replacements: Record<string, string> = {
			'{{PROJECT_NAME}}': projectName as string,
			'{{BACKEND_URL}}': backendUrl as string
		};

		await applyReplacements(targetDir, replacements);

		const envLines =
			template === 'ssr'
				? `PUBLIC_APP_TITLE=${projectName}\nBACKEND_API_URL=${backendUrl}\n`
				: `PUBLIC_APP_TITLE=${projectName}\nPUBLIC_API_URL=${backendUrl}\n`;

		await writeFile(join(targetDir, '.env'), envLines);

		await writeFile(
			join(targetDir, '.sveltekitten.json'),
			JSON.stringify({ version: await getVersion(), template }, null, '\t') + '\n'
		);

		spinner.stop('Project scaffolded!');
	} catch (err) {
		spinner.stop('Failed.');
		p.log.error(String(err));
		process.exit(1);
	}

	p.note(
		[`cd ${projectName}`, `pnpm install`, `pnpm dev`].join('\n'),
		'Next steps'
	);

	if (template === 'ssr') {
		p.note(
			[
				'Fetch latest spec and regenerate types:',
				'  pnpm openapi:update',
				'',
				'Or regenerate from committed spec only:',
				'  pnpm openapi:fastapi'
			].join('\n'),
			'API types'
		);
	}

	p.outro('Happy coding!');
}

const command = process.argv[2];

if (command === 'patch') {
	getVersion()
		.then((v) => patch(v))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
} else {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
