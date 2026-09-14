export type NoiseFilter = {
  track: MediaStreamTrack;
  stream: MediaStream;
  stop: () => void;
};

const WORKLET_URL = "/noise/rnnoiseWorklet.js";
const WASM_URL = "/noise/rnnoise.wasm";
const WASM_SIMD_URL = "/noise/rnnoise_simd.wasm";

export async function createNoiseFilter(
  sourceTrack: MediaStreamTrack,
): Promise<NoiseFilter | null> {
  if (typeof window === "undefined" || typeof AudioWorkletNode === "undefined") {
    return null;
  }

  try {
    const { loadRnnoise, RnnoiseWorkletNode } = await import(
      "@sapphi-red/web-noise-suppressor"
    );
    const context = new AudioContext({ sampleRate: 48000 });
    const wasmBinary = await loadRnnoise({
      url: WASM_URL,
      simdUrl: WASM_SIMD_URL,
    });
    await context.audioWorklet.addModule(WORKLET_URL, {
      type: "module",
    } as WorkletOptions);
    if (context.state === "suspended") await context.resume();

    const source = context.createMediaStreamSource(new MediaStream([sourceTrack]));
    const rnnoise = new RnnoiseWorkletNode(context, {
      maxChannels: 1,
      wasmBinary,
    });
    const destination = context.createMediaStreamDestination();
    source.connect(rnnoise);
    rnnoise.connect(destination);

    const track = destination.stream.getAudioTracks()[0];
    if (!track) {
      rnnoise.destroy();
      await context.close();
      return null;
    }

    return {
      track,
      stream: destination.stream,
      stop() {
        try {
          source.disconnect();
          rnnoise.disconnect();
          rnnoise.destroy();
        } catch {
          // already torn down
        }
        track.stop();
        void context.close();
      },
    };
  } catch {
    return null;
  }
}
