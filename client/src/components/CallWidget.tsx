"use client";
import { useEffect, useRef, useState } from "react";
import TTSPlayer from "./TTSPlayer";
import PCMPlayer from "./rawTTSPlayer";
export default function CallWidget() {
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [audioChunk, setAudioChunk] = useState<string | null>(null);
  const [pcmChunk, setPCMChunk] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const [callStarted, setCallStarted] = useState(false);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:4000");
    wsRef.current = ws;

    ws.onopen = () => console.log("✅ Connected to Realtime server");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(data);

        // Incoming ElevenLabs audio
        if (data.type === "response.audio.delta" && data.delta) {
          setPCMChunk(data.delta); // send raw PCM16 to PCMPlayer
        }

        // Live transcript deltas
        if (data.type === "response.audio_transcript.delta" && data.delta) {
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1] || "";
            if (lastMsg.startsWith("AI: ")) {
              const updated = [...prev];
              updated[updated.length - 1] = lastMsg + data.delta;
              return updated;
            } else {
              return [...prev, "AI: " + data.delta];
            }
          });
        }
      } catch (err) {
        console.error("Failed to parse WS message", event.data);
      }
    };

    ws.onclose = () => console.log("❌ Disconnected");

    return () => ws.close();
  }, []);

  const startCall = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const systemPrompt = {
      type: "response.create",
      response: {
        modalities: ["text", "audio"],
        instructions: "You are a friendly AI call assistant. Start by greeting the user casually.",
        conversation: "auto",
        voice: "shimmer",
      },
    };

    wsRef.current.send(JSON.stringify(systemPrompt));
    setCallStarted(true);
  };

  const sendMessage = (text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    setMessages((prev) => [...prev, `You: ${text}`]);

    const recentContext = messages
      .filter((msg) => !msg.startsWith("Hello! How can I assist you today?"))
      .slice(-5)
      .map((m) => `User/Assistant: ${m}`)
      .join("\n");

    const event = {
      type: "response.create",
      response: {
        modalities: ["text", "audio"],
        instructions: recentContext
          ? `Continue the conversation with context:\n${recentContext}\nUser: ${text}`
          : text,
        conversation: "auto",
      },
    };

    wsRef.current.send(JSON.stringify(event));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="p-4 border rounded-lg max-w-md mx-auto">
      <h2 className="text-lg font-bold mb-2">Call Assistant</h2>

      {!callStarted && (
        <button
          onClick={startCall}
          className="mb-4 rounded bg-blue-500 px-4 py-2 text-white"
        >
          Start Call
        </button>
      )}

      <div className="space-y-2 h-64 overflow-y-auto border p-2 rounded mb-2">
        {messages.map((msg, i) => (
          <p key={i} className="bg-gray-100 p-2 rounded">
            {msg}
          </p>
        ))}
      </div>

      {callStarted && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            className="flex-1 border rounded px-2 py-1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
          />
          <button type="submit" className="rounded bg-blue-500 px-4 py-1 text-white">
            Send
          </button>
        </form>
      )}

      <PCMPlayer audioChunk={pcmChunk} sampleRate={16000} />
    </div>
  );
}
