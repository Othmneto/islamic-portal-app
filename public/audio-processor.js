// This class extends AudioWorkletProcessor to create a custom audio processing node.
// It runs in a separate thread from the main UI thread, providing high performance.
class AudioStreamerProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096;
        this.buffer = new Int16Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    // Helper function to convert the browser's Float32 audio data to 16-bit PCM format,
    // which is required by the AssemblyAI real-time transcription service.
    convertFloat32ToInt16(buffer) {
        let l = buffer.length;
        let buf = new Int16Array(l);
        while (l--) {
            // Clamp the values to the -1.0 to 1.0 range and convert to 16-bit integer.
            buf[l] = Math.min(1, buffer[l]) * 0x7FFF;
        }
        return buf;
    }

    // The main processing function, called by the browser's audio engine.
    process(inputs, outputs, parameters) {
        // We expect a single input with a single channel.
        const input = inputs[0];
        const inputChannel = input[0];

        if (inputChannel) {
            // Convert the incoming float32 data to int16
            const int16Data = this.convertFloat32ToInt16(inputChannel);

            // Send the processed audio data back to the main thread via the message port.
            // We send the underlying ArrayBuffer for maximum efficiency.
            this.port.postMessage(int16Data.buffer, [int16Data.buffer]);
        }

        // Return true to keep the processor alive and running.
        return true;
    }
}

// Register the custom processor with a unique name.
// This allows the main thread to create an instance of it.
registerProcessor('audio-streamer-processor', AudioStreamerProcessor);
