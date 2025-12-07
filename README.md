# TalkWithStrangers - Production Ready

A fully functional, anonymous 1-on-1 chat application built for instant Vercel deployment.

## 🌟 Architecture (Serverless P2P)

To achieve **Real-time 1-on-1 Matching** on Vercel (which does not support persistent WebSocket servers), this project utilizes a **Distributed Mesh Queue** via WebRTC (PeerJS).

- **Backend Logic**: Instead of a central Redis queue (which requires external setup), clients perform a "Random Walk" on the PeerJS public signaling cloud.
- **The Queue**: Defined by a set of virtual "slots" (`anon-chat-lobby-v2-slot-0` to `50`).
- **Matching Algorithm**: 
  1. Client picks a random slot.
  2. Tries to **host** the slot.
  3. If successful: Waits for a partner (acts as Server).
  4. If failed (Slot Taken): Connects to the host (acts as Client).
  
This ensures 100% uptime, zero database costs, and instant scalability without managing a VPS.

## 🚀 Instant Deployment

1. **Deploy to Vercel**:
   - Run `vercel` in this directory.
   - Or connect your GitHub repo to Vercel.
   
2. **Environment Variables** (Optional):
   - `API_KEY`: Google Gemini API Key (Only required if you want the "AI Companion" feature to work. Human chat works without it).

## ✨ Features

- **Real Humans**: Random matchmaking with real people.
- **Typing Indicators**: See when the stranger is typing.
- **Vanish Mode**: Toggle to ensure no message persistence.
- **AI Fallback**: Intelligent bot mode if no humans are around.
- **Responsive**: Mobile-first design.

## 🛠️ Local Development

To run the full stack (Frontend + API) locally, use the Vercel CLI.

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Start the development server:
```bash
vercel dev
```
This will start the app at `http://localhost:3000`.

*Note: `npm run dev` will only start the frontend (Vite) and the API routes will not be active.*
