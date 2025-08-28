import WebSocket from "ws";
import { textToSpeech } from "./services/tts_service";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

export function setupRealtimeProxy(wss: WebSocket.Server) {
  wss.on("connection", async (clientWs) => {
    console.log("🔌 Client connected");

    const openAiWs = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1",
        },
      }
    );

    openAiWs.on("open", () => console.log("Connected to OPENAI."));

    let ttsBuffer = ""; // accumulates deltas
    const TTS_WORD_THRESHOLD = 5;

    openAiWs.on("message", async (msg) => {
      const data = JSON.parse(msg.toString());
      clientWs.send(msg.toString()); // still forward events if needed

      // if (data.type === "response.audio_transcript.delta" && data.delta) {
      //   ttsBuffer += " " + data.delta;

      //   const words = ttsBuffer.trim().split(/\s+/);
      //   if (words.length >= TTS_WORD_THRESHOLD) {
      //     const chunkToSpeak = words.slice(0, TTS_WORD_THRESHOLD).join(" ");
      //     ttsBuffer = words.slice(TTS_WORD_THRESHOLD).join(" "); // remaining words

      //     try {
      //       const audioStream = await textToSpeech(chunkToSpeak); // returns Node.js Readable

      //       const audioChunks: Uint8Array[] = [];
      //       for await (const chunk of audioStream) audioChunks.push(chunk);

      //       const audioBase64 = Buffer.concat(audioChunks).toString("base64");

      //       clientWs.send(JSON.stringify({
      //         type: "tts.audio",
      //         audio: audioBase64
      //       }));
      //     } catch (err) {
      //       console.error("TTS generation failed", err);
      //     }
      //   }
      // }
    });


    // Forward Browser → GPT
    clientWs.on("message", (msg) => openAiWs.send(msg.toString()));

    // Cleanup
    clientWs.on("close", () => {
      console.log("❌ Client disconnected");
      openAiWs.close();
    });
  });
}
