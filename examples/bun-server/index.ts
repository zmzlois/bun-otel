const PORT = Number(process.env.PORT ?? 3000);

interface ApiRoutes {
  http: () => Promise<Response>;
  websocket: () => Promise<Response>;
  udp: () => Promise<Response>;
}

const api: ApiRoutes = {
  async http() {
    try {
      const response = await fetch(
        `${process.env.REPORTS_SERVICE_URL ?? "http://localhost:4001"}/reports`
      );
      const data = await response.json();
      return Response.json({
        message: "HTTP call successful",
        data,
      });
    } catch (error) {
      return Response.json(
        { error: "HTTP call failed", message: (error as Error).message },
        { status: 502 }
      );
    }
  },

  async websocket() {
    try {
      const data = await requestReportOverWebSocket();
      return Response.json({
        message: "WebSocket call successful",
        data,
      });
    } catch (error) {
      return Response.json(
        { error: "WebSocket call failed", message: (error as Error).message },
        { status: 502 }
      );
    }
  },

  async udp() {
    try {
      const ack = await sendReportViaUdp("report-sync");
      return Response.json({
        message: "UDP call successful",
        ack,
      });
    } catch (error) {
      return Response.json(
        { error: "UDP call failed", message: (error as Error).message },
        { status: 500 }
      );
    }
  },
};

// websocket client implementation
async function requestReportOverWebSocket(): Promise<unknown> {
  const wsUrl = process.env.REPORTS_WS_URL ?? "ws://localhost:4001/ws";

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("WebSocket timeout"));
    }, 5000);

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ action: "latest-report", requestedAt: Date.now() }));
    });

    ws.addEventListener("message", (event) => {
      clearTimeout(timeout);
      try {
        const data = typeof event.data === "string" ? event.data : event.data.toString();
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      } finally {
        ws.close();
      }
    });

    ws.addEventListener("error", (event) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket error: ${event instanceof Error ? event.message : "unknown"}`));
      ws.close();
    });
  });
}

// udp client implementation
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const reportingUdpPort = Number(process.env.REPORTING_UDP_PORT ?? 5001);
const serverUdpPort = Number(process.env.SERVER_UDP_PORT ?? 5002);
const reportsHost = process.env.REPORTS_HOST ?? "127.0.0.1";

interface UdpMessage {
  id: string;
  action: string;
  timestamp: number;
  replyPort: number;
}

interface UdpAck {
  id: string;
  status: string;
  processedAt: number;
  info?: string;
}

const pendingUdpRequests = new Map<
  string,
  {
    resolve: (payload: UdpAck) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }
>();

const udpSocket = await Bun.udpSocket({
  port: serverUdpPort,
  hostname: "0.0.0.0",
  socket: {
    data(_socket, buffer) {
      handleUdpAck(buffer);
    },
    error(_socket, error) {
      console.error("UDP socket error:", error);
    },
  },
});

function handleUdpAck(buffer: ArrayBufferView | ArrayBuffer) {
  try {
    const view =
      buffer instanceof ArrayBuffer
        ? new Uint8Array(buffer)
        : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const payload = JSON.parse(textDecoder.decode(view)) as UdpAck;

    const pending = pendingUdpRequests.get(payload.id);
    if (pending) {
      pending.resolve(payload);
    }
  } catch (error) {
    console.error("Failed to parse UDP ack:", error);
  }
}

async function sendReportViaUdp(action: string): Promise<UdpAck> {
  const messageId = crypto.randomUUID();
  const payload: UdpMessage = {
    id: messageId,
    action,
    timestamp: Date.now(),
    replyPort: serverUdpPort,
  };

  const result = udpSocket.send(
    textEncoder.encode(JSON.stringify(payload)),
    reportingUdpPort,
    reportsHost
  );

  if (result === false) {
    throw new Error("Failed to send UDP packet");
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingUdpRequests.delete(messageId);
      reject(new Error("UDP acknowledgment timeout"));
    }, 4000);

    pendingUdpRequests.set(messageId, {
      resolve: (payload) => {
        clearTimeout(timeout);
        pendingUdpRequests.delete(messageId);
        resolve(payload);
      },
      reject: (error) => {
        clearTimeout(timeout);
        pendingUdpRequests.delete(messageId);
        reject(error);
      },
      timeout,
    });
  });
}

// http server
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      return new Response("bun server example - try /api/http, /api/websocket, or /api/udp", {
        headers: { "content-type": "text/plain" },
      });
    }

    if (url.pathname === "/api/http") return api.http();
    if (url.pathname === "/api/websocket") return api.websocket();
    if (url.pathname === "/api/udp") return api.udp();

    return Response.json({ error: "not found" }, { status: 404 });
  },
});

console.log(`\nbun server running at http://localhost:${PORT}`);
console.log(`  /api/http      - http call to reporting service`);
console.log(`  /api/websocket - websocket call to reporting service`);
console.log(`  /api/udp       - udp call to reporting service`);
