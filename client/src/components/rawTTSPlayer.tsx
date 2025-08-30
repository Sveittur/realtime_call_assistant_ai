"use client";
import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";

export interface PCMPlayerHandle {
  stop: () => void;
}

interface PCMPlayerProps {
  audioChunk: string | null;
  sampleRate?: number;
  playbackRate?: number; // optional control
}

const PCMPlayer = forwardRef<PCMPlayerHandle, PCMPlayerProps>(
  ({ audioChunk, sampleRate = 16000, playbackRate = 1.6 }, ref) => {
    const audioCtxRef = useRef<AudioContext | null>(null);
    const queueRef = useRef<Float32Array[]>([]);
    const isPlayingRef = useRef(false);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

    // Function to play next chunk
    const playNextChunk = () => {
      if (queueRef.current.length === 0) {
        isPlayingRef.current = false;
        return;
      }

      isPlayingRef.current = true;
      const nextChunk = queueRef.current.shift()!;
      const audioCtx = audioCtxRef.current!;
      const buffer = audioCtx.createBuffer(1, nextChunk.length, sampleRate);
      buffer.copyToChannel(nextChunk, 0);

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.playbackRate.value = playbackRate;
      source.onended = playNextChunk;
      source.start();
      currentSourceRef.current = source;
    };

    useImperativeHandle(ref, () => ({
      stop: () => {
        queueRef.current = [];
        isPlayingRef.current = false;
        if (currentSourceRef.current) {
          try {
            currentSourceRef.current.stop();
          } catch {}
          currentSourceRef.current.disconnect();
          currentSourceRef.current = null;
        }
      },
    }));

    useEffect(() => {
      if (!audioChunk) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext({ sampleRate });

      // Decode PCM16 → Float32
      const binary = Uint8Array.from(atob(audioChunk), (c) => c.charCodeAt(0));
      const float32 = new Float32Array(binary.length / 2);
      for (let i = 0; i < float32.length; i++) {
        const lo = binary[i * 2];
        const hi = binary[i * 2 + 1];
        let val = (hi << 8) | lo;
        if (val >= 0x8000) val -= 0x10000;
        float32[i] = val / 0x8000;
      }

      queueRef.current.push(float32);

      if (!isPlayingRef.current) {
        playNextChunk();
      }
    }, [audioChunk, sampleRate, playbackRate]);

    return null;
  }
);

PCMPlayer.displayName = "PCMPlayer";
export default PCMPlayer;
