import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use((req, res, next) => {
    if (req.url.includes('socket.io')) {
      console.log(`[Server] Socket.io request: ${req.method} ${req.url}`);
    }
    next();
  });
  app.use(cors()); // Enable CORS for all routes
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000
  });

  const PORT = 3000;

  // ... (Socket.io logic remains same)
  const messages: any[] = [];
  const stationVotes: Record<string, { likes: number, dislikes: number }> = {};
  let isLive = false;
  let liveBroadcasterId: string | null = null;

  io.on("connection", (socket) => {
    console.log(`[Socket] New connection: ${socket.id} (Total: ${io.engine.clientsCount})`);
    
    // Update listener count for everyone
    const currentCount = io.engine.clientsCount;
    io.emit("listeners:count", currentCount);
    
    // Also send specifically to this socket to ensure they get it immediately
    socket.emit("listeners:count", currentCount);

    // Send initial state
    socket.emit("chat:history", messages);
    socket.emit("live:status", { isLive, broadcasterId: liveBroadcasterId });

    socket.on("ping", (cb) => {
      if (typeof cb === 'function') cb({ status: 'ok', time: Date.now() });
    });
    socket.emit("votes:initial", stationVotes);

    socket.on("listeners:request", () => {
      socket.emit("listeners:count", io.engine.clientsCount);
    });

    socket.on("station:vote", ({ stationId, type }: { stationId: string, type: 'like' | 'dislike' | 'remove_like' | 'remove_dislike' }) => {
      if (!stationVotes[stationId]) {
        stationVotes[stationId] = { likes: 0, dislikes: 0 };
      }

      if (type === 'like') {
        stationVotes[stationId].likes++;
      } else if (type === 'dislike') {
        stationVotes[stationId].dislikes++;
      } else if (type === 'remove_like') {
        stationVotes[stationId].likes = Math.max(0, stationVotes[stationId].likes - 1);
      } else if (type === 'remove_dislike') {
        stationVotes[stationId].dislikes = Math.max(0, stationVotes[stationId].dislikes - 1);
      }

      io.emit("station:vote_update", { stationId, votes: stationVotes[stationId] });
    });

    socket.on("chat:message", (msg) => {
      const message = {
        id: Date.now(),
        user: msg.user || "Anonymous",
        text: msg.text,
        timestamp: new Date().toISOString(),
        avatar: msg.avatar
      };
      messages.push(message);
      if (messages.length > 50) messages.shift();
      io.emit("chat:message", message);
    });

    // Live Streaming Logic
    socket.on("live:start", () => {
      isLive = true;
      liveBroadcasterId = socket.id;
      io.emit("live:status", { isLive, broadcasterId: liveBroadcasterId });
      console.log("Live started by:", socket.id);
      // Notify all listeners to request stream
      socket.broadcast.emit("webrtc:broadcast-ready");
    });

    socket.on("live:stop", () => {
      if (socket.id === liveBroadcasterId) {
        isLive = false;
        liveBroadcasterId = null;
        io.emit("live:status", { isLive, broadcasterId: null });
        console.log("Live stopped by:", socket.id);
      }
    });

    socket.on("vignette:start", (data) => {
      // If no broadcaster is set, the one starting the vignette becomes the broadcaster
      if (!liveBroadcasterId) {
        liveBroadcasterId = socket.id;
        io.emit("live:status", { isLive, broadcasterId: liveBroadcasterId });
      }
      
      if (socket.id === liveBroadcasterId) {
        console.log("[Socket] Vignette START event received from broadcaster", socket.id, data?.url);
        io.emit("vignette:start", data);
        // Notify all listeners to request stream if they haven't
        socket.broadcast.emit("webrtc:broadcast-ready");
      }
    });

    socket.on("vignette:end", () => {
      if (socket.id === liveBroadcasterId) {
        console.log("[Socket] Vignette END event received from broadcaster", socket.id);
        io.emit("vignette:end");
      }
    });

    // WebRTC Signaling Relay
    socket.on("webrtc:request-stream", () => {
      if (liveBroadcasterId) {
        io.to(liveBroadcasterId).emit("webrtc:request-stream", { listenerId: socket.id });
      }
    });

    socket.on("webrtc:offer", ({ targetId, offer }) => {
      io.to(targetId).emit("webrtc:offer", { fromId: socket.id, offer });
    });

    socket.on("webrtc:answer", ({ targetId, answer }) => {
      io.to(targetId).emit("webrtc:answer", { fromId: socket.id, answer });
    });

    socket.on("webrtc:ice-candidate", ({ targetId, candidate }) => {
      io.to(targetId).emit("webrtc:ice-candidate", { fromId: socket.id, candidate });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      io.emit("listeners:count", io.engine.clientsCount);
      
      if (socket.id === liveBroadcasterId) {
        isLive = false;
        liveBroadcasterId = null;
        io.emit("live:status", { isLive, broadcasterId: null });
      }
    });
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Radio API proxy to avoid CORS issues and handle flaky mirrors
  const proxyCache = new Map<string, { data: any, timestamp: number }>();
  const PROXY_CACHE_TTL = 1000 * 60 * 10; // 10 minutes
  
  let verifiedMirrors: string[] = [
    "de1.api.radio-browser.info",
    "fr1.api.radio-browser.info",
    "nl1.api.radio-browser.info",
    "at1.api.radio-browser.info",
    "ca1.api.radio-browser.info",
    "all.api.radio-browser.info"
  ];

  // Periodically refresh mirror list
  const refreshMirrors = async () => {
    try {
      console.log("[Radio Proxy] Refreshing mirror list...");
      const response = await fetch("https://all.api.radio-browser.info/json/servers", {
        headers: { 'User-Agent': 'RadioGeorgeFctech/1.0 (georgefctech@gmail.com)' }
      });
      if (response.ok) {
        const servers: any[] = await response.json();
        const newMirrors = servers.map(s => s.name).filter(Boolean);
        if (newMirrors.length > 0) {
          verifiedMirrors = newMirrors;
          console.log(`[Radio Proxy] Found ${verifiedMirrors.length} mirrors.`);
        }
      }
    } catch (err) {
      console.error("[Radio Proxy] Failed to refresh mirrors, using defaults:", err);
    }
  };
  
  refreshMirrors();
  setInterval(refreshMirrors, 1000 * 60 * 60); // Every hour

  app.get("/api/radio/*", async (req, res) => {
    const pathPart = req.params[0] || "";
    const query = new URLSearchParams(req.query as any).toString();
    const cacheKey = `${pathPart}?${query}`;

    // Check cache
    const cached = proxyCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PROXY_CACHE_TTL) {
      console.log(`[Radio Proxy] CACHE HIT: ${pathPart}`);
      return res.json(cached.data);
    }
    
    console.log(`[Radio Proxy] Requesting: ${pathPart} | Query: ${query}`);

    const shuffledMirrors = [...verifiedMirrors].sort(() => Math.random() - 0.5);
    
    const tryMirror = async (mirror: string, protocol: string, signal: AbortSignal) => {
      const url = `${protocol}://${mirror}/json/${pathPart}${query ? '?' + query : ''}`;
      try {
        const response = await fetch(url, { 
          signal: signal as any,
          headers: { 
            'User-Agent': 'RadioGeorgeFctech/1.0 (georgefctech@gmail.com; https://ais-pre-inp6d22lv6tophe7edk6qh-293098167130.us-east1.run.app)',
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          const text = await response.text().catch(() => "No body");
          throw new Error(`Status ${response.status}: ${text.substring(0, 100)}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error(`Invalid content-type: ${contentType}`);
        }

        const data = await response.json();
        console.log(`[Radio Proxy] SUCCESS: ${mirror} (${protocol.toUpperCase()})`);
        return data;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn(`[Radio Proxy] Mirror Failed: ${mirror} (${protocol.toUpperCase()}) - ${err.message}`);
        }
        throw err;
      }
    };

    // Try in batches of 4 mirrors (8 requests: 4 HTTPS, 4 HTTP)
    const batchSize = 4;
    for (let i = 0; i < shuffledMirrors.length; i += batchSize) {
      const batch = shuffledMirrors.slice(i, i + batchSize);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s per batch

      try {
        console.log(`[Radio Proxy] Trying Batch ${Math.floor(i/batchSize) + 1} (${batch.length} mirrors)...`);
        const promises = batch.flatMap(m => [
          tryMirror(m, 'https', controller.signal),
          tryMirror(m, 'http', controller.signal)
        ]);

        const result = await Promise.any(promises);
        clearTimeout(timeoutId);
        controller.abort(); // Cancel other pending requests in the batch

        // Update cache
        proxyCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return res.json(result);
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AggregateError') {
          console.warn(`[Radio Proxy] Batch ${Math.floor(i/batchSize) + 1} failed: All mirrors in batch returned errors.`);
        } else if (err.name === 'AbortError') {
          console.warn(`[Radio Proxy] Batch ${Math.floor(i/batchSize) + 1} timed out after 15s.`);
        } else {
          console.warn(`[Radio Proxy] Batch ${Math.floor(i/batchSize) + 1} failed with error:`, err.message);
        }
        
        // Small delay before next batch to let network settle
        if (i + batchSize < shuffledMirrors.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    console.error(`[Radio Proxy] All mirrors failed for request: ${pathPart}`);
    res.status(503).json({ 
      error: "Service Unavailable", 
      message: "Could not connect to any radio mirrors. The radio directory might be down. Please try again later." 
    });
  });

  // Generic Supabase Proxy to help with client-side fetch errors
  app.get("/api/supabase/:table", async (req, res) => {
    const { table } = req.params;
    console.log(`[Supabase Proxy] Received request for table: ${table}`);
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://cnchoabsmggvdqvvhhcx.supabase.co";
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuY2hvYWJzbWdndmRxdnZoaGN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNTQ0NjYsImV4cCI6MjA4NzkzMDQ2Nn0.nJf5hIqaHgZRVdLc9nZhsgT6g-vyT3iLjOOcaWdMLwk";
    
    const query = new URLSearchParams(req.query as any).toString();
    const url = `${supabaseUrl}/rest/v1/${table}${query ? '?' + query : ''}`;
    
    console.log(`[Supabase Proxy] Proxying to: ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`[Supabase Proxy] Supabase response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Supabase Proxy] Supabase error: ${errorText}`);
        throw new Error(`Supabase returned ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`[Supabase Proxy] Successfully fetched ${Array.isArray(data) ? data.length : 'object'} items.`);
      res.json(data);
    } catch (err: any) {
      console.error(`[Supabase Proxy] Error for ${table}:`, err.message);
      res.status(500).json({ error: "Failed to fetch from Supabase", message: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
  }

  // Catch-all route for SPA - MUST be after all other routes
  app.get("*", (req, res) => {
    if (process.env.NODE_ENV !== "production") {
      // In dev, Vite handles the SPA fallback via middleware, 
      // but if it reaches here, we can redirect to root or let it 404.
      // Actually, Vite's middleware should have caught it.
      res.status(404).send("Page not found in development");
    } else {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    }
  });

  app.use((err: any, req: any, res: any, next: any) => {
    console.error("[Express Error Handler]", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
