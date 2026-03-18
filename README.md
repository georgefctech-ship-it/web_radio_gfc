<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/7b98e7e7-2f5d-49f7-b558-b8a8cafd0cb1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Socket Server In Production

The live studio audio path uses `socket.io` + WebRTC and must run on a server with persistent websocket support.

Recommended setup:

1. Deploy [server.ts](/Users/GeorgeDeveloper/Desktop/web_radio_gfc-main/server.ts) to Render using [render.yaml](/Users/GeorgeDeveloper/Desktop/web_radio_gfc-main/render.yaml).
2. In Render, set:
   `ALLOWED_ORIGINS=https://SEU-PROJETO.vercel.app`
3. In Vercel, set:
   `VITE_SOCKET_URL=https://SEU-BACKEND-RENDER.onrender.com`
4. Redeploy the Vercel frontend.

Without `VITE_SOCKET_URL`, the site tries to use the Vercel origin for websockets, and the live microphone/vignette broadcast will not reach listeners.
