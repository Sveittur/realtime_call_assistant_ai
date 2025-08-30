"use client";
import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

interface VoiceCaptureProps {
  wsRef: React.MutableRefObject<WebSocket | null>;
  onUserSpeaking?: () => void; // NEW
}

export interface VoiceCaptureHandle {
  start: () => Promise<void>;
  stop: () => void;
}

const VoiceCapture = forwardRef<VoiceCaptureHandle, VoiceCaptureProps>(
  ({ wsRef, onUserSpeaking }, ref) => {
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

    let speaking = false;
    let silenceTimeout: NodeJS.Timeout | null = null;

    // Float32 → PCM16 converter
    const floatTo16BitPCM = (input: Float32Array) => {
      const buffer = new ArrayBuffer(input.length * 2);
      const view = new DataView(buffer);
      let offset = 0;
      for (let i = 0; i < input.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      }
      return buffer;
    };

    const detectSpeech = (input: Float32Array) => {
      // crude VAD: check RMS loudness
      let sum = 0;
      for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
      const rms = Math.sqrt(sum / input.length);

      if (rms > 0.02) { // threshold
        if (!speaking) {
          speaking = true;
          onUserSpeaking?.(); // 🚨 notify parent
        }
        if (silenceTimeout) clearTimeout(silenceTimeout);
        silenceTimeout = setTimeout(() => {
          speaking = false;
        }, 800); // reset after 800ms of silence
      }
    };

    const start = async () => {
      if (mediaStreamRef.current) return; // already started
      audioCtxRef.current = new AudioContext({ sampleRate: 16000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const source = audioCtxRef.current.createMediaStreamSource(stream);
      const processor = audioCtxRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        detectSpeech(inputData); // 👂 detect user talking
        const pcm = floatTo16BitPCM(inputData);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: Buffer.from(pcm).toString("base64"),
            })
          );
        }
      };

      source.connect(processor);
      processor.connect(audioCtxRef.current.destination);

      wsRef.current?.send(JSON.stringify({ type: "input_audio_buffer.start" }));
    };

    const stop = () => {
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      wsRef.current?.send(JSON.stringify({ type: "input_audio_buffer.stop" }));
    };

    useImperativeHandle(ref, () => ({ start, stop }));
    useEffect(() => stop, []); // cleanup on unmount

    return null;
  }
);

VoiceCapture.displayName = "VoiceCapture";
export default VoiceCapture;
