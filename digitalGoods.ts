/**
 * Google Play Digital Goods API fallback for supported Chrome-installed app contexts.
 *
 * A TWA runs the site inside Chrome, so there is no `window.StrikeNeonNative`
 * Kotlin bridge. Google Play Billing is reached through two web APIs instead:
 *  - Digital Goods API (`window.getDigitalGoodsService`) to read the product
 *    catalog (title / localized price), list owned purchases and consume them;
 *  - Payment Request API (`new PaymentRequest(...)`) with the
 *    `https://play.google.com/billing` method to open the Play checkout.
 *
 * Both only exist when the page runs inside a verified TWA (Digital Asset
 * Links OK) that was built with Play Billing enabled and installed from
 * Google Play. Everywhere else this module reports "unsupported" cleanly.
 */

import { SHARD_PRODUCT_IDS, isShardProductId, type ShardProductId } from "./billing";

export const PLAY_BILLING_METHOD = "https://play.google.com/billing";

interface ItemDetails {
  itemId: string;
  title: string;
  description?: string;
  price: { currency: string; value: string };
  type?: string;
}

interface PurchaseDetails {
  itemId: string;
  purchaseToken: string;
}

export interface DigitalGoodsService {
  getDetails(itemIds: string[]): Promise<ItemDetails[]>;
  listPurchases(): Promise<PurchaseDetails[]>;
  consume(purchaseToken: string): Promise<void>;
}

declare global {
  interface Window {
    getDigitalGoodsService?: (paymentMethod: string) => Promise<DigitalGoodsService>;
  }
}

export interface ShardProductDetails {
  productId: ShardProductId;
  title: string;
  /** Localized price string from Google Play, e.g. "5,99 €". */
  price: string;
}

export type DigitalGoodsFailure =
  /** Not a TWA with Play Billing (browser, PWA, sideloaded APK...). */
  | "unsupported"
  /** Play answered but none of the shard IDs exist / are active. */
  | "no-products"
  /** Play did not answer in time on any attempt. */
  | "timeout"
  | "error";

export type DigitalGoodsConnection =
  | { ok: true; service: DigitalGoodsService; products: Partial<Record<ShardProductId, ShardProductDetails>> }
  | { ok: false; reason: DigitalGoodsFailure; message?: string };

export type DigitalGoodsPurchaseOutcome =
  | { status: "purchased"; productId: ShardProductId; purchaseToken: string }
  | { status: "canceled" }
  | { status: "failed"; reason: string };

const LOG_PREFIX = "[billing:play]";
const log = (...args: unknown[]) => console.info(LOG_PREFIX, ...args);
const warn = (...args: unknown[]) => console.warn(LOG_PREFIX, ...args);

/** Per-call timeout: the Play service sometimes takes a while to bind. */
const CALL_TIMEOUT_MS = 8000;
/** Backoff between automatic reconnection attempts. */
const RETRY_DELAYS_MS = [1000, 2500, 5000];

const TOKENS_KEY = "strike-neon:play-purchase-tokens";
const MAX_STORED_TOKENS = 200;

class TimeoutError extends Error {
  constructor(what: string) {
    super(`${what} timed out after ${CALL_TIMEOUT_MS}ms`);
    this.name = "TimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new TimeoutError(what)), CALL_TIMEOUT_MS);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function getDigitalGoodsServiceFn(): ((paymentMethod: string) => Promise<DigitalGoodsService>) | undefined {
  if (typeof window === "undefined") return undefined;
  if (typeof window.getDigitalGoodsService === "function") return window.getDigitalGoodsService.bind(window);
  const nav = typeof navigator !== "undefined" ? (navigator as unknown as { getDigitalGoodsService?: (paymentMethod: string) => Promise<DigitalGoodsService> }) : undefined;
  if (typeof nav?.getDigitalGoodsService === "function") return nav.getDigitalGoodsService.bind(navigator);
  return undefined;
}

/** True when the browser exposes both APIs needed for Play Billing in a TWA. */
export function isDigitalGoodsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof getDigitalGoodsServiceFn() === "function" &&
    typeof window.PaymentRequest === "function"
  );
}

function formatPrice(price: ItemDetails["price"] | undefined): string {
  if (!price) return "";
  const value = Number(price.value);
  if (!Number.isFinite(value)) return `${price.value} ${price.currency}`;
  try {
    return new Intl.NumberFormat(navigator.language || undefined, {
      style: "currency",
      currency: price.currency,
    }).format(value);
  } catch {
    return `${price.value} ${price.currency}`;
  }
}

/** Chrome rejects with "unsupported context" outside a Play-installed TWA. */
function isPermanentFailure(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /unsupported|not ?supported/i.test(text);
}

export interface DigitalGoodsConnectOptions {
  isAborted?: () => boolean;
  onAttempt?: (attempt: number) => void;
}

/**
 * Binds to the Play Billing service and queries the exact shard product IDs.
 * Retries with backoff when Play is slow or temporarily unreachable; gives up
 * immediately when the environment can never support it.
 */
export async function connectDigitalGoods(
  options: DigitalGoodsConnectOptions = {},
): Promise<DigitalGoodsConnection> {
  const aborted = () => options.isAborted?.() ?? false;

  const dgsFn = getDigitalGoodsServiceFn();
  if (!dgsFn || typeof window.PaymentRequest !== "function") {
    log("Digital Goods API not available (not running inside a Play Billing TWA).");
    return { ok: false, reason: "unsupported" };
  }

  const maxAttempts = 1 + RETRY_DELAYS_MS.length;
  let last: DigitalGoodsConnection = { ok: false, reason: "error" };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (aborted()) return last;
    options.onAttempt?.(attempt);
    log(`Connecting to Google Play Billing (attempt ${attempt}/${maxAttempts})…`);

    try {
      const service = await withTimeout(
        dgsFn(PLAY_BILLING_METHOD),
        "getDigitalGoodsService",
      );
      if (!service) {
        // Older Chrome builds resolve null instead of rejecting.
        warn("getDigitalGoodsService resolved without a service.");
        return { ok: false, reason: "unsupported" };
      }

      const ids = [...SHARD_PRODUCT_IDS];
      const details = await withTimeout(service.getDetails(ids), "getDetails");
      log("getDetails response:", details);

      const products: Partial<Record<ShardProductId, ShardProductDetails>> = {};
      for (const item of details ?? []) {
        if (!isShardProductId(item.itemId)) continue;
        products[item.itemId] = {
          productId: item.itemId,
          title: item.title,
          price: formatPrice(item.price),
        };
      }

      const missing = ids.filter((id) => !products[id]);
      if (missing.length > 0) {
        warn(
          `Products not returned by Google Play: ${missing.join(", ")}. ` +
            "Check they are ACTIVE one-time products in Play Console and that the app was installed from Play.",
        );
      }

      if (Object.keys(products).length === 0) {
        last = { ok: false, reason: "no-products" };
      } else {
        log("Google Play Billing ready.");
        return { ok: true, service, products };
      }
    } catch (error) {
      if (isPermanentFailure(error)) {
        warn("Play Billing is not supported in this context:", error);
        return { ok: false, reason: "unsupported", message: String(error) };
      }
      const reason: DigitalGoodsFailure = error instanceof TimeoutError ? "timeout" : "error";
      warn(`Attempt ${attempt} failed (${reason}):`, error);
      last = { ok: false, reason, message: String(error) };
    }

    if (attempt < maxAttempts) await sleep(RETRY_DELAYS_MS[attempt - 1]);
  }

  warn("Giving up on Google Play Billing after", maxAttempts, "attempts:", last);
  return last;
}

/* ------------------------------------------------------------------ */
/* Purchase token ledger                                               */
/*                                                                     */
/* A token is claimed (persisted) BEFORE shards are credited and the   */
/* purchase is consumed. If consume fails, the purchase shows up again */
/* in listPurchases() and is only consumed — never credited twice.     */
/* ------------------------------------------------------------------ */

function readTokens(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(TOKENS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

/** Returns true the first time a token is seen; false for replays. */
export function claimPurchaseToken(purchaseToken: string): boolean {
  const tokens = readTokens();
  if (tokens.includes(purchaseToken)) return false;
  tokens.push(purchaseToken);
  try {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens.slice(-MAX_STORED_TOKENS)));
  } catch {
    /* storage full: dedupe still holds for this session via the consume step */
  }
  return true;
}

async function consumeSafely(service: DigitalGoodsService, purchaseToken: string): Promise<boolean> {
  try {
    await withTimeout(service.consume(purchaseToken), "consume");
    log("Purchase consumed.");
    return true;
  } catch (error) {
    // Not fatal: the token is already claimed, so the next reconcile only
    // retries the consume. Play refunds unconsumed purchases after 3 days.
    warn("consume failed, will retry on next reconcile:", error);
    return false;
  }
}

/**
 * Opens the Google Play checkout for one shard pack.
 *
 * `PaymentRequest.show()` must run inside the click's user gesture, so this
 * function calls it synchronously before any `await`. When Play reports a
 * purchase, `onPurchased` credits the shards (after the token is claimed),
 * then the purchase is consumed so the pack can be bought again.
 */
export function purchaseWithDigitalGoods(
  service: DigitalGoodsService,
  productId: ShardProductId,
  onPurchased: (productId: ShardProductId, purchaseToken: string) => void,
): Promise<DigitalGoodsPurchaseOutcome> {
  let request: PaymentRequest;
  try {
    request = new PaymentRequest(
      [
        {
          supportedMethods: PLAY_BILLING_METHOD,
          data: {
            sku: productId,
            itemId: productId,
          },
        },
      ],
      {
        // Play shows its own localized price; this total is required but ignored.
        total: { label: "Total", amount: { currency: "USD", value: "0" } },
      },
    );
  } catch (error) {
    warn("PaymentRequest could not be created:", error);
    return Promise.resolve({ status: "failed", reason: "CHECKOUT UNAVAILABLE" });
  }

  log(`Opening Play checkout for ${productId}…`);
  return request
    .show()
    .then(async (response): Promise<DigitalGoodsPurchaseOutcome> => {
      const details = (response.details ?? {}) as { purchaseToken?: string; token?: string };
      const purchaseToken = details.purchaseToken ?? details.token;
      if (!purchaseToken) {
        warn("Play checkout returned no purchase token:", response.details);
        await response.complete("fail").catch(() => undefined);
        return { status: "failed", reason: "NO PURCHASE TOKEN" };
      }

      log(`Purchase approved for ${productId}.`);
      if (claimPurchaseToken(purchaseToken)) onPurchased(productId, purchaseToken);
      await consumeSafely(service, purchaseToken);
      await response.complete("success").catch(() => undefined);
      return { status: "purchased", productId, purchaseToken };
    })
    .catch((error: unknown): DigitalGoodsPurchaseOutcome => {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "AbortError") {
        log("Checkout canceled by the player.");
        return { status: "canceled" };
      }
      warn("Checkout failed:", error);
      return { status: "failed", reason: name ? name.replace(/Error$/, "").toUpperCase() : "PAYMENT FAILED" };
    });
}

/**
 * Credits and consumes any shard purchase Play still holds — e.g. the app was
 * closed mid-checkout, or a previous consume failed. Safe to call repeatedly.
 * Returns how many purchases were newly credited.
 */
export async function reconcileDigitalGoodsPurchases(
  service: DigitalGoodsService,
  onPurchased: (productId: ShardProductId, purchaseToken: string) => void,
): Promise<number> {
  let purchases: PurchaseDetails[];
  try {
    purchases = await withTimeout(service.listPurchases(), "listPurchases");
  } catch (error) {
    warn("listPurchases failed:", error);
    return 0;
  }

  let credited = 0;
  for (const purchase of purchases ?? []) {
    if (!isShardProductId(purchase.itemId)) continue;
    log(`Pending purchase found: ${purchase.itemId}`);
    if (claimPurchaseToken(purchase.purchaseToken)) {
      onPurchased(purchase.itemId, purchase.purchaseToken);
      credited += 1;
    }
    await consumeSafely(service, purchase.purchaseToken);
  }
  return credited;
}
