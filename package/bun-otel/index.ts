export { trace, metrics, context, propagation, SpanStatusCode } from "@opentelemetry/api";
export { OpenTelemetryClient, type OpenTelemetryConfig } from "./src/sdk";
export { Logger } from "./src/logger";
export { logger } from "./src/_internal/_logger";
export {
  instrumentFetchHandler,
  instrumentBunServer,
  instrumentFetchHandler as wrapFetchHandler,
  type TelemetryFetchOptions,
} from "./src/server";
export { BunOtel } from "./src/bun-otel";
