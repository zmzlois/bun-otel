import {
  type Attributes,
  context as otelContext,
  propagation,
  type Span,
  SpanKind,
  SpanStatusCode,
  type TextMapGetter,
  trace,
} from "@opentelemetry/api";

type BunServer = any;
type FetchHandler = (req: Request, server: BunServer) => Response | Promise<Response>;

const headersGetter: TextMapGetter<Headers> = {
  keys(carrier) {
    try {
      return [...carrier.keys()];
    } catch {
      return [];
    }
  },
  get(carrier, key) {
    try {
      return carrier.get(key) ?? undefined;
    } catch {
      return undefined;
    }
  },
};

export interface TelemetryFetchOptions {
  tracerName?: string;
  tracerVersion?: string;
  spanName?: (req: Request) => string;
  additionalAttributes?: (req: Request) => Attributes | undefined;
  shouldTrace?: (req: Request) => boolean;
  onSpanStart?: (span: Span, req: Request) => void;
  onSpanEnd?: (span: Span, req: Request, res: Response) => void;
  onSpanError?: (span: Span, error: Error, req: Request) => void;
}

const defaultSpanName = (req: Request): string => {
  const url = new URL(req.url);
  return `${req.method} ${url.pathname}`;
};

const defaultAttributes = (req: Request): Attributes => {
  const url = new URL(req.url);
  return {
    "http.method": req.method,
    "http.url": req.url,
    "http.target": url.pathname,
    "http.host": url.host,
    "http.scheme": url.protocol.replace(":", ""),
    "http.user_agent": req.headers.get("user-agent") ?? undefined,
  };
};

/**
 * Instrument a Bun fetch handler with OpenTelemetry context propagation.
 * Mirrors how @elysia-otel wraps its handlers so existing traces resume.
 */
export function instrumentFetchHandler(
  handler: FetchHandler,
  options: TelemetryFetchOptions = {}
): FetchHandler {
  const tracer = trace.getTracer(options.tracerName ?? "bun-otel", options.tracerVersion);

  return async function instrumentedFetch(req: Request, server: BunServer) {
    if (options.shouldTrace && !options.shouldTrace(req)) {
      return handler(req, server);
    }

    const ctx = propagation.extract(otelContext.active(), req.headers, headersGetter);
    const spanName = (options.spanName ?? defaultSpanName)(req);
    const attributes = {
      ...defaultAttributes(req),
      ...(options.additionalAttributes?.(req) ?? {}),
    };

    return tracer.startActiveSpan(
      spanName,
      { kind: SpanKind.SERVER, attributes },
      ctx,
      async (span) => {
        if (!span) {
          return handler(req, server);
        }

        options.onSpanStart?.(span, req);

        try {
          const response = await handler(req, server);
          span.setAttribute("http.status_code", response.status);

          if (response.status >= 500) {
            span.setStatus({ code: SpanStatusCode.ERROR });
          } else {
            span.setStatus({ code: SpanStatusCode.OK });
          }

          options.onSpanEnd?.(span, req, response);
          return response;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
          options.onSpanError?.(span, error, req);
          throw err;
        } finally {
          span.end();
        }
      }
    );
  };
}

type BunServeOptions = Parameters<typeof Bun.serve>[0];

/**
 * Instrument an entire Bun server configuration by wrapping its fetch handler.
 */
export function instrumentBunServer(
  options: BunServeOptions,
  telemetry: TelemetryFetchOptions = {}
) {
  const originalFetch = options.fetch ?? (() => new Response("Not Found", { status: 404 }));

  return Bun.serve({
    ...options,
    //fetch: instrumentFetchHandler(originalFetch, telemetry),
  });
}
