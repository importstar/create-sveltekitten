#!/usr/bin/env bash
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
