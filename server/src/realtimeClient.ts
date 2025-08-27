// server/src/realtimeClient.ts
import WebSocket from "ws";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
console.log(OPENAI_API_KEY);

export function setupRealtimeProxy(wss: WebSocket.Server) {
  wss.on("connection", async (clientWs) => {
    console.log("🔌 Client connected");

    // Create a connection to OpenAI Realtime API
    const openAiWs = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1",
        },
      }
    );

    openAiWs.on("open", () => {
        console.log("Connected to OPENAI.");
    });

    // Forward GPT → Browser
    openAiWs.on("message", (msg) => {
      clientWs.send(msg.toString());
    });

    // Forward Browser → GPT
    clientWs.on("message", (msg) => {
      openAiWs.send(msg.toString());
    });

    // Handle cleanup
    clientWs.on("close", () => {
      console.log("❌ Client disconnected");
      openAiWs.close();
    });
  });
}
