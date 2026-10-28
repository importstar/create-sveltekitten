import type { Codemod } from './index.js';

export interface ProjectConfig {
	version: string;
	template: string;
	ssrMode?: 'fullstack' | 'fastapi';
}

export type TransformStatus = 'create' | 'modified' | 'unchanged' | 'skipped' | 'delete';

export interface TransformLog {
	file: string;
	/** `skipped`: the file does not exist and the transform does not create it. */
	status: TransformStatus;
	warnings: string[];
}

export interface CodemodLog {
	codemod: Codemod;
	transforms: TransformLog[];
}

export interface CodemodWarning {
	file: string;
	from: string;
	to: string;
	message: string;
}

export interface FileChange {
	file: string;
	content: string;
	isNew: boolean;
	/** Remove the file instead of writing `content`. */
	delete?: boolean;
}

export interface CodemodRun {
	/** One entry per codemod, in run order, for `patch` to print. */
	log: CodemodLog[];
	/** Final content of every file a transform ran on, changed or not (deleted files excluded). */
	files: Map<string, string>;
	/** Files a transform removed: `patch` deletes them. */
	deleted: string[];
	/** Files whose final content differs from what is on disk: what `patch` writes. */
	changes: FileChange[];
	warnings: CodemodWarning[];
}

/**
 * Runs `codemods` in order over a project without touching the disk. `readFile` returns a
 * file's content, or undefined when it does not exist.
 *
 * Several codemods in one run can touch the same file (e.g. 0.3.0 → 0.3.3 applies 0.3.1,
 * 0.3.2 and 0.3.3). Each file's in-progress content is carried forward, so a later codemod
 * sees the earlier one's changes instead of re-reading stale content and clobbering them.
 */
export async function applyCodemods(
	codemods: Codemod[],
	config: ProjectConfig,
	readFile: (file: string) => Promise<string | undefined>
): Promise<CodemodRun> {
	const originalContent = new Map<string, string | undefined>(); // undefined = file didn't exist yet
	const currentContent = new Map<string, string>();
	const isNewFile = new Map<string, boolean>();
	const deleted = new Set<string>();
	const log: CodemodLog[] = [];
	const warnings: CodemodWarning[] = [];

	for (const codemod of codemods) {
		const transforms: TransformLog[] = [];
		log.push({ codemod, transforms });
		for (const t of codemod.transforms) {
			if (t.template && t.template !== config.template) continue;
			if (t.ssrMode && t.ssrMode !== config.ssrMode) continue;

			let oldContent: string;
			let firstEncounter = false;
			if (deleted.has(t.file)) {
				transforms.push({ file: t.file, status: 'skipped', warnings: [] });
				continue;
			} else if (currentContent.has(t.file)) {
				oldContent = currentContent.get(t.file)!;
			} else {
				const onDisk = await readFile(t.file);
				if (onDisk !== undefined) {
					oldContent = onDisk;
					originalContent.set(t.file, onDisk);
					firstEncounter = true;
				} else if (t.create) {
					oldContent = '';
					originalContent.set(t.file, undefined);
					isNewFile.set(t.file, true);
					firstEncounter = true;
				} else {
					transforms.push({ file: t.file, status: 'skipped', warnings: [] });
					continue;
				}
			}

			const result = t.transform(oldContent);
			const newContent = typeof result === 'string' ? result : result.content;
			const transformWarnings = typeof result === 'string' ? [] : result.warnings;
			const remove = typeof result !== 'string' && result.delete === true;
			if (remove) {
				currentContent.delete(t.file);
				deleted.add(t.file);
			} else {
				currentContent.set(t.file, newContent);
			}

			let status: TransformStatus;
			if (remove) status = 'delete';
			else if (isNewFile.get(t.file) && firstEncounter) status = 'create';
			else if (newContent === oldContent) status = 'unchanged';
			else status = 'modified';
			transforms.push({ file: t.file, status, warnings: transformWarnings });
			for (const message of transformWarnings) {
				warnings.push({ file: t.file, from: codemod.from, to: codemod.to, message });
			}
		}
	}

	const changes: FileChange[] = [];
	for (const [file, content] of currentContent) {
		if (content !== (originalContent.get(file) ?? '')) {
			changes.push({ file, content, isNew: isNewFile.get(file) ?? false });
		}
	}

	for (const file of deleted) {
		// A file the run created and then deleted never reaches the disk.
		if (originalContent.get(file) !== undefined) changes.push({ file, content: '', isNew: false, delete: true });
	}

	return { log, files: currentContent, deleted: [...deleted], changes, warnings };
}

/** Source files `patch` scans for leftovers: Svelte components and JS/TS modules. */
export const isSourceFile = (file: string) => /\.(svelte|[cm]?[jt]s)$/.test(file);

/**
 * Source files in `files` (path → content) that match `pattern`: source a codemod could not migrate,
 * usually because the user wrote it. Sorted, for `patch` to print.
 */
export function findLeftovers(files: Map<string, string>, pattern: RegExp): string[] {
	const flags = pattern.flags.replace('g', '');
	const test = new RegExp(pattern.source, flags);
	return [...files]
		.filter(([file, content]) => isSourceFile(file) && test.test(content))
		.map(([file]) => file)
		.sort();
}
