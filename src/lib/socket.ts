import { io } from 'socket.io-client';

// Use window.location.origin to ensure we connect to the same host
// In AI Studio, this handles both the dev and shared URLs correctly.
// For Vercel deployments, define VITE_SOCKET_URL to point to a backend that supports websockets (e.g. Render, Railway)
const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
const socketUrl = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');

console.log("[Socket] Initializing with URL:", socketUrl);

export const socket = io(socketUrl, {
  path: '/socket.io/',
  transports: ['websocket'],
  upgrade: false, // Don't even try to upgrade from polling
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 20000,
  autoConnect: true,
  forceNew: true,
});

socket.on('connect', () => {
  console.log("[Socket] Connected to server:", socket.id);
  console.log("[Socket] Current transport:", socket.io.engine.transport.name);
});

socket.on('connect_error', (err) => {
  console.error("[Socket] Connection error details:", {
    message: err.message,
    description: (err as any).description,
    context: (err as any).context,
    type: err.name
  });
  console.log("[Socket] Current transports config:", socket.io.opts.transports);
});

socket.on('disconnect', (reason) => {
  console.warn("[Socket] Disconnected:", reason);
  if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'ping timeout') {
    // Reconnect manually if server disconnected us or transport closed unexpectedly
    console.log("[Socket] Attempting manual reconnection...");
    setTimeout(() => {
      socket.connect();
    }, 1000);
  }
});
