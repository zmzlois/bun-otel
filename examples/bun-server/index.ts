import { handleHome } from "./routes/home";
import { handleUsers } from "./routes/users";
import { handleExternalCall } from "./routes/external";
import { handleError } from "./routes/error";
import { handleSlow } from "./routes/slow";
import { handleHealth } from "./routes/health";
import { handle404 } from "./routes/notFound";

const PORT = process.env.PORT ?? 3000;

/**
 * Main request handler
 */
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    try {
      // Route handling
      if (url.pathname === "/") {
        return handleHome();
      } else if (url.pathname === "/api/users") {
        return handleUsers();
      } else if (url.pathname === "/api/external") {
        return handleExternalCall();
      } else if (url.pathname === "/api/error") {
        return handleError();
      } else if (url.pathname === "/api/slow") {
        return handleSlow();
      } else if (url.pathname === "/health") {
        return handleHealth();
      } else {
        return handle404(url.pathname);
      }
    } catch (error) {
      console.error("Request failed:", error);
      return Response.json(
        {
          error: "Internal Server Error",
          message: (error as Error).message,
        },
        { status: 500 }
      );
    }
  },
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down gracefully...");
  void server.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down gracefully...");
  void server.stop();
  process.exit(0);
});

console.log(`\n🚀 Bun Server running at http://localhost:${PORT}`);
