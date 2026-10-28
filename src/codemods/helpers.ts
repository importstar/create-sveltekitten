import type { TransformResult } from './index.js';

export const EDITED_FILE_WARNING =
	'differs from the template this codemod expects, so it was left as is; apply this change by hand (see CHANGELOG)';
export const PATTERN_NOT_FOUND_WARNING =
	'pattern not found, so it was left as is; apply this change by hand (see CHANGELOG)';
export const EXISTING_FILE_WARNING =
	'already exists with different content, so it was left as is; compare it with the new template by hand (see CHANGELOG)';

export const normalizeNewlines = (content: string) => content.replace(/\r\n/g, '\n');

export function warn(content: string, warning: string): TransformResult {
	return { content, warnings: [warning] };
}

/**
 * Swaps a whole file that is still exactly the `from` template for `to`. A file that already
 * equals `to` is left alone; any other file was edited and is left alone with a warning.
 */
export function replaceFile(from: string, to: string) {
	return (content: string): TransformResult => {
		const normalized = normalizeNewlines(content);
		if (normalized === to) return content;
		if (normalized === from) return to;
		return warn(content, EDITED_FILE_WARNING);
	};
}

/** Fills a file the codemod adds (`create: true`); an existing file with other content gets a warning. */
export function createFile(to: string) {
	return (content: string): TransformResult => {
		if (content === '') return to;
		if (normalizeNewlines(content) === to) return content;
		return warn(content, EXISTING_FILE_WARNING);
	};
}

/** Replaces the first `from` with `to`; warns when neither is in the file. */
export function replaceText(from: string, to: string) {
	return (content: string): TransformResult => {
		if (normalizeNewlines(content).includes(to)) return content;
		if (content.includes(from)) return content.replace(from, to);
		return warn(content, PATTERN_NOT_FOUND_WARNING);
	};
}

/**
 * Deletes a file that is still exactly the `from` template; any other content was edited and
 * is left alone with `editedWarning`. A missing file is skipped by the runner.
 */
export function deleteFile(from: string, editedWarning = EDITED_FILE_WARNING) {
	return (content: string): TransformResult => {
		if (normalizeNewlines(content) === from) return { content: '', warnings: [], delete: true };
		return warn(content, editedWarning);
	};
}

/**
 * Replaces each `from` with its `to`, all or nothing: every `from` must be in the file (each is
 * replaced once, in order). A file that already has every `to` and no `from` is left alone; any
 * other file was edited and is left alone with a warning.
 */
export function replaceTexts(pairs: ReadonlyArray<readonly [from: string, to: string]>) {
	return (content: string): TransformResult => {
		const normalized = normalizeNewlines(content);
		// Checked first: an insertion keeps its context line, so its `from` is inside its `to`.
		const applied = pairs.every(
			([from, to]) => normalized.includes(to) && (to.includes(from) || !normalized.includes(from))
		);
		if (applied) return content;
		if (pairs.every(([from]) => normalized.includes(from))) {
			let next = normalized;
			for (const [from, to] of pairs) next = next.replace(from, () => to);
			return next;
		}
		return warn(content, PATTERN_NOT_FOUND_WARNING);
	};
}
