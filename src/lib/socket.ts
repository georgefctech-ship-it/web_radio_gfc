import { io } from 'socket.io-client';

// Use window.location.origin to ensure we connect to the same host
// In AI Studio, this handles both the dev and shared URLs correctly.
// For Vercel deployments, define VITE_SOCKET_URL to point to a backend that supports websockets (e.g. Render, Railway)
const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
const rawSocketUrl = import.meta.env.VITE_SOCKET_URL || '';
const isPlaceholder = rawSocketUrl.includes('sua-url-do-render') || 
                      rawSocketUrl.includes('your-url') || 
                      rawSocketUrl === '' || 
                      rawSocketUrl === 'undefined' ||
                      rawSocketUrl === 'null';

const socketUrl = isPlaceholder ? (typeof window !== 'undefined' ? window.location.origin : '') : rawSocketUrl;

console.log("[Socket] Initializing...");
console.log("[Socket] Raw URL from env:", rawSocketUrl);
console.log("[Socket] Is Placeholder:", isPlaceholder);
console.log("[Socket] Final URL used:", socketUrl);
console.log("[Socket] Origin:", typeof window !== 'undefined' ? window.location.origin : 'N/A');

export const socket = io(socketUrl, {
  path: '/socket.io/',
  transports: ['polling', 'websocket'], // Try polling first for maximum compatibility, matching server
  upgrade: true, // Allow upgrading from polling to websocket
  reconnection: true,
  reconnectionAttempts: Infinity, // Keep trying forever
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
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
  
  // If websocket fails, it will automatically try polling if it's in the list
  // but we already put polling first now.
});

socket.on('disconnect', (reason) => {
  console.warn("[Socket] Disconnected:", reason);
  if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'ping timeout' || reason === 'transport error') {
    console.log("[Socket] Attempting manual reconnection...");
    setTimeout(() => {
      if (!socket.connected) {
        socket.connect();
      }
    }, 1000);
  }
});
