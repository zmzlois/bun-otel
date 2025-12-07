import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { Elysia } from "elysia";
import { opentelemetry, setAttributes } from "@elysiajs/opentelemetry";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { record } from "@elysiajs/opentelemetry";

const app = new Elysia();

// OTLP Trace Exporter Configuration
const traceExporter = new OTLPTraceExporter({
  url: Bun.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  headers: { "Content-Type": "application/json" },
});

// Span Processor using BatchSpanProcessor for better performance
const spanProcessor = new BatchSpanProcessor(traceExporter);

app.use(
  opentelemetry({
    serviceName: Bun.env.SERVICE_NAME,
    spanProcessors: [spanProcessor],
    resource: resourceFromAttributes({
      "service.name": Bun.env.SERVICE_NAME,
      "service.version": Bun.env.CODE_VERSION,
      "deployment.environment": Bun.env.ENVIRONMENT,
    }),
  })
);

app.get("/", () => "Hello Elysia");

app.get("/test", () => {
  return record("test.operation", () => {
    // your code here - this gets traced
    return "traced!";
  });
});

record("startup.test", () => {
  setAttributes({ "test.key": "hello" });
  return "test span sent";
});
app.listen(process.env.PORT ?? 3002);

console.log(`elysia is running at ${app.server?.hostname}:${app.server?.port}`);
