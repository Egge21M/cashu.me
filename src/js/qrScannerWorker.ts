import {
  prepareZXingModule,
  readBarcodes,
  type ReaderOptions,
} from "zxing-wasm/reader";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

// QrScanner.configureWasm only configures its main-thread image decoder.
// Configure the camera worker separately so scanning also works offline.
prepareZXingModule({ overrides: { locateFile: () => wasmUrl } });

let options: ReaderOptions = {
  formats: ["QRCode"],
  tryHarder: true,
  tryInvert: true,
  tryRotate: true,
  tryDownscale: true,
  maxNumberOfSymbols: 1,
};

// Implements @agicash/qr-scanner's worker message protocol.
self.onmessage = async ({ data }: MessageEvent) => {
  if (data.type === "configure") {
    options = { ...options, ...data.options, formats: ["QRCode"] };
    return;
  }
  if (data.type !== "decode") return;
  try {
    const results = await readBarcodes(data.imageData, options);
    self.postMessage({
      type: "result",
      results: results
        .filter((result) => result.isValid)
        .map((result) => ({
          data: result.text,
          cornerPoints: [
            result.position.topLeft,
            result.position.topRight,
            result.position.bottomRight,
            result.position.bottomLeft,
          ],
        })),
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "QR decoding failed",
    });
  }
};
self.postMessage({ type: "ready" });
