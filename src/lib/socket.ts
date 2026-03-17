import { io } from 'socket.io-client';

// Use window.location.origin to ensure we connect to the same host
// In AI Studio, this handles both the dev and shared URLs correctly.
const socketUrl = typeof window !== 'undefined' ? window.location.origin : '';

export const socket = io(socketUrl, {
  transports: ['websocket', 'polling'], // Prefer websocket for lower latency
  reconnectionAttempts: 20,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  autoConnect: true,
  forceNew: true,
});

socket.on('connect', () => {
  console.log("[Socket] Connected to server:", socket.id);
});

socket.on('connect_error', (err) => {
  console.error("[Socket] Connection error:", err.message);
  // Fallback to polling if websocket fails
  if (socket.io.opts.transports?.[0] === 'websocket') {
    console.warn("[Socket] Websocket failed, falling back to polling...");
    socket.io.opts.transports = ['polling', 'websocket'];
  }
});

socket.on('disconnect', (reason) => {
  console.warn("[Socket] Disconnected:", reason);
  if (reason === 'io server disconnect' || reason === 'transport close') {
    // Reconnect manually if server disconnected us or transport closed unexpectedly
    socket.connect();
  }
});
