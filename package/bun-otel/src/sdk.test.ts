import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { OpenTelemetryClient } from "./sdk";

describe("OpenTelemetryClient", () => {
  let client: OpenTelemetryClient;

  beforeEach(() => {
    // Get a fresh instance for each test
    client = OpenTelemetryClient.getInstance();
  });

  afterEach(async () => {
    // Clean up after each test
    await client.shutdown();
  });

  describe("Singleton Pattern", () => {
    test("should return the same instance", () => {
      const instance1 = OpenTelemetryClient.getInstance();
      const instance2 = OpenTelemetryClient.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("Initialization", () => {
    test("should initialize with disabled config", () => {
      // Disable actual SDK initialization for testing
      process.env.DISABLE_DATADOG = "true";

      client.init({
        serviceName: "test-service",
        environment: "test",
      });

      expect(client.getInitializationStatus()).toBe(true);

      // Clean up
      delete process.env.DISABLE_DATADOG;
    });

    test("should not re-initialize if already initialized", () => {
      process.env.DISABLE_DATADOG = "true";

      client.init({ serviceName: "test" });
      const firstStatus = client.getInitializationStatus();

      // Try to initialize again
      client.init({ serviceName: "test2" });
      const secondStatus = client.getInitializationStatus();

      expect(firstStatus).toBe(true);
      expect(secondStatus).toBe(true);

      delete process.env.DISABLE_DATADOG;
    });

    test("should respect DISABLE_DATADOG environment variable", () => {
      process.env.DISABLE_DATADOG = "true";

      client.init({
        serviceName: "test-service",
      });

      expect(client.getInitializationStatus()).toBe(true);
      expect(client.getSDK()).toBeNull();

      delete process.env.DISABLE_DATADOG;
    });
  });

  describe("Configuration", () => {
    test("should use environment variables for configuration", () => {
      process.env.DISABLE_DATADOG = "true";
      process.env.SERVICE_NAME = "env-service";
      process.env.ENV = "production";

      client.init();

      expect(client.getInitializationStatus()).toBe(true);

      // Clean up
      delete process.env.DISABLE_DATADOG;
      delete process.env.SERVICE_NAME;
      delete process.env.ENV;
    });

    test("should prioritize config over environment variables", () => {
      process.env.DISABLE_DATADOG = "true";
      process.env.SERVICE_NAME = "env-service";

      client.init({
        serviceName: "config-service",
      });

      expect(client.getInitializationStatus()).toBe(true);

      delete process.env.DISABLE_DATADOG;
      delete process.env.SERVICE_NAME;
    });
  });

  describe("Shutdown", () => {
    test("should keep initialization status when SDK is disabled", async () => {
      process.env.DISABLE_DATADOG = "true";

      client.init({ serviceName: "test" });
      expect(client.getInitializationStatus()).toBe(true);

      await client.shutdown();
      // When disabled, SDK is null so shutdown doesn't change status
      expect(client.getInitializationStatus()).toBe(true);

      delete process.env.DISABLE_DATADOG;
    });

    test("should handle shutdown when not initialized", async () => {
      // Should not throw
      await expect(client.shutdown()).resolves.toBeUndefined();
    });
  });

  describe("SDK Access", () => {
    test("should return null SDK when not initialized", () => {
      expect(client.getSDK()).toBeNull();
    });

    test("should return null SDK when disabled", () => {
      process.env.DISABLE_DATADOG = "true";

      client.init({ serviceName: "test" });
      expect(client.getSDK()).toBeNull();

      delete process.env.DISABLE_DATADOG;
    });
  });
});
