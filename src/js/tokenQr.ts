import { FountainEncoder } from "nut-fountain/core";
import { AutoDecoder } from "nut-fountain/auto";
import { tokenToBytes, bytesToTokenString } from "nut-fountain/cashu";
import { UR, UREncoder } from "@gandlaf21/bc-ur";
import { Buffer } from "buffer";

export const TOKEN_QR_BYTES = 256;
export const TOKEN_QR_INTERVAL = 50;
const FOUNTAIN_HEADER_BYTES = 24;

export type TokenQrFrame = string | Uint8Array;
export type TokenQrFormat = "fountain" | "ur";

export function createTokenQrEncoder(
  token: string,
  frameBytes = TOKEN_QR_BYTES,
  format: TokenQrFormat = "fountain"
): { nextPart: () => TokenQrFrame } {
  if (format === "ur") {
    const encoder = new UREncoder(
      UR.fromBuffer(Buffer.from(token)),
      frameBytes
    );
    return { nextPart: () => encoder.nextPart() };
  }
  // V4 uses compact binary serialization; preserve older token text verbatim.
  const bytes = token.startsWith("cashuB")
    ? tokenToBytes(token)
    : new TextEncoder().encode(token);
  const encoder = new FountainEncoder(bytes, {
    fragmentSize: frameBytes - FOUNTAIN_HEADER_BYTES,
  });
  return { nextPart: () => encoder.nextFrame() };
}

/** Decode ZXing's lossless Hex text mode, including its inter-byte spaces. */
export function scannedHexToBytes(hex: string): Uint8Array {
  const compact = hex.replace(/\s/g, "");
  if (!/^(?:[\da-f]{2})+$/i.test(compact)) {
    throw new Error("Invalid QR byte representation");
  }
  return Uint8Array.from(compact.match(/../g)!, (byte) => parseInt(byte, 16));
}

/** One animated transfer per scan session; ordinary text still passes through. */
export class TokenQrDecoder {
  private decoder = new AutoDecoder();

  get progress(): number {
    return this.decoder.progress;
  }

  reset(): void {
    this.decoder.reset();
  }

  receive(bytes: Uint8Array): string | undefined {
    const isFountain = bytes[0] === 0x4e && bytes[1] === 0x46;
    if (!isFountain) {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (!/^ur:/i.test(text)) return text;
    }
    this.decoder.receive(bytes);
    if (!this.decoder.isComplete) return;

    const payload = this.decoder.result!;
    const prefix = new TextDecoder().decode(payload.subarray(0, 5));
    return prefix === "crawB"
      ? bytesToTokenString(payload)
      : new TextDecoder("utf-8", { fatal: true }).decode(payload);
  }
}
