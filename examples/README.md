# examples

simple examples demonstrating websocket, udp, and http communication between bun servers.

## structure

- **bun-server** - client server that communicates with reporting-service via http, websocket, and udp
- **reporting-service** - server that handles http requests, websocket connections, and udp messages
- **elysia** - simple elysia server example

## quick start

start the reporting service:

```bash
cd reporting-service
bun run dev
```

in another terminal, start the bun server:

```bash
cd bun-server
bun run dev
```

## testing communication

### http

```bash
curl http://localhost:3000/api/http
```

### websocket

```bash
curl http://localhost:3000/api/websocket
```

### udp

```bash
curl http://localhost:3000/api/udp
```

## ports

- bun-server: `3000` (http)
- reporting-service: `4001` (http + websocket)
- udp: `5001` (reporting-service), `5002` (bun-server)
