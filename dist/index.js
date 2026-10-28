#!/usr/bin/env node
import * as p from '@clack/prompts';
import { cp, mkdir, readFile, writeFile, readdir, rename, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, styleText } from 'node:util';
import { patch } from './patch.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '../templates');
// @clack/prompts 1.x no longer dims note() body text by default; this restores the 0.x look.
const dimNote = { format: (line) => styleText('dim', line) };
async function getVersion() {
    const pkg = JSON.parse(await readFile(join(__dirname, '../package.json'), 'utf-8'));
    return pkg.version;
}
async function replaceInFile(filePath, replacements) {
    let content = await readFile(filePath, 'utf-8');
    for (const [from, to] of Object.entries(replacements)) {
        content = content.replaceAll(from, to);
    }
    await writeFile(filePath, content);
}
async function walkDir(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await walkDir(fullPath)));
        }
        else {
            files.push(fullPath);
        }
    }
    return files;
}
/** npm omits `.gitignore` from packages; templates ship `_gitignore` instead. */
async function materializeGitignore(targetDir) {
    const underscore = join(targetDir, '_gitignore');
    const dot = join(targetDir, '.gitignore');
    if (!existsSync(underscore))
        return;
    if (existsSync(dot)) {
        await unlink(underscore);
    }
    else {
        await rename(underscore, dot);
    }
}
async function applyReplacements(targetDir, replacements) {
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
            }
            catch {
                // skip binary files
            }
        }
    }
}
const TEMPLATES = ['ssr', 'spa'];
const SSR_MODES = ['fullstack', 'fastapi'];
const DEFAULT_BACKEND_URL = 'http://localhost:9000';
function fail(message) {
    p.log.error(message, { output: process.stderr });
    process.exit(1);
}
function oneOf(flag, value, allowed) {
    if (value === undefined)
        return undefined;
    if (!allowed.includes(value)) {
        fail(`Invalid ${flag} "${value}". Allowed: ${allowed.join(', ')}.`);
    }
    return value;
}
/** Flags for a non-interactive scaffold; anything missing is prompted for, unless --yes. */
function parseFlags(args) {
    let values;
    try {
        ({ values } = parseArgs({
            args,
            options: {
                name: { type: 'string' },
                template: { type: 'string' },
                mode: { type: 'string' },
                'backend-url': { type: 'string' },
                yes: { type: 'boolean' }
            },
            strict: true,
            allowPositionals: false
        }));
    }
    catch (err) {
        fail(`${err.message}\nUsage: create-sveltekitten [--name <name>] [--template ssr|spa] [--mode fullstack|fastapi] [--backend-url <url>] [--yes]`);
    }
    const name = values.name?.trim();
    if (values.name !== undefined && !name)
        fail('--name must not be empty.');
    const template = oneOf('--template', values.template, TEMPLATES);
    const mode = oneOf('--mode', values.mode, SSR_MODES);
    if (mode && template === 'spa')
        fail('--mode only applies to --template ssr.');
    const yes = values.yes ?? false;
    if (yes) {
        if (!name)
            fail('--yes needs --name.');
        if (!template)
            fail(`--yes needs --template (${TEMPLATES.join(' or ')}).`);
        if (template === 'ssr' && !mode)
            fail(`--yes with --template ssr needs --mode (${SSR_MODES.join(' or ')}).`);
    }
    return { name, template, mode, backendUrl: values['backend-url'], yes };
}
async function main(flags) {
    const version = await getVersion();
    p.intro(`create-sveltekitten v${version}`);
    let projectName = flags.name;
    if (projectName === undefined) {
        const answer = await p.text({
            message: 'Project name',
            placeholder: 'my-app',
            validate: (v) => (v?.trim() ? undefined : 'Required')
        });
        if (p.isCancel(answer)) {
            p.cancel('Cancelled.');
            process.exit(0);
        }
        projectName = answer;
    }
    let template = flags.template;
    if (template === undefined) {
        const answer = await p.select({
            message: 'Template',
            options: [
                {
                    value: 'ssr',
                    label: 'SSR',
                    hint: `v${version} · adapter-node · full-stack (Drizzle SQLite) or FastAPI BFF`
                },
                {
                    value: 'spa',
                    label: 'SPA',
                    hint: `v${version} · adapter-static · client-side auth · TanStack Query`
                }
            ]
        });
        if (p.isCancel(answer)) {
            p.cancel('Cancelled.');
            process.exit(0);
        }
        template = answer;
    }
    if (flags.mode && template === 'spa')
        fail('--mode only applies to --template ssr.');
    let ssrMode;
    let backendUrl = flags.backendUrl ?? DEFAULT_BACKEND_URL;
    if (template === 'ssr') {
        ssrMode = flags.mode;
        if (ssrMode === undefined) {
            const mode = await p.select({
                message: 'Backend architecture for SSR',
                options: [
                    {
                        value: 'fullstack',
                        label: 'SvelteKit Full-Stack (Integrated)',
                        hint: 'SQLite · Drizzle ORM · Server Actions · Local Database'
                    },
                    {
                        value: 'fastapi',
                        label: 'FastAPI Backend (BFF Proxy)',
                        hint: 'OpenAPI client · /api/proxy/** · External Python API'
                    }
                ]
            });
            if (p.isCancel(mode)) {
                p.cancel('Cancelled.');
                process.exit(0);
            }
            ssrMode = mode;
        }
        if (ssrMode === 'fastapi' && flags.backendUrl === undefined && !flags.yes) {
            const url = await p.text({
                message: 'BACKEND_API_URL (FastAPI base URL)',
                placeholder: DEFAULT_BACKEND_URL,
                initialValue: DEFAULT_BACKEND_URL
            });
            if (p.isCancel(url)) {
                p.cancel('Cancelled.');
                process.exit(0);
            }
            backendUrl = url;
        }
    }
    else if (flags.backendUrl === undefined && !flags.yes) {
        const url = await p.text({
            message: 'PUBLIC_API_URL (backend base URL)',
            placeholder: DEFAULT_BACKEND_URL,
            initialValue: DEFAULT_BACKEND_URL
        });
        if (p.isCancel(url)) {
            p.cancel('Cancelled.');
            process.exit(0);
        }
        backendUrl = url;
    }
    const targetDir = join(process.cwd(), projectName);
    if (existsSync(targetDir)) {
        if (flags.yes)
            fail(`Directory "${projectName}" already exists. --yes never overwrites; choose another --name.`);
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
        // SSR is the shared templates/ssr plus the chosen mode's overlay, templates/ssr-<mode>,
        // which adds that mode's code, package.json and lockfile.
        const templateDir = join(TEMPLATES_DIR, template);
        await cp(templateDir, targetDir, { recursive: true, force: true });
        if (template === 'ssr') {
            await cp(join(TEMPLATES_DIR, `ssr-${ssrMode}`), targetDir, { recursive: true, force: true });
        }
        await materializeGitignore(targetDir);
        const replacements = {
            '{{PROJECT_NAME}}': projectName,
            '{{BACKEND_URL}}': backendUrl
        };
        await applyReplacements(targetDir, replacements);
        const envLines = template === 'spa'
            ? `PUBLIC_APP_TITLE=${projectName}\nPUBLIC_API_URL=${backendUrl}\n`
            : ssrMode === 'fullstack'
                ? `PUBLIC_APP_TITLE=${projectName}\nDATABASE_URL=sqlite.db\n`
                : `PUBLIC_APP_TITLE=${projectName}\nBACKEND_API_URL=${backendUrl}\n`;
        await writeFile(join(targetDir, '.env'), envLines);
        await writeFile(join(targetDir, '.sveltekitten.json'), JSON.stringify({
            version: await getVersion(),
            template,
            ...(ssrMode ? { ssrMode } : {})
        }, null, '\t') + '\n');
        spinner.stop('Project scaffolded!');
    }
    catch (err) {
        spinner.stop('Failed.');
        p.log.error(String(err));
        process.exit(1);
    }
    if (template === 'ssr' && ssrMode === 'fullstack') {
        p.note([
            `cd ${projectName}`,
            'pnpm install',
            'pnpm user:create admin',
            'pnpm dev'
        ].join('\n'), 'Next steps', dimNote);
        p.note([
            'Manage database schema & data:',
            '  pnpm db:push    # push schema changes to sqlite.db',
            '  pnpm db:studio  # open Drizzle Studio in browser',
            '  pnpm db:generate # generate SQL migrations'
        ].join('\n'), 'Database', dimNote);
    }
    else {
        p.note([`cd ${projectName}`, `pnpm install`, `pnpm dev`].join('\n'), 'Next steps', dimNote);
    }
    if (template === 'ssr' && ssrMode === 'fastapi') {
        p.note([
            'Fetch latest spec and regenerate types:',
            '  pnpm openapi:update',
            '',
            'Or regenerate from committed spec only:',
            '  pnpm openapi:fastapi'
        ].join('\n'), 'API types', dimNote);
    }
    p.outro('Happy coding!');
}
const command = process.argv[2];
if (command === 'patch') {
    getVersion()
        .then((v) => patch(v, process.argv.slice(3)))
        .catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
else {
    main(parseFlags(process.argv.slice(2))).catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
