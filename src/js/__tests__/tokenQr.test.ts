import { beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import QRCode from "qrcode";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import { Amount, getEncodedToken } from "@cashu/cashu-ts";
import {
  createTokenQrEncoder,
  scannedHexToBytes,
  TokenQrDecoder,
  TOKEN_QR_BYTES,
} from "src/js/tokenQr";

const token = getEncodedToken({
  mint: "https://mint.example",
  unit: "sat",
  proofs: Array.from({ length: 12 }, (_, index) => ({
    id: "009a1f293253e41e",
    amount: Amount.from(1),
    secret: `not-spendable-${index}`,
    C: "02" + "11".repeat(32),
  })),
});

beforeAll(async () => {
  prepareZXingModule({
    overrides: {
      wasmBinary: await readFile(
        resolve("node_modules/zxing-wasm/dist/reader/zxing_reader.wasm")
      ),
    },
  });
});

describe("token QR transport", () => {
  it("recovers the exact token through binary QR images with lost and duplicate frames", async () => {
    const encoder = createTokenQrEncoder(token);
    const decoder = new TokenQrDecoder();
    let result;
    for (let index = 0; index < 100 && !result; index++) {
      const frame = encoder.nextPart() as Uint8Array;
      expect(frame.length).toBe(TOKEN_QR_BYTES);
      if (index % 3 === 0) continue;
      const png = await QRCode.toBuffer([{ data: frame, mode: "byte" }]);
      // Exercise precisely the Hex output consumed by our scanner wrapper.
      const [scan] = await readBarcodes(png, {
        formats: ["QRCode"],
        textMode: "Hex",
      });
      expect(scan).toBeDefined();
      const bytes = scannedHexToBytes(scan.text);
      expect(bytes).toEqual(frame);
      result = decoder.receive(bytes);
      const progress = decoder.progress;
      decoder.receive(bytes);
      expect(decoder.progress).toBe(progress);
    }
    expect(result).toBe(token);
    expect(decoder.progress).toBe(1);
  });

  it.each(["fountain", "ur"] as const)(
    "preserves legacy token text via %s",
    (format) => {
      // A transport fixture; validating or redeeming V3 is the wallet's job.
      const text = "cashuA" + "legacy-transport-fixture".repeat(30);
      const encoder = createTokenQrEncoder(text, 256, format);
      const decoder = new TokenQrDecoder();
      let result;
      for (let i = 0; i < 100 && !result; i++) {
        const frame = encoder.nextPart();
        result = decoder.receive(
          typeof frame === "string"
            ? new TextEncoder().encode(frame.toUpperCase())
            : frame
        );
      }
      expect(result).toBe(text);
    }
  );

  it("reads existing UR-encoded V4 tokens", () => {
    const encoder = createTokenQrEncoder(token, 150, "ur");
    const decoder = new TokenQrDecoder();
    let result;
    for (let i = 0; i < 100 && !result; i++) {
      result = decoder.receive(
        new TextEncoder().encode(encoder.nextPart() as string)
      );
    }
    expect(result).toBe(token);
  });

  it("ignores damaged/foreign frames without losing progress and resets between formats", () => {
    const encoder = createTokenQrEncoder(token);
    const decoder = new TokenQrDecoder();
    const first = encoder.nextPart() as Uint8Array;
    decoder.receive(first);
    const progress = decoder.progress;
    const corrupt = first.slice();
    corrupt[30] ^= 255;
    expect(() => decoder.receive(corrupt)).toThrow();
    expect(decoder.progress).toBe(progress);
    const foreign = createTokenQrEncoder(
      "cashuA" + "different".repeat(100)
    ).nextPart();
    expect(() => decoder.receive(foreign as Uint8Array)).toThrow();
    expect(decoder.progress).toBe(progress);
    decoder.reset();
    expect(decoder.progress).toBe(0);
    const ur = createTokenQrEncoder("cashuA-short", 256, "ur").nextPart();
    expect(decoder.receive(new TextEncoder().encode(ur as string))).toBe(
      "cashuA-short"
    );
  });

  it.each([
    token,
    "lnbc123",
    "https://wallet.example/#token=cashuB",
    "🥜 café",
  ])("preserves ordinary QR text: %s", async (text) => {
    const [scan] = await readBarcodes(await QRCode.toBuffer(text), {
      textMode: "Hex",
    });
    expect(new TokenQrDecoder().receive(scannedHexToBytes(scan.text))).toBe(
      text
    );
  });

  it.each(["", "00 1", "GG", "ur:bytes"])("rejects invalid hex %s", (hex) => {
    expect(() => scannedHexToBytes(hex)).toThrow();
  });
});
