# Node and Bun on the templates

There is no adoption decision in this file yet.

Issue 23 asks for one answer. Use Bun only as the package installer, use Bun as the production runtime, or keep Node and pnpm. The answer has to come from the thresholds below, measured on a Linux machine that is not WSL2. This checkout was prepared on WSL2. `summarize.mjs --decision` rejects those results, so this report does not quote them.

## Thresholds

Use Bun to install packages only when toolchain cells are at least 30% faster in CI than `T1` and every compatibility check passes.

Use Bun as the production runtime only when all of these hold for `S7` at the same requests per second as `R1`.

- p95 is at least 20% lower.
- Memory is not higher.
- The 30 minute soak has no errors.
- The runtime is `R2`. `R3` uses the community adapter `svelte-adapter-bun`, and `R4` edits the database client. The issue rules both of those out of this adoption even if they are faster.

Otherwise keep Node 24 and pnpm.

The p95 interquartile range has to be under 20% of that cell's median before a 20% gap counts. `summary.json` sets `separates20` from that rule. If it is false, say so here and do not pick a winner from that gap.

## Observation before the decision run

`node bench/checklist.mjs --fast` on this WSL2 host passed all seven checks against the pins. `better-sqlite3@13.0.3` loads on Node 24.20.0 and on Bun 1.4.4. scrypt hashes match. pino redacts `password` and `token`. The OpenTelemetry SDK constructor starts a span. `hostEligible` is false, so this is not the checklist of record. The JSON is in `bench/evidence/fast-1.4.4/`.

Bun 1.2.23 is not the pin. It panics while loading the same `better-sqlite3` build, with `NAPI FATAL ERROR: Error::New napi_get_last_error_info`, on Alpine and on Debian. 1.4.4 is the current `oven/bun:1` tag, and the image is Debian. Those crashes are in `bench/evidence/better-sqlite3-bun-1.2.23-alpine.json` and `bench/evidence/better-sqlite3-bun-1.2.23-debian.json`.

## What a finished report contains

One table of median and interquartile range per cell that passed the checklist, five rounds each. The `S7` latency curve against requests per second. The checklist pass or fail, with the command and the output, copied into `bench/evidence/`. The machine, and the versions printed in `result.json`. One paragraph that states the level of Bun and cites the numbers.

The limiter for the `S7` p95 number has to be named from a profile of a run that is not one of the five reported rounds. A gap with no limiter stays inconclusive.

## Cells the harness runs

Toolchain cells are `T1`, `T2`, and `T3` on `ssr-fullstack`, `ssr-fastapi`, and `spa`.

Runtime cells are `R1` through `R4`, scenarios `S1` through `S7`, and `1cpu` or `2cpu`. `R4-S5-1cpu` is rejected because `S5` does not run the fullstack app. The tracing-off build is the `-otel-off` suffix. The default build is the template as it ships.

`bash bench/run.sh T1-ssr-fullstack` and `bash bench/run.sh R1-S7-1cpu` are the two commands a second machine repeats. Their medians should land inside the interquartile range published here. That check is open until the ranges exist.
