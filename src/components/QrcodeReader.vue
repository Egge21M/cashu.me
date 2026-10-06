<script lang="ts">
import QrScanner, { type ScanResult } from "@agicash/qr-scanner";
import { markRaw } from "vue";
import { TokenQrDecoder, scannedHexToBytes } from "src/js/tokenQr";
import { notifyError } from "src/js/notify";
import zxingReaderWasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import scannerWorkerUrl from "virtual:qr-scanner-worker-url";
import { useCameraStore } from "src/stores/camera";
import { mapActions, mapState } from "pinia";
import { useUiStore } from "src/stores/ui";

QrScanner.configureWasm({
  locateFile: () => zxingReaderWasmUrl,
});
QrScanner.setWorkerUrl(scannerWorkerUrl);

export default {
  emits: ["decode"],
  data(): {
    qrScanner: QrScanner | null;
    decoder: TokenQrDecoder;
    decoderProgress: number;
    scanComplete: boolean;
  } {
    return {
      qrScanner: null,
      decoder: markRaw(new TokenQrDecoder()),
      decoderProgress: 0,
      scanComplete: false,
    };
  },
  mounted() {
    this.qrScanner = markRaw(
      new QrScanner(
        this.$refs.cameraEl as HTMLVideoElement,
        (result: ScanResult) => {
          this.handleResult(result);
        },
        {
          calculateScanRegion: (video) => ({
            x: 0,
            y: 0,
            width: video.videoWidth,
            height: video.videoHeight,
          }),
          // The wrapper only exposes text. Hex preserves ZXing's raw bytes
          // without guessing a character encoding for binary fountain frames.
          decoderOptions: { textMode: "Hex" },
          maxScansPerSecond: 30,
          highlightCodeOutline: true,
          onDecodeError: () => {},
        }
      )
    );
    this.qrScanner.start().catch((error: Error) => {
      if (!this.scanComplete) notifyError(error.message);
    });
  },
  computed: {
    ...mapState(useCameraStore, ["camera", "hasCamera"]),
    canPasteFromClipboard: function () {
      return (
        window.isSecureContext &&
        navigator.clipboard &&
        navigator.clipboard.readText
      );
    },
  },
  methods: {
    ...mapActions(useCameraStore, ["closeCamera", "showCamera"]),
    handleResult(result: ScanResult) {
      if (this.scanComplete) return;
      try {
        const decoded = this.decoder.receive(scannedHexToBytes(result.data));
        if (decoded) this.finishScan(decoded);
      } catch {
        // Ignore damaged or foreign frames without discarding valid progress.
        // The user can reset the session to scan a different transfer.
      }
      this.decoderProgress = this.scanComplete ? 0 : this.decoder.progress;
    },
    resetScan() {
      this.decoder.reset();
      this.decoderProgress = 0;
    },
    finishScan(text: string) {
      if (this.scanComplete) return;
      this.scanComplete = true;
      // Let the scanner finish drawing this frame's outline before clearing
      // the video stream (which resets its dimensions to zero).
      queueMicrotask(() => this.qrScanner?.stop());
      this.decoderProgress = 0;
      this.$emit("decode", text);
    },
    pasteToParseDialog: async function () {
      const text = await useUiStore().pasteFromClipboard();
      if (text) this.finishScan(text);
    },
  },
  beforeUnmount() {
    this.scanComplete = true;
    this.qrScanner?.destroy();
  },
};
</script>
<template>
  <q-card>
    <div class="text-center">
      <div>
        <video ref="cameraEl" style="width: 100%"></video>
      </div>
      <div>
        <div class="row q-justify-center">
          <q-linear-progress
            rounded
            size="30px"
            v-if="decoderProgress > 0"
            :value="decoderProgress"
            :indeterminate="decoderProgress === 0"
            class="q-mt-none"
            color="secondary"
          >
            <div class="absolute-full flex flex-center">
              <q-badge
                color="white"
                text-color="secondary"
                style="font-size: 1rem; padding: 5px"
                class="text-weight-bold"
                :label="
                  $t('QrcodeReader.progress.text', {
                    percentage: $t('QrcodeReader.progress.percentage', {
                      percentage: Math.round(decoderProgress * 100),
                    }),
                    addon:
                      decoderProgress > 0.9
                        ? $t('QrcodeReader.progress.keep_scanning_text')
                        : '',
                  })
                "
              />
            </div>
          </q-linear-progress>
        </div>
      </div>
    </div>
    <div class="row q-my-sm">
      <q-btn flat @click="resetScan"> Restart scan </q-btn>
      <q-btn
        unelevated
        v-if="canPasteFromClipboard"
        @click="pasteToParseDialog"
      >
        <q-icon name="content_paste" class="q-mr-sm" />
        {{ $t("QrcodeReader.actions.paste.label") }}</q-btn
      >
      <q-btn @click="closeCamera" flat color="grey" class="q-ml-auto">{{
        $t("QrcodeReader.actions.close.label")
      }}</q-btn>
    </div>
  </q-card>
</template>
