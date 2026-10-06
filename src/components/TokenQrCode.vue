<template>
  <canvas ref="canvas" aria-label="Ecash token QR code" />
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue";
import QRCode from "qrcode";
import type { TokenQrFrame } from "src/js/tokenQr";

export default defineComponent({
  name: "TokenQrCode",
  props: {
    value: {
      type: [String, Uint8Array] as PropType<TokenQrFrame>,
      required: true,
    },
  },
  emits: ["error"],
  watch: {
    value() {
      this.renderQr();
    },
  },
  mounted() {
    this.renderQr();
  },
  methods: {
    renderQr() {
      const data =
        typeof this.value === "string"
          ? this.value
          : [{ data: this.value, mode: "byte" as const }];
      QRCode.toCanvas(
        this.$refs.canvas as HTMLCanvasElement,
        data,
        { width: 600, errorCorrectionLevel: "M" },
        (error: Error | null | undefined) => {
          if (error) this.$emit("error", error);
        }
      );
    },
  },
});
</script>
