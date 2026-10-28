// Runs before the rest of the server (SvelteKit loads it first; `tracing.server` in
// vite.config.ts turns on SvelteKit's spans). Spans always get real trace/span ids, so log lines
// and `errorId` correlate even without a backend; they are only exported when
// OTEL_EXPORTER_OTLP_ENDPOINT is set. Without it nothing is sent anywhere.
import { context, propagation, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import { OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_SERVICE_NAME } from '$app/env/private';

const endpoint = OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, '');

const provider = new TracerProvider({
	resource: resourceFromAttributes({ 'service.name': OTEL_SERVICE_NAME }),
	spanProcessors: endpoint
		? [
				new BatchSpanProcessor({
					exporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` })
				})
			]
		: []
});

// The context manager makes the span SvelteKit starts for a request the active one in the code it
// runs (`trace.getActiveSpan()`, which the logger reads). The propagator continues a trace from an
// incoming `traceparent` header.
context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
propagation.setGlobalPropagator(new W3CTraceContextPropagator());
trace.setGlobalTracerProvider(provider);

// Send the spans still buffered before the process exits.
process.once('sveltekit:shutdown', () => void provider.shutdown());
