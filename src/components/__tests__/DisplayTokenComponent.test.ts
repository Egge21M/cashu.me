import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Amount, getEncodedToken } from "@cashu/cashu-ts";
import { TokenQrDecoder } from "src/js/tokenQr";

vi.mock("src/components/TokenInformation.vue", () => ({ default: {} }));
vi.mock("src/components/MeltQuoteInformation.vue", () => ({ default: {} }));
vi.mock("src/components/SendPaymentRequest.vue", () => ({ default: {} }));
vi.mock("src/components/PaymentRequestInfo.vue", () => ({ default: {} }));
vi.mock("src/js/notify", () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

let DisplayTokenComponent: any;
beforeAll(async () => {
  (globalThis as any).windowMixin = {};
  DisplayTokenComponent = (
    await import("src/components/DisplayTokenComponent.vue")
  ).default;
});
afterEach(() => vi.useRealTimers());

function makeToken(count: number, memo?: string) {
  return getEncodedToken({
    mint: "https://mint.example",
    unit: "sat",
    memo,
    proofs: Array.from({ length: count }, (_, i) => ({
      id: "009a1f293253e41e",
      amount: Amount.from(1),
      secret: `fixture-${i}`,
      C: "02" + "11".repeat(32),
    })),
  });
}

function createContext(value: string) {
  const context: any = {
    ...DisplayTokenComponent.data(),
    sendData: { tokensBase64: value },
  };
  for (const [key, method] of Object.entries(DisplayTokenComponent.methods)) {
    context[key] = (method as Function).bind(context);
  }
  return context;
}

describe("DisplayTokenComponent animated QR lifecycle", () => {
  it("displays a 256-byte frame immediately and advances at 20 fps without resetting on speed changes", () => {
    vi.useFakeTimers();
    const text = makeToken(12);
    const context = createContext(text);
    context.initQr();
    expect(context.showAnimatedQR).toBe(true);
    expect(context.qrCodeFragment).toBeInstanceOf(Uint8Array);
    expect(context.qrCodeFragment.length).toBe(256);
    const decoder = new TokenQrDecoder();
    decoder.receive(context.qrCodeFragment);
    const first = context.qrCodeFragment;
    vi.advanceTimersByTime(49);
    expect(context.qrCodeFragment).toBe(first);
    vi.advanceTimersByTime(1);
    expect(context.qrCodeFragment).not.toEqual(first);
    decoder.receive(context.qrCodeFragment);
    const encoder = context.encoder;
    context.changeSpeed();
    expect(context.encoder).toBe(encoder);
    let result;
    for (let index = 0; index < 50 && !result; index++) {
      vi.advanceTimersByTime(context.currentFragmentInterval);
      result = decoder.receive(context.qrCodeFragment);
    }
    expect(result).toBe(text);
    DisplayTokenComponent.beforeUnmount.call(context);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops animation when changing to a static token or clearing the token", () => {
    vi.useFakeTimers();
    const context = createContext(makeToken(12));
    context.initQr();
    const small = makeToken(1);
    context.sendData.tokensBase64 = small;
    DisplayTokenComponent.watch["sendData.tokensBase64"].call(context);
    vi.advanceTimersByTime(1000);
    expect(context.qrCodeFragment).toBe(small);
    expect(context.showAnimatedQR).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    context.sendData.tokensBase64 = "";
    context.initQr();
    expect(context.qrCodeFragment).toBe("");
  });

  it("animates a large single-proof token and supports the outbound UR option", () => {
    vi.useFakeTimers();
    const context = createContext(makeToken(1, "long memo ".repeat(150)));
    context.initQr();
    expect(context.showAnimatedQR).toBe(true);
    context.useLegacyQr = true;
    context.startQrCodeLoop();
    expect(context.qrCodeFragment).toMatch(/^ur:bytes\//i);
    expect(vi.getTimerCount()).toBe(1);
    context.stopQrCodeLoop();
  });
});
