<template>
  <div class="row q-col-gutter-y-md justify-center q-pt-sm q-pb-md">
    <div class="col-12 col-sm-11 col-md-8 text-center q-gutter-y-md">
      <ActivityOrb />
      <NoMintWarnBanner v-if="mints.length == 0" />
      <BalanceView v-else :set-tab="setTab" />
      <div
        class="row items-center justify-center no-wrap q-mb-none q-mx-none q-px-none q-pt-lg q-pb-md position-relative"
      >
        <div class="col-6 q-mb-md flex justify-center items-center">
          <q-btn
            rounded
            dense
            class="q-px-md q-mr-md wallet-action-btn"
            color="primary"
            @click="showReceiveDialog = true"
          >
            <div class="button-content">
              <q-icon name="south_west" size="1.2rem" class="q-mr-xs" />
              <span>{{ $t("WalletPage.actions.receive.label") }}</span>
            </div>
          </q-btn>
        </div>

        <transition appear enter-active-class="animated pulse">
          <div class="scan-button-container">
            <q-btn size="lg" outline color="primary" flat @click="showCamera">
              <ScanIcon size="2em" />
            </q-btn>
          </div>
        </transition>

        <!-- button to showSendDialog -->
        <div class="col-6 q-mb-md flex justify-center items-center">
          <q-btn
            rounded
            dense
            class="q-px-md q-ml-md wallet-action-btn"
            color="primary"
            @click="showSendDialog = true"
          >
            <div class="button-content">
              <q-icon name="north_east" size="1.2rem" class="q-mr-xs" />
              <span>{{ $t("WalletPage.actions.send.label") }}</span>
            </div>
          </q-btn>
        </div>
        <ReceiveDialog v-model="showReceiveDialog" />
        <SendDialog v-model="showSendDialog" />
      </div>
      <!-- ///////////////////////////////////////////
      ////////////////// TABLES /////////////////
      /////////////////////////////////////////// -->
      <q-expansion-item expand-icon-class="hidden" v-model="expandHistory">
        <template v-slot:header="{ expanded }">
          <q-item-section class="item-center text-center">
            <span
              ><q-icon
                color="primary"
                :name="expanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'"
            /></span>
          </q-item-section>
        </template>
        <q-tabs
          v-model="tab"
          no-caps
          :class="$q.dark.isActive ? 'bg-dark' : 'bg-white'"
        >
          <q-tab
            name="history"
            class="text-secondary"
            :label="$t('WalletPage.tabs.history.label')"
          ></q-tab>
          <!-- <q-tab name="tokens" label="Tokens"></q-tab> -->
          <q-tab
            name="mints"
            class="text-secondary"
            :label="$t('WalletPage.tabs.mints.label')"
          ></q-tab>
        </q-tabs>

        <q-tab-panels
          :class="$q.dark.isActive ? 'bg-dark' : 'bg-white'"
          v-model="tab"
          animated
        >
          <!-- ////////////////// UNIFIED HISTORY LIST ///////////////// -->

          <q-tab-panel name="history">
            <HistoryTable />
          </q-tab-panel>

          <!-- ////////////////////// SETTINGS ////////////////// -->

          <q-tab-panel name="mints" class="q-px-sm">
            <MintSettings />
          </q-tab-panel>
        </q-tab-panels>
      </q-expansion-item>

      <div style="margin-bottom: 0rem">
        <div class="row q-pt-sm">
          <div class="col-12 q-pt-xs">
            <q-btn
              class="q-mx-xs q-px-sm q-my-sm"
              outline
              size="0.6rem"
              v-if="
                getPwaDisplayMode() == 'browser' &&
                deferredPWAInstallPrompt != null
              "
              color="primary"
              @click="triggerPwaInstall()"
              ><b>{{ $t("WalletPage.install.text") }}</b
              ><q-tooltip>{{
                $t("WalletPage.install.tooltip")
              }}</q-tooltip></q-btn
            >
          </div>
        </div>
      </div>

      <iOSPWAPrompt />
      <AndroidPWAPrompt />
    </div>

    <!-- BOTTOM LIGHTNING BUTTONS -->

    <!-- DIALOGS  -->

    <!-- INPUT PARSER  -->
    <PayInvoiceDialog v-model="payInvoiceData.show" />

    <!-- QR CODE SCANNER  -->
    <q-dialog v-model="camera.show" backdrop-filter="blur(2px) brightness(60%)">
      <QrcodeReader @decode="decodeQR" />
    </q-dialog>

    <!-- WELCOME DIALOG  -->
    <WelcomeDialog
      :welcome-dialog="welcomeDialog"
      :trigger-pwa-install="triggerPwaInstall"
      :set-tab="setTab"
      :get-pwa-display-mode="getPwaDisplayMode"
      :set-welcome-dialog-seen="setWelcomeDialogSeen"
    />

    <!-- INVOICE DETAILS  -->
    <InvoiceDetailDialog v-model="showInvoiceDetails" />

    <!-- SEND TOKENS DIALOG  -->
    <SendTokenDialog v-model="showSendTokens" />

    <!-- RECEIVE TOKENS DIALOG  -->
    <ReceiveTokenDialog v-model="showReceiveTokens" />
  </div>
</template>
<style>
* {
  touch-action: manipulation;
}

.keypad {
  display: grid;
  grid-gap: 8px;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(4, 1fr);
}

.keypad .btn {
  height: 100%;
}

.keypad .btn-confirm {
  grid-area: 1 / 4 / 5 / 4;
}

.wallet-action-btn {
  min-width: 140px;
  width: auto;
  white-space: nowrap;
  font-size: 1.2rem;
}

.button-content {
  display: flex;
  align-items: center;
  white-space: nowrap;
}

/* Apply equal widths to wallet action buttons after render */
.equal-width-buttons {
  display: flex;
  justify-content: space-between;
}

.scan-button-container {
  position: absolute;
  z-index: 1;
  padding-bottom: 15px;
}
</style>
<script>
import { date } from "quasar";
import * as _ from "underscore";
import { shortenString } from "src/js/string-utils";
import token from "src/js/token";

// Vue components
import BalanceView from "components/BalanceView.vue";
import MintSettings from "components/MintSettings.vue";
import HistoryTable from "components/HistoryTable.vue";
import NoMintWarnBanner from "components/NoMintWarnBanner.vue";
import WelcomeDialog from "components/WelcomeDialog.vue";
import SendTokenDialog from "components/SendTokenDialog.vue";
import PayInvoiceDialog from "components/PayInvoiceDialog.vue";
import InvoiceDetailDialog from "components/InvoiceDetailDialog.vue";
import SendDialog from "components/SendDialog.vue";
import ReceiveDialog from "components/ReceiveDialog.vue";
import QrcodeReader from "components/QrcodeReader.vue";
import iOSPWAPrompt from "components/iOSPWAPrompt.vue";
import AndroidPWAPrompt from "components/AndroidPWAPrompt.vue";
import ActivityOrb from "components/ActivityOrb.vue";

// pinia stores
import { mapActions, mapState, mapWritableState } from "pinia";
import { useMintsStore } from "src/stores/mints";
import { useSendTokensStore } from "src/stores/sendTokensStore";
import { useReceiveTokensStore } from "src/stores/receiveTokensStore";
import { useWorkersStore } from "src/stores/workers";
import { useTokensStore } from "src/stores/tokens";
import { useWalletStore } from "src/stores/wallet";
import { useUiStore } from "src/stores/ui";
import { useProofsStore } from "src/stores/proofs";
import { useCameraStore } from "src/stores/camera";
import { useP2PKStore } from "src/stores/p2pk";
import { useNWCStore } from "src/stores/nwc";
import { useNPCStore } from "src/stores/npubcash";
import { useNPCV2Store } from "src/stores/npcv2";
import { useNostrStore } from "src/stores/nostr";
import { usePRStore } from "src/stores/payment-request";
import { useDexieStore } from "src/stores/dexie";

import { useStorageStore } from "src/stores/storage";
import ReceiveTokenDialog from "src/components/ReceiveTokenDialog.vue";
import { useWelcomeStore } from "../stores/welcome";
import { useInvoicesWorkerStore } from "src/stores/invoicesWorker";
import { notifyError, notify } from "../js/notify";

import {
  X as XIcon,
  Banknote as BanknoteIcon,
  Zap as ZapIcon,
  Scan as ScanIcon,
} from "lucide-vue-next";

import { useMigrationsStore } from "src/stores/migrations";

export default {
  mixins: [windowMixin],
  components: {
    BalanceView,
    MintSettings,
    HistoryTable,
    NoMintWarnBanner,
    WelcomeDialog,
    SendTokenDialog,
    ReceiveTokenDialog,
    PayInvoiceDialog,
    InvoiceDetailDialog,
    QrcodeReader,
    SendDialog,
    ReceiveDialog,
    iOSPWAPrompt,
    AndroidPWAPrompt,
    ScanIcon,
    ActivityOrb,
  },
  data: function () {
    return {
      name: "",
      mintId: "",
      mintName: "",
      deferredPWAInstallPrompt: null,
      action: "main",
      parse: {
        show: false,
        invoice: null,
        lnurlpay: null,
        lnurlauth: null,
        data: {
          request: "",
          amount: 0,
          comment: "",
        },
        camera: {
          show: false,
          camera: "auto",
        },
      },
      payments: [],
      paymentsChart: {
        show: false,
      },
      welcomeDialog: {
        show: false,
      },
      baseHost: location.protocol + "//" + location.host,
      baseURL: location.protocol + "//" + location.host + location.pathname,
      credit: 0,
      newName: "",
    };
  },
  computed: {
    ...mapState(useUiStore, ["tickerShort"]),
    ...mapWritableState(useUiStore, [
      "showInvoiceDetails",
      "tab",
      "showSendDialog",
      "showReceiveDialog",
    ]),
    ...mapWritableState(useUiStore, ["expandHistory"]),
    ...mapWritableState(useReceiveTokensStore, [
      "showReceiveTokens",
      "receiveData",
    ]),
    ...mapWritableState(useSendTokensStore, ["showSendTokens", "sendData"]),
    ...mapState(useMintsStore, [
      "activeMintUrl",
      "activeProofs",
      "keys",
      "mints",
      "activeMint",
    ]),
    ...mapWritableState(useWalletStore, [
      "invoiceHistory",
      "invoiceData",
      "payInvoiceData",
    ]),
    ...mapWritableState(useMintsStore, ["addMintData", "showAddMintDialog"]),
    ...mapWritableState(useWorkersStore, [
      "invoiceCheckListener",
      "tokensCheckSpendableListener",
    ]),
    ...mapState(useTokensStore, ["historyTokens"]),
    ...mapState(usePRStore, ["enablePaymentRequest"]),
    ...mapWritableState(useCameraStore, ["camera", "hasCamera"]),
    ...mapWritableState(useP2PKStore, ["showP2PKDialog"]),
    ...mapWritableState(useNWCStore, ["showNWCDialog", "nwcEnabled"]),
    pendingPaymentsExist: function () {
      return this.payments.findIndex((payment) => payment.pending) !== -1;
    },

    balance: function () {
      return this.activeProofs
        .map((t) => t)
        .flat()
        .reduce((sum, el) => (sum += el.amount), 0);
    },
  },
  filters: {},
  methods: {
    ...mapActions(useProofsStore, [
      "serializeProofs",
      "getProofsMint",
      "serializeProofsV2",
      "sumProofs",
      "deleteProofs",
    ]),
    ...mapActions(useMintsStore, [
      "activateMintUrl",
      "addMint",
      "assertMintError",
      "getBalance",
      "setActiveProofs",
      "setProofs",
      "getKeysForKeyset",
    ]),
    ...mapActions(useWorkersStore, ["clearAllWorkers", "invoiceCheckWorker"]),
    ...mapActions(useTokensStore, ["setTokenPaid"]),
    ...mapActions(useWalletStore, [
      "setInvoicePaid",
      "mint",
      "checkPendingTokens",
      "decodeRequest",
      "initializeMnemonic",
    ]),
    ...mapActions(useCameraStore, ["closeCamera", "showCamera"]),
    ...mapActions(useNWCStore, ["listenToNWCCommands"]),
    ...mapActions(useNPCStore, ["generateNPCConnection", "claimAllTokens"]),
    ...mapActions(useNPCV2Store, [
      "generateNPCV2Connection",
      "getLatestQuotes",
    ]),
    ...mapActions(useNostrStore, [
      "sendNip04DirectMessage",
      "sendNip17DirectMessage",
      "subscribeToNip04DirectMessages",
      "subscribeToNip17DirectMessages",
      "sendNip17DirectMessageToNprofile",
      "initSigner",
    ]),
    ...mapActions(useDexieStore, ["migrateToDexie"]),
    ...mapActions(useStorageStore, ["checkLocalStorage"]),
    ...mapActions(usePRStore, ["createPaymentRequest"]),
    ...mapActions(useInvoicesWorkerStore, [
      "startInvoiceCheckerWorker",
      "checkPendingInvoices",
    ]),
    // TOKEN METHODS
    decodeToken: function (encoded_token) {
      try {
        return token.decode(encoded_token);
      } catch (e) {
        return null;
      }
    },
    getProofs: function (decoded_token) {
      return token.getProofs(decoded_token);
    },
    getMint: function (decoded_token) {
      return token.getMint(decoded_token);
    },
    //
    shortenString: function (s) {
      return shortenString(s, 20, 10);
    },
    getTokenList: function () {
      const amounts = this.activeProofs.map((t) => t.amount);
      const counts = {};

      for (const num of amounts) {
        counts[num] = counts[num] ? counts[num] + 1 : 1;
      }
      return Object.keys(counts).map((k) => ({
        value: parseInt(k),
        count: parseInt(counts[k]),
        sum: k * counts[k],
      }));
    },

    paymentTableRowKey: function (row) {
      return row.payment_hash + row.amount;
    },
    showChart: function () {
      this.paymentsChart.show = true;
      this.$nextTick(() => {
        generateChart(this.$refs.canvas, this.payments);
      });
    },
    focusInput(el) {
      // TODO: fix this
      // this.$nextTick(() => this.$refs[el].focus());
    },
    showParseDialog: function () {
      this.payInvoiceData.show = true;
      this.payInvoiceData.invoice = null;
      this.payInvoiceData.lnurlpay = null;
      this.payInvoiceData.domain = "";
      this.payInvoiceData.lnurlauth = null;
      this.payInvoiceData.input.request = "";
      this.payInvoiceData.input.comment = "";
      this.camera.show = false;
      this.focusInput("parseDialogInput");
    },
    showWelcomePage: function () {
      if (!useWelcomeStore().termsAccepted) {
        useWelcomeStore().showWelcome = true;
      }
      if (useWelcomeStore().showWelcome) {
        const currentQuery = window.location.search;
        const currentHash = window.location.hash;
        this.$router.push("/welcome" + currentQuery + currentHash);
      }
    },
    setTab: function (to) {
      this.tab = to;
    },
    decodeQR: function (res) {
      this.camera.data = res;
      this.camera.show = false;
      this.decodeRequest(res);
    },
    /////////////////////////////////// WALLET ///////////////////////////////////
    showInvoiceCreateDialog: async function () {
      console.log("##### showInvoiceCreateDialog");
      this.invoiceData.amount = "";
      this.invoiceData.bolt11 = "";
      this.invoiceData.hash = "";
      this.invoiceData.memo = "";
      this.showInvoiceDetails = true;
    },
    showSendTokensDialog: function () {
      console.log("##### showSendTokensDialog");
      this.sendData.tokens = "";
      this.sendData.tokensBase64 = "";
      this.sendData.amount = null;
      this.sendData.memo = "";
      this.showSendTokens = true;
    },
    hideSendTokensDialog: function () {
      this.showSendTokens = false;
    },
    showReceiveTokensDialog: function () {
      this.receiveData.tokensBase64 = "";
      this.showReceiveTokens = true;
    },

    //////////////////////// MINT //////////////////////////////////////////

    // ////////////// UI HELPERS //////////////

    ////////////// WORKERS //////////////

    ////////////// UI HELPERS /////////////
    registerPWAEventHook: function () {
      // register event listener for PWA install prompt
      window.addEventListener("beforeinstallprompt", (e) => {
        // Prevent the mini-infobar from appearing on mobile
        // e.preventDefault()
        // Stash the event so it can be triggered later.
        this.deferredPWAInstallPrompt = e;
        console.log(
          `'beforeinstallprompt' event was fired.`,
          this.getPwaDisplayMode()
        );
      });
    },
    getPwaDisplayMode: function () {
      const isStandalone = window.matchMedia(
        "(display-mode: standalone)"
      ).matches;
      if (document.referrer.startsWith("android-app://")) {
        return "twa";
      } else if (navigator.standalone || isStandalone) {
        return "standalone";
      }
      return "browser";
    },
    triggerPwaInstall: function () {
      // Show the install prompt
      // Note: this doesn't work with IOS, we do it with iOSPWAPrompt
      this.deferredPWAInstallPrompt.prompt();
      // Wait for the user to respond to the prompt
      this.deferredPWAInstallPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === "accepted") {
          console.log("User accepted the install prompt");
          this.setWelcomeDialogSeen();
        } else {
          console.log("User dismissed the install prompt");
        }
      });
    },
    registerBroadcastChannel: async function () {
      // uses session storage to identify the tab so we can ignore incoming messages from the same tab
      if (!sessionStorage.getItem("tabId")) {
        sessionStorage.setItem(
          "tabId",
          Math.random().toString(36).substring(2) +
            new Date().getTime().toString(36)
        );
      }
      const tabId = sessionStorage.getItem("tabId");
      const channel = new BroadcastChannel("app_channel");
      channel.postMessage({ type: "new_tab_opened", senderId: tabId });
      channel.onmessage = async (event) => {
        // console.log("Received message in tab " + tabId, event.data);
        if (event.data.senderId === tabId) {
          return; // Ignore the message if it comes from the same tab
        }
        if (event.data.type == "new_tab_opened") {
          channel.postMessage({ type: "already_running", senderId: tabId });
        } else if (event.data.type == "already_running") {
          this.$router.push("/already-running");
        }
      };
    },
    equalizeButtonWidths: function () {
      this.$nextTick(() => {
        const actionBtns = document.querySelectorAll(".wallet-action-btn");
        if (actionBtns.length >= 2) {
          // Reset widths first
          actionBtns.forEach((btn) => {
            btn.style.width = "auto";
          });

          // Get the maximum width
          let maxWidth = 0;
          actionBtns.forEach((btn) => {
            maxWidth = Math.max(maxWidth, btn.offsetWidth);
          });

          // Apply the maximum width to all buttons
          actionBtns.forEach((btn) => {
            btn.style.width = `${maxWidth}px`;
          });
        }
      });
    },
  },
  watch: {},

  mounted: function () {
    // generate NPC connection
    this.generateNPCConnection();
    this.claimAllTokens();
    this.generateNPCV2Connection();
    this.getLatestQuotes();
    // Ensure wallet action buttons have equal width
    this.$nextTick(this.equalizeButtonWidths);
    // Add window resize listener to handle responsive layouts
    window.addEventListener("resize", this.equalizeButtonWidths);
  },

  beforeUnmount: function () {
    // Remove event listener when component is destroyed
    window.removeEventListener("resize", this.equalizeButtonWidths);
  },

  created: async function () {
    // Initialize and run migrations
    const migrationsStore = useMigrationsStore();
    migrationsStore.initMigrations();
    await migrationsStore.runMigrations();

    // check if another tab is open
    this.registerBroadcastChannel();

    let params = new URL(document.location).searchParams;
    let hash = new URL(document.location).hash;

    // mint url
    if (params.get("mint")) {
      let addMintUrl = params.get("mint");
      await this.setTab("mints");
      this.showAddMintDialog = true;
      this.addMintData = { url: addMintUrl };
    }
    if (!localStorage.getItem("cashu.activeMintUrl")) {
      this.setTab("mints");
    }

    console.log("Mint URL " + this.activeMintUrl);
    console.log("Wallet URL " + this.baseURL);

    // get token to receive tokens from a link
    if (params.get("token") || hash.includes("token")) {
      let tokenBase64 = params.get("token") || hash.split("token=")[1];
      // make sure to react only to tokens not in the users history
      let seen = false;
      for (var i = 0; i < this.historyTokens.length; i++) {
        var thisToken = this.historyTokens[i].token;
        if (thisToken == tokenBase64 && this.historyTokens[i].amount > 0) {
          seen = true;
        }
      }
      if (!seen) {
        // show receive token dialog
        this.receiveData.tokensBase64 = tokenBase64;
        this.showReceiveTokens = true;
      }
    }

    // get lightning invoice from a link
    if (params.get("lightning")) {
      this.showParseDialog();
      this.payInvoiceData.input.request = params.get("lightning");
    }

    // Clear all parameters from URL without refreshing the page
    /*
    window.history.pushState(
      {},
      document.title,
      window.location.href.split("?")[0].split("#")[0]
    );
    */
    console.log(`hash: ${window.location.hash}`);

    // startup tasks

    // debug console
    useUiStore().enableDebugConsole();

    // migrate to dexie
    await this.migrateToDexie();

    // check local storage
    this.checkLocalStorage();

    // PWA install hook
    this.registerPWAEventHook();

    // generate new mnemonic
    this.initializeMnemonic();

    this.initSigner();

    // show welcome dialog
    this.showWelcomePage();

    // listen to NWC commands if enabled
    if (this.nwcEnabled) {
      this.listenToNWCCommands();
    }

    if (this.enablePaymentRequest) {
      this.subscribeToNip17DirectMessages();
    }

    // start invoice checker worker
    this.startInvoiceCheckerWorker();

    // reconnect all websockets
    this.checkPendingInvoices();
  },
};
</script>
