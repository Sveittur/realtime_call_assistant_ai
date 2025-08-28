// server/src/services/tts_service.ts
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { Readable } from "stream";

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

/**
 * Convert a chunk of text to TTS audio from ElevenLabs.
 * Returns a Node.js Readable stream.
 * @param text Text to synthesize
 * @returns Readable stream of audio (MP3)
 */
export async function textToSpeech(text: string): Promise<Readable> {
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot generate TTS for empty text");
  }

  // voice_id: pick your preferred voice
  const voiceId = "JBFqnCBsd6RMkjVDRZzb";

  // Call ElevenLabs TTS
  const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
    text,
    modelId: "eleven_flash_v2_5",
    outputFormat: "mp3_44100_128", // MP3 format
  });

  // ElevenLabs returns a ReadableStream; convert to Node.js Readable
  // @ts-ignore: ElevenLabs types
  const nodeStream = Readable.from(audioStream);

  return nodeStream;
}
