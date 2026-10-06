import { shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import QrcodeReader from "src/components/QrcodeReader.vue";
import { createTokenQrEncoder } from "src/js/tokenQr";

const scanner = vi.hoisted(() => ({
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
  destroy: vi.fn(),
  options: {} as any,
}));
vi.mock("@agicash/qr-scanner", () => ({
  default: class {
    static configureWasm() {}
    static setWorkerUrl() {}
    options: any;
    constructor(_video: unknown, _onDecode: unknown, options: any) {
      this.options = options;
      scanner.options = options;
    }
    start() {
      // Real scanner options cross a Worker boundary; reactive proxies fail.
      return scanner.start(structuredClone(this.options.decoderOptions));
    }
    stop = scanner.stop;
    destroy = scanner.destroy;
  },
}));

function scan(frame: Uint8Array | string) {
  const bytes =
    typeof frame === "string" ? new TextEncoder().encode(frame) : frame;
  return {
    data: Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      " "
    ),
    cornerPoints: [],
  };
}

function mountReader() {
  return shallowMount(QrcodeReader, {
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe("QrcodeReader", () => {
  it("configures lossless scanning and emits a multipart token only once", async () => {
    const wrapper = mountReader();
    const vm = wrapper.vm as any;
    expect(scanner.options.decoderOptions.textMode).toBe("Hex");
    expect(scanner.start).toHaveBeenCalledWith({ textMode: "Hex" });
    expect(scanner.options.maxScansPerSecond).toBeGreaterThanOrEqual(20);
    const text = "cashuA" + "fixture".repeat(100);
    const encoder = createTokenQrEncoder(text);
    vm.handleResult(scan(encoder.nextPart()));
    expect(vm.decoderProgress).toBeGreaterThan(0);
    expect(wrapper.emitted("decode")).toBeUndefined();
    vm.handleResult({ data: "malformed", cornerPoints: [] });
    for (let index = 0; index < 30; index++)
      vm.handleResult(scan(encoder.nextPart()));
    expect(wrapper.emitted("decode")).toEqual([[text]]);
    expect(vm.decoderProgress).toBe(0);
    await Promise.resolve();
    expect(scanner.stop).toHaveBeenCalled();
    wrapper.unmount();
    expect(scanner.destroy).toHaveBeenCalled();
  });

  it("resets an unfinished transfer before scanning another format", () => {
    const wrapper = mountReader();
    const vm = wrapper.vm as any;
    const encoder = createTokenQrEncoder("cashuA" + "fixture".repeat(100));
    vm.handleResult(scan(encoder.nextPart()));
    const legacy = createTokenQrEncoder("cashuA-other", 256, "ur");
    vm.handleResult(scan(legacy.nextPart()));
    expect(wrapper.emitted("decode")).toBeUndefined();
    vm.resetScan();
    expect(vm.decoderProgress).toBe(0);
    vm.handleResult(scan(legacy.nextPart()));
    expect(wrapper.emitted("decode")).toEqual([["cashuA-other"]]);
    wrapper.unmount();
  });

  it("passes ordinary invoice text through and ignores callbacks after unmount", () => {
    const wrapper = mountReader();
    const vm = wrapper.vm as any;
    vm.handleResult(scan("lightning:lnbc123"));
    expect(wrapper.emitted("decode")).toEqual([["lightning:lnbc123"]]);
    const finishScan = vi.spyOn(vm, "finishScan");
    wrapper.unmount();
    vm.handleResult(scan("late-result"));
    expect(finishScan).not.toHaveBeenCalled();
  });
});
