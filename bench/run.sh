#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
if [[ $# -lt 1 ]]; then
	echo "Usage: bench/run.sh <cell-id>" >&2
	echo "Example: bench/run.sh T1-ssr-fullstack" >&2
	echo "Example: bench/run.sh R1-S7-1cpu" >&2
	exit 2
fi
exec node bench/run.mjs "$@"
