#!/usr/bin/env bash
# Run before every merge: lint, type check, unit tests. Stops at the first failing step.
# Those three scripts run through the package manager in .sveltekitten.json (pnpm if unset).
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

PM=pnpm
if [ -f .sveltekitten.json ]; then
	recorded=$(sed -n 's/.*"packageManager"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' .sveltekitten.json | head -n 1)
	case "$recorded" in
		bun|pnpm) PM=$recorded ;;
	esac
fi

step lint "$PM" run lint
step check "$PM" run check
step test:unit "$PM" run test:unit

echo "check.sh: all steps passed"
