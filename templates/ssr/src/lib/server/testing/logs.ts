import { context, trace, type Span } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { TracerProvider } from '@opentelemetry/sdk-trace';
import { createLogger } from '../logger.js';

export type LogLine = Record<string, unknown> & { level: number; msg: string };

/** A logger at `trace` level that keeps every line: `raw` as written, `lines` parsed. */
export function captureLogs() {
	const raw: string[] = [];
	const lines: LogLine[] = [];
	const logger = createLogger({
		write(line: string) {
			raw.push(line);
			lines.push(JSON.parse(line));
		}
	});
	logger.level = 'trace';
	return { logger, raw, lines };
}

let registered = false;

/**
 * Runs `fn` inside an active span with real ids, as SvelteKit does for `sveltekit.handle.root`
 * once src/instrumentation.server.ts has registered the SDK. Nothing is exported.
 */
export async function inSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
	if (!registered) {
		context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
		trace.setGlobalTracerProvider(new TracerProvider());
		registered = true;
	}
	return trace.getTracer('test').startActiveSpan(name, async (span) => {
		try {
			return await fn(span);
		} finally {
			span.end();
		}
	});
}
