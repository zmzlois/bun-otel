import { Elysia } from "elysia";
import { OpenTelemetryClient } from "bun-otel";

const client = new OpenTelemetryClient();

const app = new Elysia().get("/", () => "Hello Elysia").listen(3002);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);

console.log("something");
