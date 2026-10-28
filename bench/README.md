# Run one benchmark cell

This directory measures the three templates. It does not change them, and it is not part of the published package.

A cell id selects one column of the matrix in issue 23.

- `T1-ssr-fullstack`, `T2-ssr-fastapi`, and `T3-spa` are toolchain cells. `T1` installs with pnpm and runs tools with Node. `T2` installs with Bun and runs tools with Node. `T3` installs with Bun and runs tools with `bun --bun`.
- `R1-S7-1cpu` is a runtime cell. `R1` is Node 24 and `adapter-node`. `R2` is Bun running that same build. `R3` swaps in the `svelte-adapter-bun` package inside the bench copy. `R4` swaps `better-sqlite3` for `bun:sqlite` inside the bench copy, and only on a scenario that runs the fullstack app.
- Add `-otel-off` to a runtime cell to build that copy with Kit tracing turned off. The default is the template as it ships, which is tracing on and no exporter.
- `1cpu` is 1 vCPU and 512 MB. `2cpu` is 2 vCPU and 1 GB. On `S7` each app container gets that limit.

## What you need

A Linux machine that is not WSL2, with Docker, Node 24.20.0, pnpm 12.10.1, and Bun 1.4.4. The pins are in `versions.env`. k6 runs from `grafana/k6:1.4.2` and does not need a host install.

Build the CLI once, from the repo root, so the bench can scaffold.

```bash
pnpm install --frozen-lockfile
pnpm build
```

`run.sh` records `uname` and refuses to call the host eligible when `/proc/version` contains `microsoft`. `node bench/summarize.mjs --decision bench/out` exits 2 if any file it reads is from WSL2 or from `BENCH_SMOKE=1`. Those runs still write JSON, so you can see that the scripts work. They are not the decision.

## Run the checks that do not need the matrix

```bash
node --test bench/lib/*.test.mjs
node bench/checklist.mjs --fast
```

`--fast` checks `better-sqlite3`, scrypt, pino redaction, and the OpenTelemetry SDK inside the pinned Node and Bun images. Drop `--fast` to also scaffold a fullstack app and run `drizzle-kit push`, Drizzle Studio, vitest under Node and Bun, `playwright --version`, and `create-sveltekitten patch`.

Each check writes `bench/out/checklist/<id>.json` with the command and the output.

## Run one cell

```bash
bash bench/run.sh T1-ssr-fullstack
bash bench/run.sh R1-S7-1cpu
```

The script prints the path of `result.json`. The file has the cell id, the host, every pin from `versions.env`, the metrics, and the commands it ran.

Run `R1` for a scenario and machine size before `R2`, `R3`, or `R4` of the same scenario. The later cells send load at 50% and 80% of R1's saturation. If that R1 file is missing, the later cell still writes JSON and records the missing load in `errors`.

Set `BENCH_SMOKE=1` to scaffold, install, and build a toolchain cell, or to start a runtime cell and send a few seconds of traffic. The JSON has `"smoke": true`. Do not put it in the report.

A runtime cell that is not a smoke run ramps until p99 passes 500 ms, then holds 50% and 80% of the R1 rate for 90 seconds and drops the first 30 seconds. `S7` then holds 80% for 30 minutes. `BENCH_SOAK_SEC` changes that length. Five rounds is five separate invocations. Vary the order yourself.

`S7` runs the fullstack app and the FastAPI app together. k6 sends half of the rate to `GET /home`, 30% to `GET /api/items`, 10% to `POST /api/items`, and 10% to the FastAPI proxy. The mock waits 20 ms and answers 401 until the app refreshes the access token.

## Read the rounds

```bash
node bench/summarize.mjs bench/out
node bench/summarize.mjs --decision bench/out
```

The first command writes `bench/out/summary.json` with the median and the interquartile range of every numeric metric. The percentile is linear on the sorted sample. The second command is the one that feeds `REPORT.md`, and it rejects WSL2 and smoke files.

GitHub Actions workflow `Bench axis A` runs one toolchain cell on `ubuntu-latest` when you start it by hand. It does not run on pull requests. Do not use that runner for `R` cells. Those need a machine that is not shared.

## Where the files go

`bench/work/` is the scaffold for the current cell. `bench/out/` is the JSON, the k6 samples, and the SQLite snapshot. Both are gitignored. The decision log for this effort is `bench/decisions.tsv`.
