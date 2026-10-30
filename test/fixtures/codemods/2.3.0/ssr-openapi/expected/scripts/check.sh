#!/usr/bin/env bash
# Run before every merge: lint, OpenAPI types vs spec, type check, unit tests.
# Stops at the first failing step. lint, check and test:unit use the package manager in
# .sveltekitten.json (pnpm if unset). The OpenAPI step calls openapi-typescript directly.
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

TYPES=src/lib/api/paths/openapi.d.ts

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
	if ! openapi-typescript src/libs/api-specs/openapi.json -o "$TYPES" >/dev/null; then
		echo "Could not generate types from src/libs/api-specs/openapi.json." >&2
		rm -f "$saved"
		return 1
	fi
	local status=0
	if ! cmp -s "$saved" "$TYPES"; then
		echo "$TYPES does not match src/libs/api-specs/openapi.json." >&2
		echo "Run: openapi-typescript src/libs/api-specs/openapi.json -o $TYPES" >&2
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

PM=pnpm
if [ -f .sveltekitten.json ]; then
	recorded=$(sed -n 's/.*"packageManager"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' .sveltekitten.json | head -n 1)
	case "$recorded" in
		bun|pnpm) PM=$recorded ;;
	esac
fi

step lint "$PM" run lint
# Before check: svelte-check against stale types proves nothing about the current spec.
step openapi:generate openapi_types_match_spec
step check "$PM" run check
step test:unit "$PM" run test:unit

echo "check.sh: all steps passed"
