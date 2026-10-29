import type { Codemod } from './index.js';
import { replaceFile, replaceText } from './helpers.js';

// 2.1.1: instrumentation.server.ts must read OTEL_* from process.env — $app/env/private is
// undefined there because the file runs before Server.init() (sveltejs/kit#14286).

const INSTRUMENTATION_FROM = `// Runs before the rest of the server (SvelteKit loads it first; \`tracing.server\` in
// vite.config.ts turns on SvelteKit's spans). Spans always get real trace/span ids, so log lines
// and \`errorId\` correlate even without a backend; they are only exported when
// OTEL_EXPORTER_OTLP_ENDPOINT is set. Without it nothing is sent anywhere.
import { context, propagation, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import { OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_SERVICE_NAME } from '$app/env/private';

const endpoint = OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\\/$/, '');

const provider = new TracerProvider({
	resource: resourceFromAttributes({ 'service.name': OTEL_SERVICE_NAME }),
	spanProcessors: endpoint
		? [
				new BatchSpanProcessor({
					exporter: new OTLPTraceExporter({ url: \`\${endpoint}/v1/traces\` })
				})
			]
		: []
});

// The context manager makes the span SvelteKit starts for a request the active one in the code it
// runs (\`trace.getActiveSpan()\`, which the logger reads). The propagator continues a trace from an
// incoming \`traceparent\` header.
context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
propagation.setGlobalPropagator(new W3CTraceContextPropagator());
trace.setGlobalTracerProvider(provider);

// Send the spans still buffered before the process exits.
process.once('sveltekit:shutdown', () => void provider.shutdown());
`;

const INSTRUMENTATION_TO = `// Runs before the rest of the server (SvelteKit loads it first; \`tracing.server\` in
// vite.config.ts turns on SvelteKit's spans). Spans always get real trace/span ids, so log lines
// and \`errorId\` correlate even without a backend; they are only exported when
// OTEL_EXPORTER_OTLP_ENDPOINT is set. Without it nothing is sent anywhere.
//
// Read from process.env — this file runs before Server.init() populates $app/env, so imports from
// $app/env/private would be undefined (sveltejs/kit#14286). Vars stay declared in src/env.ts.
import { context, propagation, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';

const endpoint = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? '').replace(/\\/$/, '');
const serviceName = process.env.OTEL_SERVICE_NAME || 'sveltekitten';

const provider = new TracerProvider({
	resource: resourceFromAttributes({ 'service.name': serviceName }),
	spanProcessors: endpoint
		? [
				new BatchSpanProcessor({
					exporter: new OTLPTraceExporter({ url: \`\${endpoint}/v1/traces\` })
				})
			]
		: []
});

// The context manager makes the span SvelteKit starts for a request the active one in the code it
// runs (\`trace.getActiveSpan()\`, which the logger reads). The propagator continues a trace from an
// incoming \`traceparent\` header.
context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
propagation.setGlobalPropagator(new W3CTraceContextPropagator());
trace.setGlobalTracerProvider(provider);

// Send the spans still buffered before the process exits.
process.once('sveltekit:shutdown', () => void provider.shutdown());
`;

const AGENT_ROLE_FROM =
	'SvelteKit\'s spans are on (`tracing: { server: true }` in `vite.config.ts`); `src/instrumentation.server.ts` registers the SDK and exports spans over OTLP/HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT` only when it is set (otherwise nothing is sent). `OTEL_SERVICE_NAME` names the service. `LOG_LEVEL` sets the level (default `debug`, pretty-printed, in dev; `info` otherwise).\n';

const AGENT_ROLE_TO =
	'SvelteKit\'s spans are on (`tracing: { server: true }` in `vite.config.ts`); `src/instrumentation.server.ts` registers the SDK and exports spans over OTLP/HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT` only when it is set (otherwise nothing is sent). It reads that endpoint and `OTEL_SERVICE_NAME` from `process.env` (not `$app/env/private`) because it runs before `Server.init()`; both stay declared in `src/env.ts`. `LOG_LEVEL` sets the level (default `debug`, pretty-printed, in dev; `info` otherwise).\n';

const codemod: Codemod = {
	from: '2.1.0',
	to: '2.1.1',
	transforms: [
		{
			file: 'src/instrumentation.server.ts',
			template: 'ssr',
			transform: replaceFile(INSTRUMENTATION_FROM, INSTRUMENTATION_TO)
		},
		{
			file: 'agent-role.md',
			template: 'ssr',
			ssrMode: 'fullstack',
			transform: replaceText(AGENT_ROLE_FROM, AGENT_ROLE_TO)
		},
		{
			file: 'agent-role.md',
			template: 'ssr',
			ssrMode: 'fastapi',
			transform: replaceText(AGENT_ROLE_FROM, AGENT_ROLE_TO)
		}
	]
};

export default codemod;
