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
