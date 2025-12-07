# AnonChat AI - Realtime Anonymous Chat

A production-ready, real-time anonymous chat application built with React, Tailwind CSS, PeerJS, and Gemini AI.

## Features

- **Random Stranger Chat**: Instantly match with an AI-powered personality that mimics a real human stranger (using Gemini 2.5 Flash).
- **Friend Chat**: P2P private rooms using PeerJS (WebRTC) for human-to-human chat.
- **Zero Latency**: Optimistic UI and edge streaming.
- **Modern UI**: Dark mode, responsive design, and smooth animations using Tailwind CSS.
- **Serverless**: Fully deployable to Vercel with no external database required.

## Project Structure

- `src/`: Frontend React application.
- `api/`: Vercel Serverless Functions (handles Gemini API proxying).
- `src/services/`: Logic for peer connection and AI handling.

## Requirements

- **Node.js**: v18+
- **Vercel Account**: For deployment.
- **Gemini API Key**: From Google AI Studio.

## Deployment Instructions

### 1. Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Create a new API Key.
3. Copy the key string.

### 2. Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel login`.
3. Run `vercel deploy` from the project root.
4. When asked for Environment Variables, add:
   - Name: `API_KEY`
   - Value: `[PASTE_YOUR_GEMINI_KEY_HERE]`

### 3. Verify

Once deployed, open the URL.
- Click "Start Random Chat" to test the AI stranger.
- Click "Chat with Friend" to generate a link and test P2P chat (open the link in a different browser/incognito).

## Local Development

1. Create a `.env` file in the root:
   ```
   API_KEY=your_gemini_key_here
   ```
2. Run `npm install`.
3. Run `npx vercel dev` (Required to simulate the API routes locally).
   *Note: Standard `npm run dev` will not serve the `/api` routes correctly without Vercel CLI.*

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS
- **P2P Networking**: PeerJS (WebRTC Signaling)
- **AI Backend**: Google GenAI SDK (Gemini 2.5 Flash)
- **Infrastructure**: Vercel Serverless Functions

## License

MIT
