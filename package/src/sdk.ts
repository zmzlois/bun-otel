import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import {
  // type Resource,
  detectResources,
  resourceFromAttributes,
  envDetector,
  processDetector,
  hostDetector,
} from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";

const {
  DD_API_KEY,
  DD_SITE = "us5.datadoghq.com",
  DD_AGENT_HOST,
  ENV,
  NODE_ENV,
} = process.env;

// if (!DD_AGENT_HOST) {
//   throw new Error(`DD_AGENT_HOST is not set in current environment: ${DD_AGENT_HOST}. Current working directory: ${process.cwd()}s`);
// }

if (!DD_API_KEY) {
  throw new Error(`DD_API_KEY is not set in current environment: ${DD_AGENT_HOST}. Current working directory: ${process.cwd()}.`);
}

if (!DD_API_KEY) {
  throw new Error("DD_API_KEY is not set");
}

const DISABLE_DATADOG = ["true", "1"].includes(
  (process.env.DISABLE_DATADOG || "").toLowerCase().trim(),
);

const USE_JAEGER =
  ENV === "local" ||
  NODE_ENV === "development" ||
  process.env.USE_JAEGER === "true";

// Enable OpenTelemetry diagnostics in development
if (USE_JAEGER || NODE_ENV === "development") {
  console.log("Jaeger enabled for local development environment.")
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
}

export class OpenTelemetryClient {
  private static instance: OpenTelemetryClient;
  private sdk: NodeSDK | null = null;

  private constructor() {
    this.init();
  }

  public static getInstance() {
    if (!OpenTelemetryClient.instance) {
      OpenTelemetryClient.instance = new OpenTelemetryClient();
    }
    return OpenTelemetryClient.instance;
  }

  private init() {
    if (DISABLE_DATADOG) {
      console.warn("OpenTelemetry disabled via DISABLE_DATADOG");
      return;
    }

    const serviceName = process.env.SERVICE_NAME;
    const environment = ENV;
    const nodeEnv = NODE_ENV;

    // Configure trace exporter
    const traceExporter = USE_JAEGER
      ? new OTLPTraceExporter({
          url:
            process.env.JAEGER_HTTP_ENDPOINT ||
            "http://localhost:4318/v1/traces",
        })
      : new OTLPTraceExporter({
          url: `https://http-intake.logs.${DD_SITE}/api/v2/otlp/v1/traces`,
          headers: {
            "DD-API-KEY": DD_API_KEY || "",
          },
        });

    // Configure metric exporter
    const metricReader = new PeriodicExportingMetricReader({
      exporter: USE_JAEGER
        ? new OTLPMetricExporter({
            url:
              process.env.JAEGER_HTTP_ENDPOINT ||
              "http://localhost:4318/v1/metrics",
          })
        : new OTLPMetricExporter({
            url: `https://http-intake.logs.${DD_SITE}/api/v2/otlp/v1/metrics`,
            headers: {
              "DD-API-KEY": DD_API_KEY || "",
            },
          }),
      exportIntervalMillis: 60000, // Export every 60 seconds
    });

    const resource = detectResources({
      detectors: [envDetector, processDetector, hostDetector],
    }).merge(
      resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        "environment": environment,
        "node.env": nodeEnv,
        "service.version": process.env.APP_VERSION || "unknown",
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

    console.log(
      `✅ OpenTelemetry initialized (${USE_JAEGER ? "Jaeger" : "Datadog"} backend) for service: ${serviceName}`,
    );

    // Gracefully shut down on process exit
    process.on("SIGTERM", () => {
      this.shutdown();
    });
  }

  public async shutdown() {
    if (this.sdk) {
      await this.sdk.shutdown();
      console.log("OpenTelemetry SDK shut down");
    }
  }
}

export default OpenTelemetryClient.getInstance();
