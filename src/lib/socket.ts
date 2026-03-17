import { io } from 'socket.io-client';

// Use polling first then upgrade to websocket for better compatibility with proxies/mobile
export const socket = io({
  transports: ['polling', 'websocket'],
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 20000,
});

socket.on('connect_error', (err) => {
  console.error("[Socket] Connection error:", err.message);
  // Fallback to polling if websocket fails
  socket.io.opts.transports = ['polling', 'websocket'];
});
