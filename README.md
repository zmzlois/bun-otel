# bun-otel

Datadog compatible instrumentation for Bun, plus runnable examples that show how to wire
everything up.

## Distributed tracing demo

Two Bun services are included inside `examples/` so you can see cross-service traces without
writing any additional code:

- `examples/bun-server` – HTTP server with multiple endpoints, front-door for requests
- `examples/reporting-service` – downstream service that aggregates fake data

Both services call `OpenTelemetryClient` and wrap their `Bun.serve` handler with
`instrumentBunServer`, which makes it easy to propagate trace context between them.

### Running the example locally

1. `bun install`
2. Copy env files (`cp examples/bun-server/.env.example .env` and same for `reporting-service`) or run `bun run setup` if you already have a root `.env`
3. Start the downstream service: `bun run reporting-service`
4. Start the edge service: `bun run bun-server`
5. Hit `http://localhost:3000/api/external` – this endpoint calls the reporting-service and both sides emit spans
6. Try the additional transports:
   - `http://localhost:3000/api/report-stream` uses a WebSocket to stream a report
   - `http://localhost:3000/api/udp` sends a UDP datagram to the reporting-service and waits for an acknowledgement

If you set `REPORTS_SERVICE_URL` in `examples/bun-server/.env`, the upstream service will call
that URL instead (defaults to `http://localhost:4001`). Point your OpenTelemetry backend (Datadog
or Jaeger) at both services to verify that distributed traces show up end-to-end across HTTP, WebSocket, and UDP calls.
