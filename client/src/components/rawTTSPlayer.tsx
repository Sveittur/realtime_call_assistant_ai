"use client";

import { useEffect, useRef } from "react";

interface PCMPlayerProps {
  audioChunk: string | null; // base64-encoded PCM16
  sampleRate?: number; // usually 16000 or 22050
}

export default function PCMPlayer({ audioChunk, sampleRate = 16000 }: PCMPlayerProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    if (!audioChunk) return;

    if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate });
    const audioCtx = audioContextRef.current;

    // Convert base64 PCM16 to Float32Array
    const binary = Uint8Array.from(atob(audioChunk), (c) => c.charCodeAt(0));
    const float32 = new Float32Array(binary.length / 2);

    for (let i = 0; i < float32.length; i++) {
      const lo = binary[i * 2];
      const hi = binary[i * 2 + 1];
      let val = hi << 8 | lo;
      if (val >= 0x8000) val -= 0x10000;
      float32[i] = val / 0x8000;
    }

    queueRef.current.push(float32);

    if (!isPlayingRef.current) {
      const playNextChunk = () => {
        if (queueRef.current.length === 0) {
          isPlayingRef.current = false;
          return;
        }

        isPlayingRef.current = true;
        const nextChunk = queueRef.current.shift()!;
        const buffer = audioCtx.createBuffer(1, nextChunk.length, sampleRate);
        buffer.copyToChannel(nextChunk, 0);

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.playbackRate.value = 1.6;
        source.onended = playNextChunk;
        source.start();
      };

      playNextChunk();
    }
  }, [audioChunk, sampleRate]);

  return null;
}
