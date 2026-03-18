import { io } from 'socket.io-client';

// Use window.location.origin to ensure we connect to the same host
// In AI Studio, this handles both the dev and shared URLs correctly.
// For Vercel deployments, define VITE_SOCKET_URL to point to a backend that supports websockets (e.g. Render, Railway)
const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
const socketUrl = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');

export const socket = io(socketUrl, {
  // Try websocket first, fallback to polling
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  timeout: 10000,
  autoConnect: true,
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
