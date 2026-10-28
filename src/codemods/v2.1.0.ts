import type { Codemod, FileTransform, TransformResult } from './index.js';
import { createFile, deleteFile, normalizeNewlines, replaceFile, replaceText, replaceTexts, warn } from './helpers.js';
import * as F from './v2.1.0-files.js';

// 2.1.0: structured logging tied to SvelteKit 3's OpenTelemetry tracing (issue #16), SSR only.
// The logger moves to src/lib/server/logger.ts (server-only, trace_id/span_id on every line, wider
// redaction); src/instrumentation.server.ts registers the OTel SDK (exporting only when
// OTEL_EXPORTER_OTLP_ENDPOINT is set) and vite.config.ts turns on `tracing.server`; hooks.server.ts
// gets one request log line per request and `handleError` with `errorId`; the login actions log
// structured outcomes instead of `logger.inspect`. Code the user wrote that still imports the old
// logger is listed by `leftovers`.

const OTEL_DEPENDENCIES: Record<string, string> = {
	'@opentelemetry/api': '~1.9.1',
	'@opentelemetry/context-async-hooks': '^2.12.0',
	'@opentelemetry/core': '^2.12.0',
	'@opentelemetry/exporter-trace-otlp-http': '^0.223.0',
	'@opentelemetry/resources': '^2.12.0',
	'@opentelemetry/sdk-trace': '^2.12.0'
};

const NOT_TEMPLATE_JSON_WARNING = `is not tab-indented JSON like the template, so it was left as is; add these to "dependencies" by hand: ${Object.entries(
	OTEL_DEPENDENCIES
)
	.map(([name, range]) => `"${name}": "${range}"`)
	.join(', ')}`;

/** Adds the OpenTelemetry packages to `dependencies` (server runtime), keeping any already listed. */
export function addOtelDependencies(content: string): TransformResult {
	const normalized = normalizeNewlines(content);
	let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
	try {
		pkg = JSON.parse(normalized);
	} catch {
		return warn(content, NOT_TEMPLATE_JSON_WARNING);
	}
	if (JSON.stringify(pkg, null, '\t') + '\n' !== normalized) return warn(content, NOT_TEMPLATE_JSON_WARNING);

	const deps = { ...pkg.dependencies };
	const names = Object.keys(deps);
	const wasSorted = names.every((name, i) => i === 0 || names[i - 1] <= name);
	for (const [name, range] of Object.entries(OTEL_DEPENDENCIES)) {
		if (deps[name] === undefined && pkg.devDependencies?.[name] === undefined) deps[name] = range;
	}
	const ordered = wasSorted ? Object.fromEntries(Object.entries(deps).sort(([a], [b]) => (a < b ? -1 : 1))) : deps;

	// Rebuilt so `dependencies` keeps its place among the other keys.
	const next = Object.fromEntries(
		Object.entries(pkg).map(([key, value]) => [key, key === 'dependencies' ? ordered : value])
	);
	if (!('dependencies' in pkg)) next.dependencies = ordered;
	return JSON.stringify(next, null, '\t') + '\n';
}

/** Overrides the generic warning with what to change by hand. */
function withWarning(transform: (content: string) => TransformResult, message: string) {
	return (content: string): TransformResult => {
		const result = transform(content);
		return typeof result === 'string' || result.warnings.length === 0 ? result : { ...result, warnings: [message] };
	};
}

// --- vite.config.ts: tracing.server ------------------------------------------------------------

const VITE_TRACING = withWarning(
	replaceText(
		'\t\t\tadapter: adapter()\n\t\t}),',
		'\t\t\tadapter: adapter(),\n\t\t\t// OpenTelemetry spans for handle, load, actions and +server; set up in src/instrumentation.server.ts\n\t\t\ttracing: { server: true }\n\t\t}),'
	),
	'differs from the template, so it was left as is; add `tracing: { server: true }` to the options of sveltekit({ ... }) by hand, or SvelteKit records no spans (log lines then have no trace_id)'
);

// --- src/hooks.server.ts --------------------------------------------------------------------------

const HOOKS_WARNING =
	"differs from the template, so it was left as is; add `export { handleError } from '#lib/hooks/handle-error.js';` and put `handleRequestLog` (from '#lib/hooks/request-log.js') first in `sequence(...)` for `handle`";

// --- src/env.ts and .env.example ---------------------------------------------------------------

const ENV_VARS = `	LOG_LEVEL: {
		description:
			'pino level: trace, debug, info, warn, error or fatal (default debug in dev, info otherwise)',
		schema: (value) => value ?? ''
	},
	OTEL_EXPORTER_OTLP_ENDPOINT: {
		description: 'OTLP/HTTP collector base URL; spans are exported only when set',
		schema: (value) => value ?? ''
	},
	OTEL_SERVICE_NAME: {
		description: 'service.name on exported spans (default sveltekitten)',
		schema: (value) => value || 'sveltekitten'
	}
});
`;

const ENV_FULLSTACK_TAIL = "\t\tschema: (value) => value || 'sqlite.db'\n\t}\n});\n";
const ENV_FASTAPI_TAIL = "\t\tschema: (value) => value ?? ''\n\t}\n});\n";
const ENV_WARNING =
	'differs from the template, so it was left as is; declare LOG_LEVEL, OTEL_EXPORTER_OTLP_ENDPOINT and OTEL_SERVICE_NAME in defineEnvVars by hand (see the 2.1.0 template), since src/lib/server/logger.ts and src/instrumentation.server.ts import them from $app/env/private';

const envVars = (tail: string) =>
	withWarning(replaceText(tail, tail.replace(/\n\}\);\n$/, ',\n') + ENV_VARS), ENV_WARNING);

const ENV_EXAMPLE_BLOCK =
	'# Optional: logging and tracing (see agent-role.md)\n# LOG_LEVEL=debug\n# OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318\n# OTEL_SERVICE_NAME=my-app\n';

/** Appends the optional variables, as comments, unless the file already mentions them. */
function appendEnvExample(content: string): TransformResult {
	if (content.includes('OTEL_EXPORTER_OTLP_ENDPOINT')) return content;
	const normalized = normalizeNewlines(content);
	return (normalized === '' || normalized.endsWith('\n') ? normalized : normalized + '\n') + ENV_EXAMPLE_BLOCK;
}

// --- logger import moves to #lib/server/logger.js -----------------------------------------------

const LOGGER_IMPORT = replaceText(
	"import { logger } from '#lib/logger.js';",
	"import { logger } from '#lib/server/logger.js';"
);

const OLD_LOGGER_WARNING =
	'differs from the template, so it was left as is; the logger moved to src/lib/server/logger.ts (server-only, with trace ids and wider redaction). Move your changes there, import it from #lib/server/logger.js and delete this file';

// --- login actions: structured logs instead of logger.inspect -------------------------------------

const LOGIN_FULLSTACK = replaceTexts([
	[
		'\t\t\tif (!user) {\n\t\t\t\treturn message(',
		"\t\t\tif (!user) {\n\t\t\t\tlogger.debug({ outcome: 'invalid_credentials' }, 'login rejected');\n\t\t\t\treturn message("
	],
	[
		"\t\t\tsetSessionCookie(cookies, token, session.expiresAt);\n\t\t} catch (err) {\n\t\t\tlogger.inspect('Local login error', err);\n",
		"\t\t\tsetSessionCookie(cookies, token, session.expiresAt);\n\t\t\tlogger.debug({ outcome: 'success', user_id: user.id }, 'login succeeded');\n\t\t} catch (err) {\n\t\t\t// Caught to show a form message, so handleError never sees it: log it here.\n\t\t\tlogger.error({ err }, 'login failed: authentication error');\n"
	]
]);

const LOGIN_FASTAPI = replaceTexts([
	[
		"\t\t\t\tlogger.error({ err }, 'FastAPI login request failed');",
		"\t\t\t\tlogger.error({ err }, 'login failed: FastAPI unreachable');"
	],
	[
		'\t\t\tsetAuthTokens(cookies, result.data.access_token, result.data.refresh_token);\n',
		"\t\t\tsetAuthTokens(cookies, result.data.access_token, result.data.refresh_token);\n\t\t\tlogger.debug({ outcome: 'success' }, 'login succeeded');\n"
	],
	[
		'\t\tif (status === 400 || status === 401 || status === 403) {\n\t\t\treturn message(',
		"\t\tif (status === 400 || status === 401 || status === 403) {\n\t\t\tlogger.debug({ outcome: 'invalid_credentials', status }, 'login rejected');\n\t\t\treturn message("
	],
	[
		"\t\tlogger.error({ status }, 'FastAPI login failed');",
		"\t\tlogger.error({ status }, 'login failed: unexpected FastAPI response');"
	]
]);

// --- FastAPI proxy: no URLs (query strings) in logs, unexpected errors left to handleError ----------

const PROXY = replaceTexts([
	[
		"\tif (!BACKEND_API_URL) {\n\t\tlogger.error('BACKEND_API_URL environment variable is not set.');\n",
		'\tif (!BACKEND_API_URL) {\n\t\t// handleError logs it (with the trace id) and answers 500.\n'
	],
	[
		'\tlogger.debug(`${params.slug}`);\n\tlogger.info(`[API Proxy] Forwarding request to: [${request.method}] ${API_ENDPOINT}`);\n',
		"\t// The path only: the query string may carry secrets. The request log line already has the route.\n\tlogger.debug({ method: request.method, path }, '[API Proxy] forwarding request');\n"
	],
	[
		'\t\tlogger.error(\n\t\t\t{ err },\n\t\t\t`[API Proxy] Error fetching from API: [${request.method}] ${API_ENDPOINT}`\n\t\t);',
		"\t\tlogger.error({ err, method: request.method, path }, '[API Proxy] backend unreachable');"
	]
]);

// --- App.Error, error page ----------------------------------------------------------------------

const APP_ERROR = replaceText(
	'\t\t// interface Error {}\n',
	"\t\tinterface Error {\n\t\t\t/** The request's trace id, set by handleError (src/lib/hooks/handle-error.ts). */\n\t\t\terrorId?: string;\n\t\t}\n"
);

const ERROR_PAGE_FROM = "\t<p class=\"text-muted-foreground\">{page.error?.message ?? 'Something went wrong'}</p>\n";
const ERROR_PAGE = replaceText(
	ERROR_PAGE_FROM,
	ERROR_PAGE_FROM +
		'\t{#if page.error?.errorId}\n\t\t<p class="text-xs text-muted-foreground">Error ID: {page.error.errorId}</p>\n\t{/if}\n'
);

// --- docs --------------------------------------------------------------------------------------

const LOGGING_SECTION_COMMON_HEAD = `## Logging and Tracing

- **Server code only.** \`import { logger } from '#lib/server/logger.js'\` (pino). It lives under \`src/lib/server/\`, so importing it from a \`.svelte\` file or other browser code fails the build. The browser has no logger: tell the user with a toast or the error page.
- **Every line is JSON carrying \`trace_id\` / \`span_id\`** of the current OpenTelemetry span, so the log lines and spans of one request find each other. SvelteKit's spans are on (\`tracing: { server: true }\` in \`vite.config.ts\`); \`src/instrumentation.server.ts\` registers the SDK and exports spans over OTLP/HTTP to \`OTEL_EXPORTER_OTLP_ENDPOINT\` only when it is set (otherwise nothing is sent). \`OTEL_SERVICE_NAME\` names the service. \`LOG_LEVEL\` sets the level (default \`debug\`, pretty-printed, in dev; \`info\` otherwise).
`;

const LOGGING_SECTION_FULLSTACK = `${LOGGING_SECTION_COMMON_HEAD}- **Already logged — do not add your own:** one \`info\` line per request from \`handleRequestLog\` (\`src/lib/hooks/request-log.ts\`: method, route id, status, \`duration_ms\`), and every unexpected error from \`handleError\` (\`src/lib/hooks/handle-error.ts\`: \`error\` level, with stack). Let unexpected errors propagate instead of catching and logging them: \`handleError\` logs each one once and sends the client \`{ message, errorId }\`, where \`errorId\` is the trace id (shown on the error page; search the logs for it).
- **Levels:** \`error\` when something failed and you handle it without rethrowing (e.g. the login action's \`catch\`, which returns a form message); \`warn\` for degraded but expected situations; \`info\` for rare, significant events (the request line covers routine traffic); \`debug\` for flow details (a login's outcome).
- **Never log** passwords, tokens, session ids, cookies, \`Authorization\` headers, form data, whole request or response bodies or headers, or full URLs (log the route id; query strings carry secrets). Pass values as fields, never inside the message: \`logger.debug({ outcome }, 'login rejected')\`. Redaction (\`REDACT_PATHS\` in the logger: \`password\`, \`token\`, \`access_token\`, \`refresh_token\`, \`cookie\`, \`set-cookie\`, \`authorization\`) only sees fields. No \`console.log\`.
- **Tests:** \`captureLogs()\` from \`#lib/server/testing/logs.js\` returns a logger that records every line, \`inSpan()\` runs code in a real span; \`src/routes/login/page.server.test.ts\` checks a login never logs a secret.
`;

const LOGGING_SECTION_FASTAPI = `${LOGGING_SECTION_COMMON_HEAD}- **Already logged — do not add your own:** one \`info\` line per request from \`handleRequestLog\` (\`src/lib/hooks/request-log.ts\`: method, route id, status, \`duration_ms\`; a proxied API call is its own request with the same trace id), and every unexpected error from \`handleError\` (\`src/lib/hooks/handle-error.ts\`: \`error\` level, with stack). Let unexpected errors propagate instead of catching and logging them: \`handleError\` logs each one once and sends the client \`{ message, errorId }\`, where \`errorId\` is the trace id (shown on the error page; search the logs for it).
- **Levels:** \`error\` when something failed and you handle it without rethrowing (e.g. the proxy answering 502 when FastAPI is unreachable); \`warn\` for degraded but expected situations (an expired refresh token); \`info\` for rare, significant events (the request line covers routine traffic); \`debug\` for flow details (a login's outcome, the path the proxy forwards).
- **Never log** passwords, access or refresh tokens, cookies, \`Authorization\` headers, form data, whole request or response bodies or headers (FastAPI's login response is the tokens), or full URLs (log the route id or path; query strings carry secrets). Pass values as fields, never inside the message: \`logger.debug({ outcome }, 'login rejected')\`. Redaction (\`REDACT_PATHS\` in the logger: \`password\`, \`token\`, \`access_token\`, \`refresh_token\`, \`cookie\`, \`set-cookie\`, \`authorization\`) only sees fields. No \`console.log\`.
- **Tests:** \`captureLogs()\` from \`#lib/server/testing/logs.js\` returns a logger that records every line, \`inSpan()\` runs code in a real span; \`src/routes/login/page.server.test.ts\` checks a login never logs a secret, including when FastAPI is down.
`;

const agentRole = (section: string) =>
	replaceTexts([
		[
			'- **pino** for logging (`src/lib/logger.ts`)\n',
			'- **pino** for logging (`src/lib/server/logger.ts`, server-only) and **OpenTelemetry** tracing (`src/instrumentation.server.ts`); see Logging and Tracing\n'
		],
		["e.g. `import { logger } from '#lib/logger.js'`", "e.g. `import { logger } from '#lib/server/logger.js'`"],
		['## Svelte 5 Quick Reference\n', `${section}\n## Svelte 5 Quick Reference\n`]
	]);

const AGENTS_LOGGER = replaceText(
	"- Logger: `import { logger } from '#lib/logger.js'` — use instead of `console.log`.\n",
	"- Logger (server code only): `import { logger } from '#lib/server/logger.js'` — use instead of `console.log`. Each line carries the request's `trace_id`; requests and unexpected errors are already logged. Never log passwords, tokens or cookies (see Logging and Tracing in `agent-role.md`).\n"
);

const SPA_AGENT_ROLE = replaceTexts([
	[
		"e.g. `import { logger } from '#lib/logger.js'`, `#lib/components/ui/button/index.js`.",
		"e.g. `import { cn } from '#lib/utils/shadcn.js'`, `#lib/components/ui/button/index.js`."
	],
	[
		'- **Run `svelte-autofixer` before finalizing any `.svelte` file**:',
		'- **No logger** — a SPA has no server, so it has no pino or OpenTelemetry setup (the SSR modes do); show failures to the user (toast, error page) and log on the backend.\n- **Run `svelte-autofixer` before finalizing any `.svelte` file**:'
	]
]);

const ssr = (file: string, transform: FileTransform['transform'], create = false): FileTransform => ({
	file,
	template: 'ssr',
	...(create && { create }),
	transform
});
const mode = (
	ssrMode: 'fullstack' | 'fastapi',
	file: string,
	transform: FileTransform['transform'],
	create = false
): FileTransform => ({ ...ssr(file, transform, create), ssrMode });

const codemod: Codemod = {
	from: '2.0.0',
	to: '2.1.0',
	transforms: [
		ssr('package.json', addOtelDependencies),
		ssr('vite.config.ts', VITE_TRACING),
		ssr('src/instrumentation.server.ts', createFile(F.INSTRUMENTATION), true),
		mode('fullstack', 'src/env.ts', envVars(ENV_FULLSTACK_TAIL)),
		mode('fastapi', 'src/env.ts', envVars(ENV_FASTAPI_TAIL)),
		ssr('.env.example', appendEnvExample),

		// Logger: new server-only module, old one removed.
		ssr('src/lib/server/logger.ts', createFile(F.LOGGER), true),
		ssr('src/lib/server/logger.test.ts', createFile(F.LOGGER_TEST), true),
		ssr('src/lib/server/testing/logs.ts', createFile(F.TESTING_LOGS), true),
		ssr('src/lib/logger.ts', deleteFile(F.OLD_LOGGER, OLD_LOGGER_WARNING)),

		// Request log and handleError.
		ssr('src/lib/hooks/request-log.ts', createFile(F.REQUEST_LOG), true),
		ssr('src/lib/hooks/request-log.test.ts', createFile(F.REQUEST_LOG_TEST), true),
		ssr('src/lib/hooks/handle-error.ts', createFile(F.HANDLE_ERROR), true),
		ssr('src/lib/hooks/handle-error.test.ts', createFile(F.HANDLE_ERROR_TEST), true),
		mode('fullstack', 'src/hooks.server.ts', withWarning(replaceFile(F.OLD_HOOKS_FULLSTACK, F.HOOKS_FULLSTACK), HOOKS_WARNING)),
		mode('fastapi', 'src/hooks.server.ts', withWarning(replaceFile(F.OLD_HOOKS_FASTAPI, F.HOOKS_FASTAPI), HOOKS_WARNING)),
		ssr('src/app.d.ts', APP_ERROR),
		ssr('src/routes/+error.svelte', ERROR_PAGE),

		// Files that log: the import moves first, so it lands even when the other hunks do not.
		ssr('src/routes/login/+page.server.ts', LOGGER_IMPORT),
		mode('fullstack', 'src/routes/login/+page.server.ts', LOGIN_FULLSTACK),
		mode('fastapi', 'src/routes/login/+page.server.ts', LOGIN_FASTAPI),
		mode('fullstack', 'src/routes/login/page.server.test.ts', createFile(F.LOGIN_TEST_FULLSTACK), true),
		mode('fastapi', 'src/routes/login/page.server.test.ts', createFile(F.LOGIN_TEST_FASTAPI), true),
		mode('fullstack', 'src/routes/api/health/+server.ts', LOGGER_IMPORT),
		mode('fastapi', 'src/routes/api/proxy/[...slug]/+server.ts', LOGGER_IMPORT),
		mode('fastapi', 'src/routes/api/proxy/[...slug]/+server.ts', PROXY),
		mode('fastapi', 'src/lib/server/proxy/refresh.ts', LOGGER_IMPORT),

		// Docs.
		mode('fullstack', 'agent-role.md', agentRole(LOGGING_SECTION_FULLSTACK)),
		mode('fastapi', 'agent-role.md', agentRole(LOGGING_SECTION_FASTAPI)),
		ssr('AGENTS.md', AGENTS_LOGGER),
		{ file: 'agent-role.md', template: 'spa', transform: SPA_AGENT_ROLE }
	],
	leftovers: {
		pattern: /(['"`])[#$]lib\/logger(\.[jt]s)?\1|logger\.(inspect|dir|table)\(/,
		message:
			"these files still import the old logger or call logger.inspect/dir/table, which are gone. Import it from '#lib/server/logger.js' (server code only; browser code has no logger) and log fields instead, e.g. logger.debug({ outcome }, '…'):"
	},
	notes: [
		'1. pnpm install            (adds the OpenTelemetry packages; pnpm-lock.yaml cannot be patched)',
		'2. pnpm check && pnpm test:unit',
		'Spans are exported only when OTEL_EXPORTER_OTLP_ENDPOINT is set; without it nothing is sent.'
	]
};

export default codemod;
