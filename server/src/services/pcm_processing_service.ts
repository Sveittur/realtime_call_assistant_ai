// pcm_processing_service.ts
export type PCMProcessor = {
    process: (pcmBase64: string) => string;
    addStep: (step: (int16: Int16Array) => Int16Array) => void;
};

export function createPCMProcessor(): PCMProcessor {
    const pipeline: ((int16: Int16Array) => Int16Array)[] = [];

    // --------------------------
    // Helper DSP functions
    // --------------------------
    
    // Normalize Int16 array
    function normalize(int16: Int16Array): Int16Array {
        const max = Math.max(...int16.map(Math.abs));
        if (max === 0) return int16;
        const scale = 32767 / max;
        return int16.map(v => Math.round(v * scale)) as Int16Array;
    }

    // Low-pass filter (simple IIR)
    function lowpass(int16: Int16Array, alpha = 0.2): Int16Array {
        const out = new Int16Array(int16.length);
        out[0] = int16[0];
        for (let i = 1; i < int16.length; i++) {
            out[i] = Math.round(alpha * int16[i] + (1 - alpha) * out[i - 1]);
        }
        return out;
    }

    // Soft compression to reduce rigid spikes
    function softCompress(int16: Int16Array, threshold = 0.6): Int16Array {
        const factor = 32767 * threshold;
        return int16.map(v => {
            if (Math.abs(v) <= factor) return v;
            return Math.sign(v) * (factor + (Math.abs(v) - factor) / 2);
        }) as Int16Array;
    }

    // Subtle pitch modulation (random small variation)
    function pitchModulate(int16: Int16Array, amount = 0.003): Int16Array {
        const out = new Int16Array(int16.length);
        let index = 0;
        for (let i = 0; i < int16.length; i++) {
            out[i] = int16[Math.min(int16.length - 1, Math.floor(index))];
            index += 1 + (Math.random() - 0.5) * amount;
        }
        return out;
    }

    // --------------------------
    // Add default steps to pipeline
    // --------------------------
    pipeline.push(normalize);
    pipeline.push(lowpass);
    pipeline.push(softCompress);
    pipeline.push(pitchModulate);

    // --------------------------
    // Main process function
    // --------------------------
    function process(pcmBase64: string): string {
        const buffer = Buffer.from(pcmBase64, "base64");
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        let int16 = new Int16Array(arrayBuffer);

        // Run pipeline
        let processed: Int16Array = int16;
        for (const step of pipeline) {
            processed = step(processed);
        }

        // Convert back to base64
        return Buffer.from(processed.buffer).toString("base64");
    }

    // Allow adding custom steps
    function addStep(step: (int16: Int16Array) => Int16Array): void {
        pipeline.push(step);
    }

    return { process, addStep };
}
