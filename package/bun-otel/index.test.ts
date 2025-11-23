import { describe, test, expect } from "bun:test";
import * as BunOtel from "./index";

describe("Package Exports", () => {
  test("should export OpenTelemetry API", () => {
    expect(BunOtel.trace).toBeDefined();
    expect(BunOtel.metrics).toBeDefined();
    expect(BunOtel.context).toBeDefined();
    expect(BunOtel.SpanStatusCode).toBeDefined();
  });

  test("should export OpenTelemetryClient", () => {
    expect(BunOtel.OpenTelemetryClient).toBeDefined();
    expect(typeof BunOtel.OpenTelemetryClient.getInstance).toBe("function");
  });

  test("should export Logger", () => {
    expect(BunOtel.Logger).toBeDefined();
  });

  test("should export logger utility", () => {
    expect(BunOtel.logger).toBeDefined();
    expect(typeof BunOtel.logger.log).toBe("function");
    expect(typeof BunOtel.logger.error).toBe("function");
    expect(typeof BunOtel.logger.warn).toBe("function");
    expect(typeof BunOtel.logger.info).toBe("function");
  });

  test("should have correct singleton behavior", () => {
    const instance1 = BunOtel.OpenTelemetryClient.getInstance();
    const instance2 = BunOtel.OpenTelemetryClient.getInstance();

    expect(instance1).toBe(instance2);
  });
});
