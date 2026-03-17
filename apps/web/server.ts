/**
 * Custom server: Next.js + Terminal WebSocket server in same process.
 * WebSocket attached to HTTP server (same port) for same-origin reliability.
 */
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { startWSServer } from "./lib/terminal/ws-handler";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

/**
 * Test if node-pty is working
 */
function testNodePty(): boolean {
  try {
    const { spawn } = require("node-pty");
    const pty = spawn("echo", ["test"], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || process.cwd(),
      env: process.env as Record<string, string>,
    });
    pty.kill();
    return true;
  } catch (error) {
    console.error("[Server] node-pty test failed:", (error as Error).message);
    return false;
  }
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Test node-pty before starting WebSocket server
  const nodePtyWorks = testNodePty();
  if (nodePtyWorks) {
    startWSServer({ server: httpServer });
  } else {
    console.warn("[Server] Terminal WebSocket disabled due to node-pty failure. The app will work but terminal features will be unavailable.");
    console.warn("[Server] To fix: Rebuild node-pty with 'pnpm rebuild node-pty' or install build tools (xcode-select on macOS)");
  }

  httpServer.listen(port, () => {
    console.log('\n' + '='.repeat(60));
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📍 Local:   http://localhost:${port}`);
    console.log(`📍 Network: http://0.0.0.0:${port}`);
    console.log(`📦 Mode:    ${dev ? "development" : "production"}`);
    if (nodePtyWorks) {
      console.log(`✅ Terminal WebSocket: enabled`);
    } else {
      console.log(`⚠️  Terminal WebSocket: disabled`);
    }
    console.log('='.repeat(60) + '\n');
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, closing server...');
    httpServer.close(() => {
      console.log('[Server] Server closed');
      process.exit(0);
    });
  });
}).catch((err) => {
  console.error('[Server] Failed to start Next.js:', err);
  process.exit(1);
});
