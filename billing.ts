/**
 * Google Play Billing bridge.
 *
 * Inside the Android WebView, MainActivity injects `window.StrikeNeonNative`.
 * Shards are only granted after Play Billing confirms a PURCHASED one-time
 * product and consumes it. The browser / PWA has no payment path.
 */

export type BillingStatus = "checking" | "ready" | "unavailable";

export interface NativeProduct {
  productId: string;
  title?: string;
  price?: string;
  shards?: number;
}

export interface PurchaseSuccessEvent {
  productId: string;
  shards: number;
  orderId?: string;
  purchaseToken?: string;
}

export interface PurchaseFailEvent {
  productId?: string;
  reason: string;
  code?: number;
}

/** Google Play package id. Billing products and licences are tied to it. */
export const APP_PACKAGE_ID = "com.sarfen1.strikeneon";

/**
 * Exact Google Play in-app product IDs (one-time, consumable INAPP products).
 * These MUST match the Play Console ("Monetize ▸ In-app products") letter by
 * letter; they are the single source of truth for the whole billing flow.
 */
export const SHARD_PRODUCT_IDS = ["shards_500", "shards_1000", "shards_2500", "shards_weekly_090"] as const;

export type ShardProductId = (typeof SHARD_PRODUCT_IDS)[number];

export function isShardProductId(productId: string): productId is ShardProductId {
  return (SHARD_PRODUCT_IDS as readonly string[]).includes(productId);
}

/** Official Google Play Store deep link used by the "Rate Us" button. */
export const PLAY_STORE_URL = `market://details?id=${APP_PACKAGE_ID}`;

/** https variant of the listing (used whenever market:// cannot be handled). */
export const PLAY_STORE_WEB_URL = `https://play.google.com/store/apps/details?id=${APP_PACKAGE_ID}`;

type OpenTarget = "native" | "market" | "web";

/** How long to wait for the Play Store app before falling back to the web page. */
const MARKET_FALLBACK_MS = 1200;

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}

export type NativeBridge = {
  buyShards: (productId: string) => void;
  /**
   * Asks Kotlin to (re)connect the BillingClient, i.e. call
   * `billingClient.startConnection()` again. Optional so bridges built before
   * the reconnect mechanism keep working; without it the JS side still retries
   * by re-requesting the product query once Play answers.
   */
  connectBilling?: () => void;
  /** Asks Kotlin to query the shard products; extra arg is ignored by older bridges. */
  queryProducts?: (productIdsCsv?: string) => void;
  restorePurchases?: () => void;
  ackPurchaseDelivery?: (purchaseToken: string) => void;
  openStoreListing?: () => void;
  showAdMobBanner?: (adUnitId: string) => void;
  hideAdMobBanner?: () => void;
  showAdMobInterstitial?: (adUnitId: string, placement: string) => void;
  showPrivacyOptionsForm?: () => void;
  isPrivacyOptionsRequired?: () => boolean;
};

/** How long the page waits for Kotlin to inject `window.StrikeNeonNative`. */
const BRIDGE_WAIT_TIMEOUT_MS = 2500;
const BRIDGE_POLL_INTERVAL_MS = 150;

/**
 * Waits for the Android side to inject `window.StrikeNeonNative`.
 *
 * Kotlin injects the bridge asynchronously after the page starts loading, so a
 * single check on mount races the injection and left the store buttons greyed
 * out forever. Instead the bridge is polled until it shows up or the timeout
 * elapses. Resolves with the bridge, or `null` when billing is unavailable.
 */
export function waitForBillingBridge(
  timeoutMs: number = BRIDGE_WAIT_TIMEOUT_MS,
): Promise<NativeBridge | null> {
  return new Promise((resolve) => {
    const get = () => (typeof window !== "undefined" ? window.StrikeNeonNative : undefined);
    const existing = get();
    if (typeof existing?.buyShards === "function") {
      resolve(existing);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const bridge = get();
      if (typeof bridge?.buyShards === "function") {
        window.clearInterval(timer);
        resolve(bridge);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(timer);
        resolve(null);
      }
    }, BRIDGE_POLL_INTERVAL_MS);
  });
}

/**
 * Opens the Strike Neon page on Google Play for the "Rate Us" button.
 *
 * Order of preference:
 *  1. Native Android bridge  -> market:// intent in a new task (Play Store app),
 *                               falling back to the https listing inside Kotlin.
 *  2. Android browser        -> market://details?id=... directly. If the Play
 *                               Store app does not take over within 1.2s, the
 *                               https listing is opened as the fallback.
 *  3. Any other browser/iOS  -> the https listing in a new tab (market:// is not
 *                               understood outside Android).
 *
 * Returns which route was taken, which also makes the behaviour testable.
 */
export function openPlayStoreListing(): OpenTarget {
  const native = typeof window !== "undefined" ? window.StrikeNeonNative : undefined;
  if (native?.openStoreListing) {
    native.openStoreListing();
    return "native";
  }

  if (isAndroid()) {
    // Primary attempt: the market:// deep link opens the Play Store app directly.
    // If no app handles it the browser stays visible, so after a short wait we
    // navigate to the https listing instead.
    try {
      window.location.href = PLAY_STORE_URL;

      window.setTimeout(() => {
        // A real hand-off to the Play Store app hides this document.
        const stillHere = typeof document === "undefined" || document.visibilityState === "visible";
        if (stillHere) window.location.href = PLAY_STORE_WEB_URL;
      }, MARKET_FALLBACK_MS);

      return "market";
    } catch {
      /* fall through to the web listing */
    }
    window.location.href = PLAY_STORE_WEB_URL;
    return "web";
  }

  // Desktop / iOS browsers cannot understand market://, so open the web listing.
  window.open(PLAY_STORE_WEB_URL, "_blank", "noopener,noreferrer");
  return "web";
}

declare global {
  interface Window {
    StrikeNeonNative?: NativeBridge;
    StrikeNeonOnBillingReady?: (payload?: { products?: NativeProduct[] }) => void;
    StrikeNeonOnPurchaseSuccess?: (payload: PurchaseSuccessEvent) => void;
    StrikeNeonOnPurchaseFailed?: (payload: PurchaseFailEvent) => void;
    StrikeNeonOnPurchaseCanceled?: (payload?: { productId?: string }) => void;
    StrikeNeonOnProducts?: (payload: { products: NativeProduct[] }) => void;
  }
}

export function isPlayBillingAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.StrikeNeonNative?.buyShards === "function";
}

/**
 * Starts a Google Play checkout for a consumable shard pack.
 * Returns false when there is no billing bridge,
 * so the caller can tell the player this device cannot pay.
 */
export function requestPlayPurchase(productId: string): boolean {
  if (!isPlayBillingAvailable()) return false;
  window.StrikeNeonNative!.buyShards(productId);
  return true;
}

/** Asks Google Play for purchases already owned (used by the Restore button). */
export function requestRestorePurchases(): boolean {
  if (!isPlayBillingAvailable()) return false;
  window.StrikeNeonNative!.restorePurchases?.();
  return true;
}

export function requestPlayProducts(): void {
  const bridge = window.StrikeNeonNative;
  if (typeof bridge?.queryProducts !== "function") return;
  const ids = [...SHARD_PRODUCT_IDS];
  try {
    // Preferred: pass the exact IDs so Kotlin can query Play with them.
    bridge.queryProducts(ids.join(","));
  } catch {
    // Older bridge signature without parameters: Kotlin already knows the list.
    try {
      bridge.queryProducts?.();
    } catch {
      /* product query is optional; purchases still work without it */
    }
  }
}

/* ------------------------------------------------------------------ */
/* Play connection lifecycle                                           */
/*                                                                     */
/* The BillingClient connection is owned by Kotlin. `ready` here means  */
/* Kotlin has already fired `StrikeNeonOnBillingReady`, which — per the */
/* contract in ANDROID.md — only happens after                          */
/* `onBillingSetupFinished` reports BILLING_RESULT_OK. Product queries  */
/* and purchases are only allowed once that signal arrives.            */
/* ------------------------------------------------------------------ */

export type BillingConnectionState = "connecting" | "connected" | "failed";

export interface BillingConnectionResult {
  /** True only after the Play connection was confirmed by the native side. */
  connected: boolean;
  bridge: NativeBridge | null;
  attempts: number;
}

/** How long each attempt waits for `StrikeNeonOnBillingReady`. */
const PLAY_READY_TIMEOUT_MS = 12_000;
/** Backoff between automatic reconnection attempts. */
const RETRY_DELAYS_MS = [800, 2000, 4000, 7000];
/** Shorter bridge wait on retries: the injection already raced once. */
const BRIDGE_RETRY_WAIT_MS = 2500;

const readyWaiters: Array<() => void> = [];

/**
 * Marks the Play Billing connection as confirmed. Called by the app layer
 * when Kotlin fires `StrikeNeonOnBillingReady` (setup finished OK) or a
 * non-empty `StrikeNeonOnProducts` response — both prove the BillingClient
 * is connected to Google Play.
 */
export function signalBillingReady(): void {
  for (const release of readyWaiters.splice(0)) release();
}

function awaitBillingReady(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      const index = readyWaiters.indexOf(release);
      if (index >= 0) readyWaiters.splice(index, 1);
      window.clearTimeout(timer);
      resolve(ok);
    };
    const release = () => finish(true);
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    readyWaiters.push(release);
  });
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export interface BillingConnectionOptions {
  /** Abort check so a torn-down React effect stops the retry loop. */
  isAborted?: () => boolean;
  /** Progress callback for UI state ("connecting" → "connected"/"failed"). */
  onAttempt?: (attempt: number, state: BillingConnectionState) => void;
}

/**
 * Connects the game to Google Play Billing and only resolves `connected`
 * once the native BillingClient reports a successful setup
 * (`onBillingSetupFinished` → `StrikeNeonOnBillingReady`).
 *
 * If the first connection fails ("Play Connection" error) it automatically
 * asks Kotlin to `startConnection()` again with increasing backoff, instead
 * of leaving the store dead until the player finds the RETRY button.
 *
 * Product queries (`requestPlayProducts`) must be called by the caller only
 * after this resolves with `connected: true`.
 */
export async function connectBilling(
  options: BillingConnectionOptions = {},
): Promise<BillingConnectionResult> {
  const { isAborted, onAttempt } = options;
  const aborted = () => isAborted?.() ?? false;
  const maxAttempts = 1 + RETRY_DELAYS_MS.length;
  let lastBridge: NativeBridge | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    onAttempt?.(attempt, "connecting");

    // Kotlin injects the bridge asynchronously, so keep polling for it; after
    // the first failure a shorter wait is enough (it is already there).
    const bridge = await waitForBillingBridge(
      attempt === 1 ? BRIDGE_WAIT_TIMEOUT_MS : BRIDGE_RETRY_WAIT_MS,
    );
    if (aborted()) return { connected: false, bridge: lastBridge, attempts: attempt };
    if (!bridge) {
      // No native bridge at all: this is a browser/PWA, not the Android app.
      // Retrying cannot help — billing simply has no path here.
      break;
    }
    lastBridge = bridge;

    // Ask Kotlin to (re)start the connection. Newer bridges implement
    // `connectBilling` (billingClient.startConnection + listener); older ones
    // reconnect implicitly on the next query.
    try {
      bridge.connectBilling?.();
    } catch {
      /* older bridge without reconnect support — the ready wait still applies */
    }

    const confirmed = await awaitBillingReady(PLAY_READY_TIMEOUT_MS);
    if (aborted()) return { connected: false, bridge: lastBridge, attempts: attempt };
    if (confirmed) {
      onAttempt?.(attempt, "connected");
      return { connected: true, bridge, attempts: attempt };
    }

    onAttempt?.(attempt, "failed");
    if (attempt < maxAttempts) await sleep(RETRY_DELAYS_MS[attempt - 1]);
  }

  return { connected: false, bridge: lastBridge, attempts: maxAttempts };
}

export function requestPlayRestore(): void {
  window.StrikeNeonNative?.restorePurchases?.();
}

/**
 * Transaction validation for consumable purchases.
 *
 * `StrikeNeonOnPurchaseSuccess` is only fired by Kotlin after it confirms a
 * PURCHASED one-time product AND consumes it — so by contract it arrives at
 * most once per transaction. This layer adds the last guard rails:
 *  - the productId must be one of the exact shard product IDs, and
 *  - the same purchase token / order id must never credit twice (dedupe),
 *    which also makes "Restore" replay-safe.
 */
const processedTransactions = new Set<string>();

export function validatePurchaseEvent(event: PurchaseSuccessEvent): boolean {
  if (!isShardProductId(event.productId)) return false;
  const token = event.purchaseToken || event.orderId || "";
  if (token && processedTransactions.has(token)) return false;
  if (token) processedTransactions.add(token);
  return true;
}

/** True when the shard amount reported matches the Play Console product. */
export function validateShardAmount(productId: string, shards: number): boolean {
  const expected = { shards_500: 500, shards_1000: 1000, shards_2500: 2500, shards_weekly_090: 1000 }[productId];
  return expected === undefined || shards === expected;
}
