const PORT = Number(process.env.PORT ?? 4001);
const reportingUdpPort = Number(process.env.REPORTING_UDP_PORT ?? 5001);
const serverUdpPort = Number(process.env.SERVER_UDP_PORT ?? 5002);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

interface UdpMessage {
  id: string;
  action: string;
  timestamp: number;
  replyPort?: number;
}

interface UdpAck {
  id: string;
  status: string;
  processedAt: number;
  info?: string;
}

// websocket handler
const websocketHandler: Bun.WebSocketHandler<undefined> = {
  open(ws: Bun.ServerWebSocket<undefined>) {
    ws.send(
      JSON.stringify({
        message: "connected to reporting service",
      })
    );
  },

  async message(ws: Bun.ServerWebSocket<undefined>, message: string | Buffer) {
    const payload = parseMessage(message);

    if (payload?.action === "latest-report") {
      // simulate some work
      await Bun.sleep(50 + Math.random() * 100);

      const report = {
        service: "reporting-service",
        generatedAt: new Date().toISOString(),
        totals: {
          users: Math.floor(Math.random() * 500) + 25,
          invoices: Math.floor(Math.random() * 500) + 25,
        },
      };

      ws.send(
        JSON.stringify({
          type: "report",
          report,
        })
      );
    } else {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "unknown action",
        })
      );
    }
  },
};

// udp socket
const udpSocket = await Bun.udpSocket({
  port: reportingUdpPort,
  hostname: "0.0.0.0",
  socket: {
    async data(socket, buffer, remotePort, remoteAddress) {
      const parsed = parseUdpPayload(buffer);
      if (!parsed) return;

      // simulate some work
      await Bun.sleep(20 + Math.random() * 60);

      const ack: UdpAck = {
        id: parsed.id,
        status: "processed",
        info: "ack from reporting-service",
        processedAt: Date.now(),
      };

      const targetPort = parsed.replyPort ?? serverUdpPort;
      socket.send(textEncoder.encode(JSON.stringify(ack)), targetPort, remoteAddress);
    },
    error(_socket, error) {
      console.error("UDP socket error:", error);
    },
  },
});

// http server
const server = Bun.serve({
  port: PORT,
  websocket: websocketHandler,

  async fetch(req, serverInstance) {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      const upgraded = serverInstance.upgrade(req);
      if (!upgraded) {
        return new Response("websocket upgrade failed", { status: 500 });
      }
      return undefined;
    }

    if (url.pathname === "/reports") {
      // simulate some work
      await Bun.sleep(50 + Math.random() * 100);

      return Response.json({
        service: "reporting-service",
        generatedAt: new Date().toISOString(),
        totals: {
          users: Math.floor(Math.random() * 500) + 25,
          invoices: Math.floor(Math.random() * 500) + 25,
        },
      });
    }

    return Response.json({ error: "not found" }, { status: 404 });
  },
});

function parseUdpPayload(buffer: Buffer): UdpMessage | null {
  try {
    return JSON.parse(textDecoder.decode(buffer)) as UdpMessage;
  } catch (error) {
    console.error("failed to parse UDP payload:", error);
    return null;
  }
}

function parseMessage(
  message: string | ArrayBuffer | Uint8Array | Buffer
): Record<string, any> | null {
  try {
    if (typeof message === "string") {
      return JSON.parse(message);
    }
    if (message instanceof ArrayBuffer) {
      return JSON.parse(textDecoder.decode(new Uint8Array(message)));
    }
    if (message instanceof Uint8Array) {
      return JSON.parse(textDecoder.decode(message));
    }
    if (Buffer.isBuffer(message)) {
      return JSON.parse(textDecoder.decode(message));
    }
    return null;
  } catch {
    return null;
  }
}

console.log(`\nreporting service running at http://localhost:${PORT}`);
console.log(`  /reports - http endpoint`);
console.log(`  /ws      - websocket endpoint`);
console.log(`  UDP listening on ${udpSocket.hostname ?? "0.0.0.0"}:${udpSocket.port}`);
