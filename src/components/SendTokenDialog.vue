<template>
  <q-dialog
    v-model="showSendTokens"
    position="top"
    :maximized="$q.screen.lt.sm"
    backdrop-filter="blur(2px) brightness(60%)"
    transition-show="fade"
    transition-hide="fade"
    no-backdrop-dismiss
    full-height
    @show="onDialogShown"
  >
    <q-card class="q-pa-none q-pt-none qcard">
      <NumericKeyboard
        v-if="showNumericKeyboard && useNumericKeyboard"
        :model-value="sendData.amount"
        @update:modelValue="(val) => (sendData.amount = val)"
        @done="sendTokens"
      />
      <!--  enter send data -->
      <div v-if="!sendData.tokens">
        <q-card-section class="q-pa-lg q-pt-md">
          <div class="row items-center no-wrap q-mb-sm q-py-lg">
            <div class="col-8">
              <span v-if="!sendData.paymentRequest" class="text-h6"
                >{{
                  $t("SendTokenDialog.title", {
                    value: sendData.amount
                      ? formatCurrency(
                          sendData.amount * activeUnitCurrencyMultiplyer,
                          activeUnit
                        )
                      : $t("SendTokenDialog.title_ecash_text"),
                  })
                }}
              </span>
              <span v-if="sendData.paymentRequest" class="text-h6"
                >Pay request
                <span
                  v-if="sendData.paymentRequest.amount"
                  class="text-primary text-weight-bold"
                >
                  of
                  {{
                    formatCurrency(
                      sendData.paymentRequest.amount,
                      sendData.paymentRequest.unit
                    )
                  }}
                </span>
              </span>
              <span
                v-if="sendData.amount && bitcoinPrice && activeUnit == 'sat'"
                class="q-ml-xs text-subtitle2 text-grey-6"
              >
                ({{
                  formatCurrency(
                    (bitcoinPrice / 100000000) *
                      sendData.amount *
                      activeUnitCurrencyMultiplyer,
                    "USD",
                    true
                  )
                }})
              </span>
            </div>
            <div class="col-4 text-right" style="height: 30px">
              <transition
                appear
                enter-active-class="animated fadeIn"
                leave-active-class="animated fadeOut"
              >
                <q-badge
                  v-if="
                    canSpendOffline && !sendData.p2pkPubkey && !showLockInput
                  "
                  outline
                  rounded
                  color="grey"
                  class="float-right"
                  size="lg"
                >
                  <q-icon
                    name="check"
                    color="primary"
                    class="q-mr-sm"
                    size="sm"
                  />
                  <span class="text-subtitle2 text-weight-medium">{{
                    $t("SendTokenDialog.badge_offline_text")
                  }}</span>
                </q-badge>
              </transition>
            </div>
          </div>
          <div class="row items-center no-wrap q-my-sm q-py-none">
            <div class="col-12">
              <ChooseMint />
            </div>
          </div>

          <q-input
            type="number"
            v-model.number="sendData.amount"
            :label="
              $t('SendTokenDialog.inputs.amount.label', {
                ticker: tickerShort,
              })
            "
            mask="#"
            fill-mask="0"
            reverse-fill-mask
            round
            outlined
            autofocus
            class="q-mb-lg"
            @keyup.enter="sendTokens"
            :disable="
              sendData.paymentRequest &&
              sendData.amount &&
              sendData.paymentRequest.amount == sendData.amount
            "
          >
            <q-btn
              flat
              color="primary"
              @click="toggleUnit()"
              :label="activeUnitLabel"
            />
          </q-input>
          <!-- <q-input
                filled
                dense
                v-model.trim="sendData.memo"
                label="Memo"
                ></q-input> -->
          <transition
            appear
            enter-active-class="animated fadeIn"
            leave-active-class="animated fadeOut"
          >
            <div v-if="showLockInput" class="row items-center no-wrap">
              <div :class="!sendData.p2pkPubkey ? 'col-8' : 'col-12'">
                <q-input
                  v-model="sendData.p2pkPubkey"
                  :label="
                    sendData.p2pkPubkey && !isValidPubkey(sendData.p2pkPubkey)
                      ? $t('SendTokenDialog.inputs.p2pk_pubkey.label_invalid')
                      : $t('SendTokenDialog.inputs.p2pk_pubkey.label')
                  "
                  outlined
                  clearable
                  :color="
                    sendData.p2pkPubkey && !isValidPubkey(sendData.p2pkPubkey)
                      ? 'red'
                      : ''
                  "
                  @keyup.enter="lockTokens"
                ></q-input>
              </div>
              <div class="col-4 q-mx-md">
                <q-btn
                  unelevated
                  v-if="canPasteFromClipboard && !sendData.p2pkPubkey"
                  icon="content_paste"
                  @click="pasteToP2PKField"
                  ><q-tooltip>{{
                    $t("SendTokenDialog.actions.paste_p2pk_pubkey.tooltip_text")
                  }}</q-tooltip></q-btn
                >
                <q-btn
                  align="center"
                  v-if="!sendData.p2pkPubkey"
                  flat
                  outline
                  color="primary"
                  round
                  @click="showCamera"
                  ><ScanIcon size="1.5em"
                /></q-btn>
              </div>
            </div>
          </transition>
          <div v-if="activeBalance >= sendData.amount" class="row q-mt-lg">
            <q-btn
              v-if="!sendData.tokens"
              :disable="
                sendData.amount == null ||
                sendData.amount <= 0 ||
                (sendData.p2pkPubkey != '' &&
                  !isValidPubkey(sendData.p2pkPubkey))
              "
              @click="sendTokens"
              color="primary"
              rounded
              type="submit"
              :loading="globalMutexLock"
              >{{ $t("SendTokenDialog.actions.send.label") }}
              <template v-slot:loading>
                <q-spinner-hourglass />
              </template>
            </q-btn>
            <div
              v-if="sendData.p2pkPubkey && isValidPubkey(sendData.p2pkPubkey)"
              class="row"
            >
              <transition
                appear
                enter-active-class="animated fadeIn"
                leave-active-class="animated fadeOut"
              >
                <q-chip
                  outline
                  color="primary"
                  icon="lock"
                  class="q-ml-md q-pa-md"
                >
                  Locked
                </q-chip>
                <!-- <q-btn rounded flat color="primary" icon="lock">Locked</q-btn> -->
              </transition>
            </div>
            <transition
              appear
              enter-active-class="animated fadeIn"
              leave-active-class="animated fadeOut"
            >
              <q-btn
                v-if="
                  sendData.amount > 0 &&
                  !showLockInput &&
                  activeBalance >= sendData.amount
                "
                :disable="sendData.p2pkPubkey == null || sendData.amount <= 0"
                color="primary"
                class="q-ml-sm"
                rounded
                flat
                @click="showLockInput = true"
              >
                <!-- <q-icon size="xs" class="q-mr-xs" name="lock" />  -->
                {{ $t("SendTokenDialog.actions.lock.label") }}</q-btn
              >
            </transition>
            <q-btn v-close-popup rounded flat color="grey" class="q-ml-auto">{{
              $t("SendTokenDialog.actions.close.label")
            }}</q-btn>
          </div>
          <div v-else class="row q-mt-lg">
            <q-btn
              unelevated
              rounded
              disabled
              color="yellow"
              text-color="black"
              >{{
                $t("SendTokenDialog.inputs.amount.invalid_too_much_error_text")
              }}</q-btn
            >
            <q-btn v-close-popup rounded flat color="grey" class="q-ml-auto">{{
              $t("SendTokenDialog.actions.close.label")
            }}</q-btn>
          </div>
        </q-card-section>
      </div>

      <!-- show ecash details -->
      <div v-else class="text-center q-mb-xs">
        <q-card-section class="q-pa-none q-pt-md">
          <div class="text-center q-mb-md" v-if="qrCodeFragment">
            <q-responsive :ratio="1" class="q-mx-none">
              <vue-qrcode
                :value="qrCodeFragment"
                :options="{ width: 400 }"
                class="rounded-borders"
                @click="copyText(sendData.tokensBase64)"
              >
              </vue-qrcode>
            </q-responsive>
            <div style="height: 2px">
              <q-linear-progress
                v-if="runnerActive"
                indeterminate
                color="primary"
              />
            </div>
          </div>
          <div class="q-pb-xs q-ba-none q-gutter-sm">
            <q-btn
              v-if="showAnimatedQR"
              flat
              style="font-size: 10px"
              color="grey"
              class="q-ma-none"
              @click="changeSpeed"
            >
              <q-icon name="speed" style="margin-right: 8px"></q-icon>
              Speed: {{ fragmentSpeedLabel }}
            </q-btn>
            <q-badge
              :color="!isV4Token ? 'primary' : 'grey'"
              :label="isV4Token ? 'V4' : 'V3'"
              class="q-my-sm q-mx-md cursor-pointer"
              @click="toggleTokenEncoding"
              :outline="isV4Token"
            />
            <q-btn
              v-if="showAnimatedQR"
              flat
              style="font-size: 10px"
              class="q-ma-none"
              color="grey"
              @click="changeSize"
            >
              <q-icon name="zoom_in" style="margin-right: 8px"></q-icon>
              Size: {{ fragmentLengthLabel }}
            </q-btn>
          </div>
          <q-card-section class="q-pa-sm">
            <div class="row justify-center">
              <q-item-label
                overline
                class="q-mb-sm text-white"
                style="font-size: 1rem"
              >
                {{
                  sendData.historyToken.amount &&
                  sendData.historyToken.amount < 0
                    ? sendData.historyToken.status === "paid"
                      ? "Sent"
                      : "Pending"
                    : "Received"
                }}
                Ecash</q-item-label
              >
            </div>
            <div class="row justify-center q-pt-sm">
              <q-item-label style="font-size: 30px" class="text-weight-bold">
                <q-icon
                  :name="
                    sendData.historyToken.amount >= 0
                      ? 'call_received'
                      : 'call_made'
                  "
                  :color="
                    sendData.historyToken.status === 'paid'
                      ? sendData.historyToken.amount >= 0
                        ? 'green'
                        : 'red'
                      : ''
                  "
                  class="q-mr-xs q-mb-xs"
                  size="sm"
                />
                <strong>{{ displayUnit }}</strong></q-item-label
              >
            </div>
            <div v-if="paidFees" class="row justify-center q-pt-sm">
              <q-item-label class="text-weight-bold">
                Fee: {{ formatCurrency(paidFees, tokenUnit) }}
              </q-item-label>
            </div>
            <!-- tada animation -->
            <div
              v-if="
                sendData.historyToken.amount &&
                sendData.historyToken.amount < 0 &&
                sendData.historyToken.status === 'paid'
              "
              class="row justify-center"
            ></div>

            <div class="row justify-center q-pt-md">
              <TokenInformation
                :encodedToken="sendData.tokensBase64"
                :showAmount="false"
                :showP2PKCheck="false"
              />
            </div>
            <div
              v-if="
                sendData.paymentRequest &&
                sendData.historyToken.amount < 0 &&
                sendData.historyToken.status === 'pending'
              "
              class="row justify-center q-pt-sm"
            >
              <SendPaymentRequest />
            </div>
            <div class="row items-center justify-between q-mt-lg">
              <div class="row items-center">
                <q-btn
                  class="q-ml-md"
                  size="md"
                  flat
                  dense
                  @click="copyText(sendData.tokensBase64)"
                  >{{ $t("SendTokenDialog.actions.copy_tokens.label") }}</q-btn
                >
                <q-btn
                  class="q-mx-none"
                  size="md"
                  flat
                  dense
                  @click="toggleExpandButtons"
                >
                  <q-icon
                    :name="
                      showExpandedButtons ? 'chevron_left' : 'chevron_right'
                    "
                  />
                </q-btn>

                <div v-if="showExpandedButtons" class="row q-gutter-sm">
                  <q-btn
                    class="q-mr-xs"
                    size="md"
                    flat
                    dense
                    @click="copyText(encodeToPeanut(sendData.tokensBase64))"
                    >{{ $t("SendTokenDialog.actions.copy_emoji.label") }}
                    <q-tooltip>{{
                      $t("SendTokenDialog.actions.copy_emoji.tooltip_text")
                    }}</q-tooltip>
                  </q-btn>
                  <q-btn
                    class="q-mx-none"
                    color="grey"
                    size="md"
                    dense
                    icon="link"
                    flat
                    @click="
                      copyText(baseURL + '#token=' + sendData.tokensBase64)
                    "
                    ><q-tooltip>{{
                      $t("SendTokenDialog.actions.copy_link.tooltip_text")
                    }}</q-tooltip></q-btn
                  >
                  <q-btn
                    v-if="webShareSupported"
                    class="q-mx-none"
                    color="grey"
                    size="md"
                    dense
                    flat
                    @click="shareToken"
                  >
                    <ShareIcon size="18" />
                    <q-tooltip>{{
                      $t("SendTokenDialog.actions.share.tooltip_text")
                    }}</q-tooltip>
                  </q-btn>
                  <q-btn
                    unelevated
                    dense
                    size="sm"
                    class="q-mx-none"
                    v-if="
                      hasCamera &&
                      !sendData.paymentRequest &&
                      sendData.historyAmount < 0
                    "
                    @click="showCamera"
                  >
                    <ScanIcon />
                  </q-btn>
                  <q-btn
                    unelevated
                    dense
                    v-if="
                      ndefSupported &&
                      !sendData.paymentRequest &&
                      sendData.historyAmount < 0
                    "
                    :disabled="scanningCard"
                    :loading="scanningCard"
                    class="q-mx-none"
                    size="sm"
                    @click="writeTokensToCard"
                    flat
                  >
                    <NfcIcon />
                    <q-tooltip>{{
                      ndefSupported
                        ? $t(
                            "SendTokenDialog.actions.write_tokens_to_card.tooltips.ndef_supported_text"
                          )
                        : $t(
                            "SendTokenDialog.actions.write_tokens_to_card.tooltips.ndef_unsupported_text"
                          )
                    }}</q-tooltip>
                    <template v-slot:loading>
                      <q-spinner @click="closeCardScanner" />
                    </template>
                  </q-btn>
                  <q-btn
                    class="q-mx-none"
                    color="grey"
                    dense
                    icon="delete"
                    size="md"
                    @click="
                      showDeleteDialog = true;
                      closeCardScanner();
                    "
                    flat
                  >
                    <q-tooltip>{{
                      $t("SendTokenDialog.actions.delete.tooltip_text")
                    }}</q-tooltip>
                  </q-btn>
                </div>
              </div>
              <q-btn
                v-close-popup
                @click="closeCardScanner"
                flat
                color="grey"
                class="q-ml-auto q-mr-md"
                >{{
                  $t("SendTokenDialog.actions.close_card_scanner.label")
                }}</q-btn
              >
            </div>
          </q-card-section>
        </q-card-section>
      </div>
    </q-card>
  </q-dialog>
  <!-- popup dialog to confirm deletion activated by showDeleteDialog -->
  <q-dialog v-model="showDeleteDialog">
    <q-card class="q-pa-lg q-pt-md qcard">
      <q-card-section class="q-pa-none">
        <div class="row items-center no-wrap q-mb-sm">
          <div class="col-12">
            <span class="text-h6">Delete Ecash</span>
          </div>
        </div>
        <div class="row items-center no-wrap q-my-sm q-py-none">
          <div class="col-12">
            <q-item-label>
              Are you sure you want to delete this transaction from your
              history?
            </q-item-label>
            <q-item-label class="q-pt-md text-weight-bold">
              Warning: This action cannot be undone and there is no way to
              recover the token.
            </q-item-label>
          </div>
        </div>
        <div class="row q-mt-lg">
          <q-btn
            @click="deleteThisToken"
            color="negative"
            rounded
            class="q-mr-sm"
            >Delete</q-btn
          >
          <q-btn v-close-popup rounded flat color="grey" class="q-ml-auto"
            >Cancel</q-btn
          >
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { defineComponent } from "vue";
import { useSendTokensStore } from "src/stores/sendTokensStore";
import { useWalletStore } from "src/stores/wallet";
import { useUiStore } from "src/stores/ui";
import { useProofsStore } from "src/stores/proofs";
import { useMintsStore } from "src/stores/mints";
import { useTokensStore } from "src/stores/tokens";
import { getShortUrl } from "src/js/wallet-helpers";
import { useSettingsStore } from "src/stores/settings";
import { useWorkersStore } from "src/stores/workers";
import { usePriceStore } from "src/stores/price";
import token from "src/js/token";
import { Buffer } from "buffer";
import { useCameraStore } from "src/stores/camera";
import { useP2PKStore } from "src/stores/p2pk";
import TokenInformation from "components/TokenInformation.vue";
import { getDecodedToken, getEncodedTokenV4 } from "@cashu/cashu-ts";

import { mapActions, mapState, mapWritableState } from "pinia";
import ChooseMint from "components/ChooseMint.vue";
import { UR, UREncoder } from "@gandlaf21/bc-ur";
import SendPaymentRequest from "./SendPaymentRequest.vue";
import NumericKeyboard from "components/NumericKeyboard.vue";
import {
  ChevronLeft as ChevronLeftIcon,
  Clipboard as ClipboardIcon,
  FileText as FileTextIcon,
  Lock as LockIcon,
  Scan as ScanIcon,
  Nfc as NfcIcon,
  Share as ShareIcon,
} from "lucide-vue-next";
import {
  notifyError,
  notifySuccess,
  notify,
  notifyWarning,
} from "src/js/notify.ts";
export default defineComponent({
  name: "SendTokenDialog",
  mixins: [windowMixin],
  components: {
    ChooseMint,
    TokenInformation,
    SendPaymentRequest,
    NumericKeyboard,
    ScanIcon,
    NfcIcon,
    ShareIcon,
  },
  props: {},
  data: function () {
    return {
      baseURL: location.protocol + "//" + location.host + location.pathname,
      showAnimatedQR: false,
      qrCodeFragment: "",
      qrInterval: null,
      encoder: null,
      showDeleteDialog: false,
      p2pkInput: "",

      // parameters for animated QR
      currentFragmentLength: 150,
      fragmentLengthMedium: 100,
      fragmentLengthShort: 50,
      fragmentLengthLong: 150,
      fragmentLengthLabel: "L",

      currentFragmentInterval: 150,
      fragmentIntervalMedium: 250,
      fragmentIntervalFast: 150,
      framentInervalSlow: 500,
      fragmentSpeedLabel: "F",
      isV4Token: false,
      scanningCard: false,
      showExpandedButtons: false,
    };
  },
  computed: {
    ...mapWritableState(useSendTokensStore, [
      "showSendTokens",
      "showLockInput",
      "sendData",
    ]),
    ...mapWritableState(useCameraStore, ["camera", "hasCamera"]),
    ...mapState(useUiStore, [
      "tickerShort",
      "canPasteFromClipboard",
      "globalMutexLock",
      "ndefSupported",
      "webShareSupported",
    ]),
    ...mapWritableState(useUiStore, ["showNumericKeyboard"]),
    ...mapState(useMintsStore, [
      "mints",
      "activeProofs",
      "activeUnit",
      "activeUnitLabel",
      "activeUnitCurrencyMultiplyer",
      "activeMintUrl",
      "activeBalance",
    ]),
    ...mapState(useSettingsStore, [
      "checkSentTokens",
      "includeFeesInSendAmount",
      "nfcEncoding",
      "useNumericKeyboard",
    ]),
    ...mapState(usePriceStore, ["bitcoinPrice"]),
    ...mapState(useWorkersStore, ["tokenWorkerRunning"]),
    // TOKEN METHODS
    sumProofs: function () {
      let proofs = token.getProofs(token.decode(this.sendData.tokensBase64));
      return proofs.flat().reduce((sum, el) => (sum += el.amount), 0);
    },
    displayUnit: function () {
      let display = this.formatCurrency(this.sumProofs, this.tokenUnit);
      return display;
    },
    tokenUnit: function () {
      let unit = token.getUnit(token.decode(this.sendData.tokensBase64));
      return unit;
    },
    tokenMintUrl: function () {
      let mint = token.getMint(token.decode(this.sendData.tokensBase64));
      return mint;
    },
    paidFees: function () {
      return this.sumProofs - Math.abs(this.sendData.historyAmount);
    },
    displayMemo: function () {
      return token.getMemo(token.decode(this.sendData.tokensBase64));
    },
    shortUrl: function () {
      return getShortUrl(this.tokenMintUrl);
    },
    decodedToken: function () {
      return token.decode(this.sendData.tokensBase64);
    },
    runnerActive: function () {
      return this.tokenWorkerRunning;
    },
    canSpendOffline: function () {
      if (!this.sendData.amount) {
        return false;
      }
      // check if entered amount is the same as the result of coinSelect(spendableProofs(activeProofs), amount)
      let spendableProofs = this.spendableProofs(this.activeProofs);
      const mintWallet = useWalletStore().wallet;
      let selectedProofs = this.coinSelect(
        spendableProofs,
        mintWallet,
        this.sendData.amount * this.activeUnitCurrencyMultiplyer,
        this.includeFeesInSendAmount
      );
      const feesToAdd = this.includeFeesInSendAmount
        ? this.getFeesForProofs(selectedProofs)
        : 0;
      const sumSelectedProofs = selectedProofs
        .flat()
        .reduce((sum, el) => (sum += el.amount), 0);
      return (
        sumSelectedProofs ==
        this.sendData.amount * this.activeUnitCurrencyMultiplyer + feesToAdd
      );
    },
  },
  watch: {
    "sendData.tokensBase64": function (val) {
      this.showAnimatedQR = false;
      if (!val.length) {
        // it's emptied
        return;
      }
      // check if token has more than one proof
      const tokenObj = token.decode(val);
      const proofs = tokenObj.proofs;
      if (!proofs.length) {
        // no proofs
        return;
      } else if (proofs.length <= 2) {
        // we can display a single QR code
        this.qrCodeFragment = val;
      } else {
        // we need to split the token into multiple QR codes
        this.showAnimatedQR = true;
        this.qrCodeFragment = "";
        this.startQrCodeLoop();
      }
      // set isV4Token to true if token starts with 'cashuB'
      this.isV4Token = val.startsWith("cashuB");
    },
    showSendTokens: function (val) {
      if (val) {
        this.$nextTick(() => {
          // if we're entering the amount etc, show the keyboard
          if (!this.sendData.tokensBase64.length) {
            this.showNumericKeyboard = true;
          } else {
            this.showNumericKeyboard = false;
          }
        });

        // if we open the dialog from the history, let's check the
        if (
          this.sendData.historyToken &&
          this.sendData.historyToken.amount < 0 &&
          this.sendData.historyToken.status === "pending"
        ) {
          if (!this.checkSentTokens) {
            console.log(
              "settingsStore.checkSentTokens is disabled, skipping token check"
            );
            return;
          }
          const unspent = this.checkTokenSpendable(
            this.sendData.historyToken,
            false
          );
          if (!unspent) {
            this.sendData.historyToken.status = "paid";
          }
        }
      } else {
        clearInterval(this.qrInterval);
        this.sendData.data = "";
        this.sendData.tokensBase64 = "";
        this.sendData.historyToken = null;
        this.sendData.paymentRequest = null;
      }
    },
  },
  methods: {
    ...mapActions(useWorkersStore, ["clearAllWorkers"]),
    ...mapActions(useWalletStore, [
      "send",
      "sendToLock",
      "coinSelect",
      "spendableProofs",
      "getFeesForProofs",
      "onTokenPaid",
      "mintWallet",
      "checkTokenSpendable",
    ]),
    ...mapActions(useProofsStore, ["serializeProofs"]),
    ...mapActions(useTokensStore, [
      "addPendingToken",
      "setTokenPaid",
      "deleteToken",
    ]),
    ...mapActions(useP2PKStore, ["isValidPubkey", "maybeConvertNpub"]),
    ...mapActions(useCameraStore, ["closeCamera", "showCamera"]),
    ...mapActions(useMintsStore, ["toggleUnit"]),
    // decodeP2PKQR: function (res) {
    //   console.log("### SendToken qr", res);
    //   this.camera.data = res;
    //   this.camera.show = false;
    //   // this.decodeRequest(res);
    //   this.p2pkInput = res;
    //   return;
    //   if (isValidPubkey(res)) {
    //     this.sendData.p2pkPubkey = res;
    //   } else {
    //     this.notifyError("No valid key");
    //   }
    // },
    encodeToPeanut: function (token) {
      return (
        "🥜" +
        Array.from(token)
          .map((char) => {
            const byteValue = char.charCodeAt(0);
            // For byte values 0-15, use Variation Selectors (VS1-VS16): U+FE00 to U+FE0F
            if (byteValue >= 0 && byteValue <= 15) {
              return String.fromCodePoint(0xfe00 + byteValue);
            }

            // For byte values 16-255, use Variation Selectors Supplement (VS17-VS256): U+E0100 to U+E01EF
            if (byteValue >= 16 && byteValue <= 255) {
              return String.fromCodePoint(0xe0100 + (byteValue - 16));
            }
          })
          .join("")
      );
    },
    decodeToken: function (encoded_token) {
      return token.decode(encoded_token);
    },
    getProofs: function (decoded_token) {
      return token.getProofs(decoded_token);
    },
    getAmount: function (decoded_token) {
      return token.getAmount(decoded_token);
    },
    getUnit: function (decoded_token) {
      return token.getUnit(decoded_token);
    },
    getMint: function (decoded_token) {
      return token.getMint(decoded_token);
    },
    toggleExpandButtons() {
      this.showExpandedButtons = !this.showExpandedButtons;
    },
    startQrCodeLoop: async function () {
      if (this.sendData.tokensBase64.length == 0) {
        return;
      }
      const messageBuffer = Buffer.from(this.sendData.tokensBase64);
      const ur = UR.fromBuffer(messageBuffer);
      const firstSeqNum = 0;
      this.encoder = new UREncoder(ur, this.currentFragmentLength, firstSeqNum);
      clearInterval(this.qrInterval);
      this.qrInterval = setInterval(() => {
        this.qrCodeFragment = this.encoder.nextPart();
      }, this.currentFragmentInterval);
    },
    updateQrCode: function () {
      this.qrCodeFragment = this.encoder.nextPart();
    },
    changeSpeed: function () {
      // cycle currentFragmentInterval between slow, medium and fast
      if (this.currentFragmentInterval == this.fragmentIntervalMedium) {
        this.currentFragmentInterval = this.framentInervalSlow;
        this.fragmentSpeedLabel = "S";
      } else if (this.currentFragmentInterval == this.framentInervalSlow) {
        this.currentFragmentInterval = this.fragmentIntervalFast;
        this.fragmentSpeedLabel = "F";
      } else {
        this.currentFragmentInterval = this.fragmentIntervalMedium;
        this.fragmentSpeedLabel = "M";
      }
      console.log(
        "### this.currentFragmentInterval",
        this.currentFragmentInterval
      );
      this.startQrCodeLoop();
    },
    changeSize: function () {
      // cycle currentFragmentLength between short, medium and long
      if (this.currentFragmentLength == this.fragmentLengthMedium) {
        this.currentFragmentLength = this.fragmentLengthShort;
        this.fragmentLengthLabel = "S";
      } else if (this.currentFragmentLength == this.fragmentLengthShort) {
        this.currentFragmentLength = this.fragmentLengthLong;
        this.fragmentLengthLabel = "L";
      } else {
        this.currentFragmentLength = this.fragmentLengthMedium;
        this.fragmentLengthLabel = "M";
      }
      console.log("### this.currentFragmentLength", this.currentFragmentLength);
      this.startQrCodeLoop();
    },
    toggleTokenEncoding: function () {
      const decodedToken = getDecodedToken(this.sendData.tokensBase64);
      // if the token starts with 'cashuA', it is a v3 token
      // if it starts with 'cashuB', it is a v4 token
      if (this.sendData.tokensBase64.startsWith("cashuA")) {
        try {
          this.sendData.tokensBase64 = getEncodedTokenV4(decodedToken);
        } catch {
          console.log("### Could not encode token to V4");
          this.sendData.tokensBase64 = getEncodedToken(decodedToken, {
            version: 3,
          });
        }
      } else {
        this.sendData.tokensBase64 = getEncodedToken(decodedToken, {
          version: 3,
        });
      }
    },
    deleteThisToken: function () {
      this.deleteToken(this.sendData.tokensBase64);
      this.showSendTokens = false;
      this.showDeleteDialog = false;
      this.clearAllWorkers();
    },
    writeTokensToCard: function () {
      if (!this.scanningCard) {
        try {
          this.ndef = new NDEFReader();
          this.controller = new AbortController();
          const signal = this.controller.signal;
          this.ndef
            .scan({ signal })
            .then(() => {
              console.log("> Scan started");

              this.ndef.onreadingerror = (error) => {
                console.error(`Cannot read NDEF data! ${error}`);
                notifyError("Cannot read data from the NFC tag");
                this.controller.abort();
                this.scanningCard = false;
              };

              this.ndef.onreading = ({ message, serialNumber }) => {
                console.log(`Read card ${serialNumber}`);
                this.controller.abort();
                this.scanningCard = false;
                try {
                  let records = [];
                  switch (this.nfcEncoding) {
                    case "text":
                      records = [
                        {
                          recordType: "text",
                          data: `${this.sendData.tokensBase64}`,
                          lang: "en",
                        },
                      ];
                      break;
                    case "weburl":
                      records = [
                        {
                          recordType: "url",
                          data: `${window.location}#token=${this.sendData.tokensBase64}`,
                        },
                      ];
                      break;
                    case "binary":
                      throw new Error("Binary encoding not supported yet");
                    /*
                      const data = null;
                      records = [
                        {
                          recordType: "mime",
                          mediaType: "application/octet-stream",
                          data: data,
                        },
                      ];
                      break;
                      */
                    default:
                      throw new Error(
                        `Unknown NFC encoding: ${this.nfcEncoding}`
                      );
                  }
                  notifySuccess("Writing to NFC card...");
                  this.ndef
                    .write({ records: records }, { overwrite: true })
                    .then(() => {
                      console.log("Successfully flashed token to card!");
                      notifySuccess("Successfully flashed token to card!");
                    })
                    .catch((err) => {
                      console.error(
                        `NFC write failed: The card may not have enough capacity (needed ${records[0].data.length} bytes).`
                      );
                      notifyError(
                        `The card may not have enough capacity (needed ${records[0].data.length} bytes).`,
                        "NFC write failed"
                      );
                    });
                } catch (err) {
                  console.error(`NFC error: ${err.message}`);
                  notifyError(`${err.message}`, "NFC error");
                }
              };
              this.scanningCard = true;
            })
            .catch((error) => {
              console.error(`NFC error: ${error.message}`);
              notifyError(`${err.message}`, "NFC error");
              this.scanningCard = false;
            });
        } catch (error) {
          console.error(`NFC error: ${error.message}`);
          notifyError(`${err.message}`, "NFC error");
          this.scanningCard = false;
        }
      }
    },
    closeCardScanner: function () {
      this.controller.abort();
      this.scanningCard = false;
    },
    lockTokens: async function () {
      let sendAmount = Math.floor(
        this.sendData.amount * this.activeUnitCurrencyMultiplyer
      );
      try {
        // keep firstProofs, send scndProofs and delete them (invalidate=true)
        const mintWallet = this.mintWallet(this.activeMintUrl, this.activeUnit);
        let { _, sendProofs } = await this.sendToLock(
          this.activeProofs,
          mintWallet,
          sendAmount,
          this.sendData.p2pkPubkey
        );
        // update UI
        this.sendData.tokens = sendProofs;

        this.sendData.tokensBase64 = this.serializeProofs(sendProofs);
        const historyToken = {
          amount: -this.sendData.amount,
          token: this.sendData.tokensBase64,
          unit: this.activeUnit,
          mint: this.activeMintUrl,
        };
        this.addPendingToken(historyToken);
        this.sendData.historyToken = historyToken;

        if (!this.g.offline) {
          this.onTokenPaid(historyToken);
        }
      } catch (error) {
        console.error(error);
      }
    },
    sendTokens: async function () {
      /*
      calls send, displays token and kicks off the spendableWorker
      */
      this.showNumericKeyboard = false;
      this.sendData.p2pkPubkey = this.maybeConvertNpub(
        this.sendData.p2pkPubkey
      );
      if (
        this.sendData.p2pkPubkey &&
        this.isValidPubkey(this.sendData.p2pkPubkey)
      ) {
        await this.lockTokens();
        return;
      }

      try {
        let sendAmount = Math.floor(
          this.sendData.amount * this.activeUnitCurrencyMultiplyer
        );
        const mintWallet = this.mintWallet(this.activeMintUrl, this.activeUnit);
        // keep firstProofs, send scndProofs and delete them (invalidate=true)
        let { _, sendProofs } = await this.send(
          this.activeProofs,
          mintWallet,
          sendAmount,
          true,
          this.includeFeesInSendAmount
        );

        // update UI
        this.sendData.tokens = sendProofs;
        this.sendData.tokensBase64 = this.serializeProofs(sendProofs);
        this.sendData.historyAmount =
          -this.sendData.amount * this.activeUnitCurrencyMultiplyer;

        const historyToken = {
          amount: -sendAmount,
          token: this.sendData.tokensBase64,
          unit: this.activeUnit,
          mint: this.activeMintUrl,
          paymentRequest: this.sendData.paymentRequest,
          status: "pending",
        };
        this.addPendingToken(historyToken);
        this.sendData.historyToken = historyToken;

        if (!this.g.offline) {
          this.onTokenPaid(historyToken);
        }
      } catch (error) {
        console.error(error);
      }
    },
    pasteToP2PKField: async function () {
      console.log("pasteToParseDialog");
      const text = await useUiStore().pasteFromClipboard();
      this.sendData.p2pkPubkey = text.trim();
    },
    shareToken: async function () {
      if (!this.webShareSupported) {
        console.log("Web Share API not supported");
        return;
      }

      const shareData = {
        text: `cashu:${this.sendData.tokensBase64}`,
      };

      try {
        await navigator.share(shareData);
        console.log("Token shared successfully");
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Error sharing token:", error);
        }
      }
    },
  },
});
</script>
