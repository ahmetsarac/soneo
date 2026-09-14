import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const webDir = dirname(fileURLToPath(import.meta.url));

function copyNoiseAssets() {
  try {
    const dest = join(process.cwd(), "public/noise");
    mkdirSync(dest, { recursive: true });
    for (const name of [
      "rnnoiseWorklet.js",
      "rnnoise.wasm",
      "rnnoise_simd.wasm",
    ] as const) {
      copyFileSync(
        require.resolve(`@sapphi-red/web-noise-suppressor/${name}`),
        join(dest, name),
      );
    }
  } catch (err) {
    console.warn("noise assets copy failed", err);
  }
}

copyNoiseAssets();

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: join(webDir, "../.."),
};

export default nextConfig;
