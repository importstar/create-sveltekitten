import type { Codemod } from './index.js';
import { createFile, replaceText } from './helpers.js';

// 1.1.0: scripts/check.sh, the one command that says whether a change is ready to merge.

const CHECK_SH = `#!/usr/bin/env bash
# Run before every merge: lint, type check, unit tests. Stops at the first failing step.
set -uo pipefail
cd "$(dirname "$0")/.."

step() {
	local name=$1
	shift
	echo "==> $name"
	if ! "$@"; then
		echo "check.sh: FAILED at step: $name" >&2
		exit 1
	fi
}

step lint pnpm lint
step check pnpm check
step test:unit pnpm test:unit

echo "check.sh: all steps passed"
`;

const CHECK_SH_FASTAPI = `#!/usr/bin/env bash
# Run before every merge: lint, OpenAPI types vs spec, type check, unit tests.
# Stops at the first failing step.
set -uo pipefail
cd "$(dirname "$0")/.."

step() {
	local name=$1
	shift
	echo "==> $name"
	if ! "$@"; then
		echo "check.sh: FAILED at step: $name" >&2
		exit 1
	fi
}

TYPES=src/lib/api/paths/fastapi.d.ts

# The generated types are gitignored, so drift is found by regenerating them and comparing
# with the copy on disk; the copy on disk is put back either way.
openapi_types_match_spec() {
	local saved
	saved=$(mktemp)
	if [ -f "$TYPES" ]; then
		cp "$TYPES" "$saved"
	else
		: >"$saved"
	fi
	if ! pnpm -s openapi:fastapi >/dev/null; then
		echo "Could not generate types from src/libs/api-specs/fastapi.json." >&2
		rm -f "$saved"
		return 1
	fi
	local status=0
	if ! cmp -s "$saved" "$TYPES"; then
		echo "$TYPES does not match src/libs/api-specs/fastapi.json." >&2
		echo "Run: pnpm openapi:fastapi" >&2
		status=1
	fi
	if [ -s "$saved" ]; then
		cp "$saved" "$TYPES"
	else
		rm -f "$TYPES"
	fi
	rm -f "$saved"
	return $status
}

step lint pnpm lint
# Before check: svelte-check against stale types proves nothing about the current spec.
step openapi:fastapi openapi_types_match_spec
step check pnpm check
step test:unit pnpm test:unit

echo "check.sh: all steps passed"
`;

const OLD_RULE = '- **Type-check and unit-test before finishing**: `pnpm check && pnpm test:unit`';
const NEW_RULE =
	'- **Before merging, `bash scripts/check.sh` must pass**: it runs `pnpm lint`, `pnpm check` and `pnpm test:unit` in order and stops at the first failing step, which it names.';
const NEW_RULE_FASTAPI =
	'- **Before merging, `bash scripts/check.sh` must pass**: it runs `pnpm lint`, an OpenAPI types check, `pnpm check` and `pnpm test:unit` in order and stops at the first failing step, which it names. The OpenAPI step fails when `src/lib/api/paths/fastapi.d.ts` is out of date with `src/libs/api-specs/fastapi.json`; fix that with `pnpm openapi:fastapi`.';

const OLD_VALIDATE = 'and verify with `pnpm check` and `pnpm test:unit`.';
const NEW_VALIDATE = 'and verify with `bash scripts/check.sh`.';

export default {
	from: '1.0.1',
	to: '1.1.0',
	transforms: [
		{ file: 'scripts/check.sh', create: true, template: 'spa', transform: createFile(CHECK_SH) },
		{ file: 'scripts/check.sh', create: true, template: 'ssr', ssrMode: 'fullstack', transform: createFile(CHECK_SH) },
		{ file: 'scripts/check.sh', create: true, template: 'ssr', ssrMode: 'fastapi', transform: createFile(CHECK_SH_FASTAPI) },
		{ file: 'agent-role.md', template: 'spa', transform: replaceText(OLD_RULE, NEW_RULE) },
		{ file: 'agent-role.md', template: 'ssr', ssrMode: 'fullstack', transform: replaceText(OLD_RULE, NEW_RULE) },
		{ file: 'agent-role.md', template: 'ssr', ssrMode: 'fastapi', transform: replaceText(OLD_RULE, NEW_RULE_FASTAPI) },
		{ file: 'agent-role.md', transform: replaceText(OLD_VALIDATE, NEW_VALIDATE) }
	]
} satisfies Codemod;
