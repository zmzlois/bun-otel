import { beforeEach, describe, expect, test } from "bun:test";
import { context, trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { instrumentBunServer, instrumentFetchHandler } from "./server";

const exporter = new InMemorySpanExporter();
const provider = new BasicTracerProvider();
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
provider.register();

describe("instrumentFetchHandler", () => {
  beforeEach(() => {
    exporter.reset();
  });

  test("starts and closes a server span around the handler", async () => {
    const handler = instrumentFetchHandler(async () => new Response("ok", { status: 201 }));

    await handler(new Request("http://localhost/test", { method: "POST" }), {} as any);

    const spans = exporter.getFinishedSpans();
    expect(spans.length).toBe(1);
    expect(spans[0].name).toBe("POST /test");
    expect(spans[0].attributes["http.status_code"]).toBe(201);
  });

  test("records exceptions and preserves parent context", async () => {
    const tracer = trace.getTracer("test");
    const parent = tracer.startSpan("parent");

    const handler = instrumentFetchHandler(async () => {
      throw new Error("boom");
    });

    await expect(
      context.with(trace.setSpan(context.active(), parent), () =>
        handler(new Request("http://localhost/error"), {} as any)
      )
    ).rejects.toThrow("boom");

    parent.end();

    const spans = exporter.getFinishedSpans();
    expect(spans.length).toBe(2); // parent + server span
    const serverSpan = spans.find((span) => span.name === "GET /error");
    expect(serverSpan?.status.code).toBe(2); // SpanStatusCode.ERROR
    expect(serverSpan?.events.some((event) => event.name === "exception")).toBe(true);
  });
});

describe("instrumentBunServer", () => {
  test("wraps Bun.serve and instruments fetch handler", async () => {
    const originalServe = Bun.serve;
    let capturedOptions: Parameters<typeof Bun.serve>[0] | null = null;

    try {
      // @ts-ignore override for testing
      Bun.serve = (options: Parameters<typeof Bun.serve>[0]) => {
        capturedOptions = options;
        return {
          stop() {},
          hostname: "localhost",
          port: 0,
        } as any;
      };

      const originalFetch = async () => new Response("hello");
      instrumentBunServer(
        {
          port: 0,
          fetch: originalFetch,
        },
        { tracerName: "instrumentBunServerTest" }
      );

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions?.fetch).toBeDefined();
      expect(capturedOptions?.fetch).not.toBe(originalFetch);

      await capturedOptions?.fetch?.(new Request("http://localhost/test"), {} as any);

      const spans = exporter.getFinishedSpans();
      expect(spans.length).toBeGreaterThan(0);
    } finally {
      Bun.serve = originalServe;
    }
  });
});
