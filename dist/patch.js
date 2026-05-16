import * as p from '@clack/prompts';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getApplicableCodemods } from './codemods/index.js';
export async function patch(latestVersion) {
    const configPath = join(process.cwd(), '.sveltekitten.json');
    if (!existsSync(configPath)) {
        p.log.error('No .sveltekitten.json found. This command must be run inside a project created by create-sveltekitten.');
        process.exit(1);
    }
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    const { version: currentVersion, template } = config;
    p.intro(`create-sveltekitten patch`);
    p.log.info(`Project: ${template} @ ${currentVersion} → ${latestVersion}`);
    if (currentVersion === latestVersion) {
        p.outro('Already up to date.');
        return;
    }
    const applicable = getApplicableCodemods(currentVersion, latestVersion);
    if (applicable.length === 0) {
        p.log.warn(`No codemods found for ${currentVersion} → ${latestVersion}. Update .sveltekitten.json manually if needed.`);
        p.outro('Done.');
        return;
    }
    const pending = [];
    for (const codemod of applicable) {
        p.log.step(`Codemod ${codemod.from} → ${codemod.to}`);
        for (const t of codemod.transforms) {
            const filePath = join(process.cwd(), t.file);
            if (!existsSync(filePath)) {
                p.log.warn(`  skip ${t.file} (not found)`);
                continue;
            }
            const oldContent = await readFile(filePath, 'utf-8');
            const newContent = t.transform(oldContent);
            if (oldContent === newContent) {
                p.log.info(`  unchanged ${t.file}`);
            }
            else {
                p.log.info(`  modified ${t.file}`);
                pending.push({ file: t.file, oldContent, newContent });
            }
        }
    }
    if (pending.length === 0) {
        p.log.info('No file changes needed.');
    }
    else {
        const confirm = await p.confirm({
            message: `Apply ${pending.length} file change(s) and update version to ${latestVersion}?`,
            initialValue: true
        });
        if (!confirm || p.isCancel(confirm)) {
            p.cancel('Patch cancelled.');
            return;
        }
        const spinner = p.spinner();
        spinner.start('Applying changes...');
        for (const { file, newContent } of pending) {
            await writeFile(join(process.cwd(), file), newContent);
        }
        spinner.stop('Changes applied.');
    }
    // Always update version after running applicable codemods
    const updated = { ...config, version: latestVersion };
    await writeFile(configPath, JSON.stringify(updated, null, '\t') + '\n');
    p.outro(`Patched to ${latestVersion}. Commit .sveltekitten.json and changed files.`);
}
