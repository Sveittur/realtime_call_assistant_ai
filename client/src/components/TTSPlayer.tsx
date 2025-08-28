"use client";

import { useEffect, useRef } from "react";

interface TTSPlayerProps {
  audioChunk: string | null; // base64 MP3
}

export default function TTSPlayer({ audioChunk }: TTSPlayerProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    if (!audioChunk) return;

    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    const audioCtx = audioContextRef.current;

    // Convert base64 MP3 to ArrayBuffer
    const binary = Uint8Array.from(atob(audioChunk), (c) => c.charCodeAt(0)).buffer;

    audioCtx.decodeAudioData(binary).then((decodedBuffer) => {
      queueRef.current.push(decodedBuffer);

      if (!isPlayingRef.current) {
        const playNextChunk = () => {
          if (queueRef.current.length === 0) {
            isPlayingRef.current = false;
            return;
          }

          isPlayingRef.current = true;
          const nextBuffer = queueRef.current.shift()!;
          const source = audioCtx.createBufferSource();
          source.buffer = nextBuffer;
          source.connect(audioCtx.destination);
          source.onended = playNextChunk;
          source.start();
        };

        playNextChunk();
      }
    });
  }, [audioChunk]);

  return null;
}
