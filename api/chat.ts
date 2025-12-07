import { GoogleGenAI } from "@google/genai";

export const config = {
  runtime: 'edge',
};

// Define types locally for the API handler
interface ChatRequestBody {
  messages: { role: string; content: string }[];
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { messages } = await request.json() as ChatRequestBody;
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error: API Key missing' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Convert frontend messages to Gemini format
    // Filter out system messages
    const conversationHistory = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'me' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

    // Generate response using gemini-2.5-flash
    // We simulate a "Stranger" persona via system instructions
    const systemInstruction = `
      You are a random stranger on an anonymous chat platform like Omegle. 
      Pick a random persona (Age, Gender, Location, Interests) and stick to it implicitly. 
      Do NOT announce your persona at the start. Reveal it naturally only if asked.
      Keep your responses relatively short, informal, and conversational. 
      Use lowercase often, maybe occasional slang or typos to feel human.
      Do not be overly helpful or robotic. Be casual.
      If the user says "ASL", give your persona's Age, Sex, Location.
      Never reveal you are an AI.
    `;

    // Note: generateContentStream returns a stream of chunks.
    // We need to pipe this to the response.
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: conversationHistory,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.9, // High creativity for "randomness"
        maxOutputTokens: 150, // Keep chat snappy
      }
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of responseStream) {
            const text = chunk.text;
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}