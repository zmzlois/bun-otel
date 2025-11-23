import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import {
  detectResources,
  resourceFromAttributes,
  envDetector,
  processDetector,
  hostDetector,
} from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { logger as debug } from "./_internal/_logger";

export interface OpenTelemetryConfig {
  serviceName?: string;
  environment?: string;
  version?: string;
  ddApiKey?: string;
  ddSite?: string;
  disableDatadog?: boolean;
  useJaeger?: boolean;
  jaegerEndpoint?: string;
  exportIntervalMillis?: number;
  enableDiagnostics?: boolean;
  diagnosticLevel?: DiagLogLevel;
}

export class OpenTelemetryClient {
  private static instance: OpenTelemetryClient | null = null;
  private sdk: NodeSDK | null = null;
  private isInitialized = false;

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  /**
   * Get the singleton instance of OpenTelemetryClient.
   * Note: You must call init() before using the SDK.
   */
  public static getInstance(): OpenTelemetryClient {
    if (!OpenTelemetryClient.instance) {
      OpenTelemetryClient.instance = new OpenTelemetryClient();
    }
    return OpenTelemetryClient.instance;
  }

  /**
   * Initialize the OpenTelemetry SDK with the provided configuration.
   * This method must be called before using any OpenTelemetry features.
   *
   * @param config - Configuration options for the SDK
   * @throws Error if required configuration is missing or if already initialized
   *
   * @example
   * ```typescript
   * import { OpenTelemetryClient } from "bun-otel";
   *
   * const client = OpenTelemetryClient.getInstance();
   * client.init({
   *   serviceName: "my-service",
   *   environment: "production",
   *   ddApiKey: process.env.DD_API_KEY,
   * });
   * ```
   */
  public init(config?: OpenTelemetryConfig): void {
    if (this.isInitialized) {
      debug.warn(
        "OpenTelemetry SDK is already initialized. Skipping re-initialization.",
      );
      return;
    }

    // Merge config with environment variables
    const {
      DD_API_KEY,
      DD_SITE = "us5.datadoghq.com",
      DD_AGENT_HOST: _DD_AGENT_HOST,
      ENV,
      NODE_ENV,
      SERVICE_NAME,
      APP_VERSION,
      DISABLE_DATADOG,
      USE_JAEGER,
      JAEGER_HTTP_ENDPOINT,
    } = process.env;

    const serviceName =
      config?.serviceName || SERVICE_NAME || "unknown-service";
    const environment = config?.environment || ENV || "unknown";
    const version = config?.version || APP_VERSION || "unknown";
    const ddApiKey = config?.ddApiKey || DD_API_KEY;
    const ddSite = config?.ddSite || DD_SITE;
    const exportIntervalMillis = config?.exportIntervalMillis || 60000;

    const disableDatadog =
      config?.disableDatadog ??
      ["true", "1"].includes((DISABLE_DATADOG || "").toLowerCase().trim());

    const useJaeger =
      config?.useJaeger ??
      (ENV === "local" || NODE_ENV === "development" || USE_JAEGER === "true");

    const jaegerEndpoint =
      config?.jaegerEndpoint || JAEGER_HTTP_ENDPOINT || "http://localhost:4318";

    // Enable diagnostics if requested
    const enableDiagnostics =
      config?.enableDiagnostics ?? (useJaeger || NODE_ENV === "development");

    if (enableDiagnostics) {
      const level = config?.diagnosticLevel || DiagLogLevel.INFO;
      diag.setLogger(new DiagConsoleLogger(), level);
      debug.info(
        `🔍 OpenTelemetry diagnostics enabled (level: ${DiagLogLevel[level]})`,
      );
    }

    // Check if disabled
    if (disableDatadog) {
      debug.warn("⚠️  OpenTelemetry disabled via DISABLE_DATADOG");
      this.isInitialized = true;
      return;
    }

    // Validate required configuration for Datadog
    if (!useJaeger && !ddApiKey) {
      throw new Error(
        "DD_API_KEY is required when using Datadog. " +
          "Set DD_API_KEY environment variable or pass ddApiKey in config. " +
          `Current working directory: ${process.cwd()}`,
      );
    }

    try {
      // Configure trace exporter
      const traceExporter = useJaeger
        ? new OTLPTraceExporter({
            url: `${jaegerEndpoint}/v1/traces`,
          })
        : new OTLPTraceExporter({
            url: `https://http-intake.logs.${ddSite}/api/v2/otlp/v1/traces`,
            headers: {
              "DD-API-KEY": ddApiKey || "",
            },
          });

      // Configure metric exporter
      const metricReader = new PeriodicExportingMetricReader({
        exporter: useJaeger
          ? new OTLPMetricExporter({
              url: `${jaegerEndpoint}/v1/metrics`,
            })
          : new OTLPMetricExporter({
              url: `https://http-intake.logs.${ddSite}/api/v2/otlp/v1/metrics`,
              headers: {
                "DD-API-KEY": ddApiKey || "",
              },
            }),
        exportIntervalMillis,
      });

      // Detect and merge resources
      const resource = detectResources({
        detectors: [envDetector, processDetector, hostDetector],
      }).merge(
        resourceFromAttributes({
          [ATTR_SERVICE_NAME]: serviceName,
          environment: environment,
          "node.env": NODE_ENV || "unknown",
          "service.version": version,
        }),
      );

      // Initialize OpenTelemetry SDK
      this.sdk = new NodeSDK({
        resource,
        traceExporter,
        metricReader,
        instrumentations: [
          getNodeAutoInstrumentations({
            // Disable instrumentations that don't work well with Bun
            "@opentelemetry/instrumentation-fs": {
              enabled: false,
            },
            // Enable specific instrumentations
            "@opentelemetry/instrumentation-http": {
              enabled: true,
            },
            "@opentelemetry/instrumentation-redis": {
              enabled: true,
            },
          }),
        ],
      });

      this.sdk.start();
      this.isInitialized = true;

      debug.log("\n" + "=".repeat(60));
      debug.log(`✅ OpenTelemetry SDK initialized successfully`);
      debug.log("=".repeat(60));
      debug.log(`📊 Backend: ${useJaeger ? "Jaeger" : "Datadog"}`);
      debug.log(`🏷️  Service: ${serviceName}`);
      debug.log(`🌍 Environment: ${environment}`);
      debug.log(`📦 Version: ${version}`);
      if (useJaeger) {
        debug.log(`🔗 Jaeger: ${jaegerEndpoint}`);
      } else {
        debug.log(`🔗 Datadog Site: ${ddSite}`);
      }
      debug.log(`⏱️  Export Interval: ${exportIntervalMillis}ms`);
      debug.log(`🔗 Traces, Metrics & Logs with auto-correlation enabled`);
      debug.log("=".repeat(60) + "\n");

      // Gracefully shut down on process exit
      process.on("SIGTERM", () => {
        void this.shutdown();
      });

      process.on("SIGINT", () => {
        void this.shutdown();
      });
    } catch (error) {
      debug.error("❌ Failed to initialize OpenTelemetry SDK:", error);
      throw error;
    }
  }

  /**
   * Check if the SDK has been initialized
   */
  public getInitializationStatus(): boolean {
    return this.isInitialized;
  }

  /**
   * Shutdown the OpenTelemetry SDK gracefully.
   * This will flush any pending telemetry data.
   */
  public async shutdown(): Promise<void> {
    if (this.sdk) {
      debug.log("\n🛑 Shutting down OpenTelemetry SDK...");
      await this.sdk.shutdown();
      debug.log("✅ OpenTelemetry SDK shut down successfully");
      this.isInitialized = false;
    }
  }

  /**
   * Get the underlying NodeSDK instance.
   * Returns null if not initialized.
   */
  public getSDK(): NodeSDK | null {
    return this.sdk;
  }
}
