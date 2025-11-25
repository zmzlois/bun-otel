import type { BunPlugin } from "bun";
import type { OpenTelemetryConfig } from "./sdk";
import type { TelemetryFetchOptions } from "./server";

const VIRTUAL_RUNTIME_MODULE = "bun-otel:runtime";
const VIRTUAL_RUNTIME_NAMESPACE = "bun-otel-runtime";

export interface RuntimeAutoInstrumentationOptions {
  /**
   * When true, monkey patches `Bun.serve` so every server automatically runs inside
   * an instrumented fetch handler (mirrors `instrumentBunServer` behaviour).
   *
   * Users can still opt-out per server by passing `telemetry: false`.
   */
  autoInstrumentServe?: boolean;
  /**
   * Default telemetry options that will be passed to `instrumentFetchHandler`.
   * These can be overridden per server call by providing `telemetry` in the options.
   */
  fetch?: TelemetryFetchOptions;
}

export interface BunOtelPluginOptions {
  /**
   * Configuration forwarded to `OpenTelemetryClient.init`.
   * Environment variables still take precedence, this merely provides project defaults.
   */
  sdk?: OpenTelemetryConfig;
  /**
   * Runtime auto-instrumentation settings (Bun server wrapping, etc.).
   */
  runtime?: RuntimeAutoInstrumentationOptions;
  /**
   * Additional virtual modules (e.g., `bun-otel:metrics`) we might expose in the future.
   */
  additionalVirtualModules?: Record<
    string,
    { namespace?: string; loader?: "js" | "ts"; contents: string }
  >;
}

/**
 * Draft plugin that wires Bun's plugin API to OpenTelemetry bootstrap + runtime helpers.
 *
 * Usage example:
 *
 * ```ts
 * import { plugin } from "bun";
 * import { createBunOtelPlugin } from "bun-otel/draft";
 *
 * plugin(createBunOtelPlugin({
 *   sdk: { serviceName: "bun-app", environment: "production" },
 *   runtime: { autoInstrumentServe: true },
 * }));
 * ```
 *
 * Projects can then `import "bun-otel:runtime"` at the top of their entrypoint to ensure
 * the OTEL SDK is initialized before other modules execute.
 */
export function createBunOtelPlugin(options: BunOtelPluginOptions = {}): BunPlugin {
  return {
    name: "bun-otel",
    setup(build) {
      build.onStart(() => {
        if (options.sdk) {
          console.log("[bun-otel] compiling with OTEL defaults:", options.sdk);
        }
      });

      // Virtual runtime bootstrap module
      build.onResolve({ filter: /^bun-otel:runtime$/ }, () => ({
        path: VIRTUAL_RUNTIME_MODULE,
        namespace: VIRTUAL_RUNTIME_NAMESPACE,
      }));

      build.onLoad({ filter: /.*/, namespace: VIRTUAL_RUNTIME_NAMESPACE }, async () => {
        return {
          loader: "ts",
          contents: createRuntimeBootstrap(options),
        };
      });

      // Optional extra virtual modules
      if (options.additionalVirtualModules) {
        for (const [moduleId, config] of Object.entries(options.additionalVirtualModules)) {
          const ns = config.namespace ?? `bun-otel-${moduleId}`;
          build.onResolve({ filter: new RegExp(`^${escapeRegExp(moduleId)}$`) }, () => ({
            path: moduleId,
            namespace: ns,
          }));
          build.onLoad({ filter: /.*/, namespace: ns }, () => ({
            loader: config.loader ?? "ts",
            contents: config.contents,
          }));
        }
      }
    },
  };
}

/**
 * Generates the source code returned for the virtual `bun-otel:runtime` module.
 * Doing the work here keeps the plugin `setup` nice and declarative.
 */
function createRuntimeBootstrap(options: BunOtelPluginOptions): string {
  const sdkConfigLiteral = JSON.stringify(options.sdk ?? {}, null, 2);
  const telemetryLiteral = JSON.stringify(options.runtime?.fetch ?? {}, null, 2);
  const autoServe = options.runtime?.autoInstrumentServe;

  return `
import { OpenTelemetryClient } from "bun-otel";
import { instrumentBunServer, instrumentFetchHandler } from "bun-otel";

const __bunOtelClient = OpenTelemetryClient.getInstance();
__bunOtelClient.init(${sdkConfigLiteral});

${autoServe ? wrapServeHookSource(telemetryLiteral) : ""}

export const bunOtelClient = __bunOtelClient;
export const instrument = instrumentFetchHandler;
`.trimStart();
}

function wrapServeHookSource(telemetryLiteral: string) {
  return `
const __bunOtelOriginalServe = Bun.serve;
Bun.serve = function bunOtelServe(options) {
  if (!options || options.telemetry === false) {
    return __bunOtelOriginalServe(options);
  }

  const telemetryOptions = options.telemetry ?? ${telemetryLiteral};
  const wrappedFetch = instrumentFetchHandler(
    options.fetch ?? ((req) => new Response("Not Found", { status: 404 })),
    telemetryOptions,
  );

  return __bunOtelOriginalServe({
    ...options,
    fetch(req, server) {
      return wrappedFetch(req, server);
    },
  });
};
`.trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
