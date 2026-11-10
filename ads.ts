/**
 * Google Mobile Ads bridge for Strike Neon.
 *
 * Official AdMob IDs:
 *  - App ID: ca-app-pub-9379861410362276~8805957593
 *  - Banner Ad Unit ID: ca-app-pub-9379861410362276/3117504887
 *  - Interstitial Ad Unit ID: ca-app-pub-9379861410362276/9176354610
 *
 * Supported environments:
 *  1. Android Native WebView (Android Studio build):
 *     MainActivity injects `window.StrikeNeonNative`, and Kotlin controls
 *     the real AdMob SDK (`com.google.android.gms:play-services-ads`).
 *  2. Web / Vercel: AdMob is intentionally disabled. AdMob is requested only
 *     through the Android SDK bridge; no AdSense or H5 Games Ads fallback is used.
 *
 * Guarantees:
 *  - Fixed bottom banner never overlaps interactive controls or gameplay canvas.
 *  - Interstitial displays on Game Over, pausing game and audio.
 *  - Safe exception handling: ad blocker, network failures or missing APIs never lock the player.
 */

import type { NativeBridge } from "./billing";

/** Official AdMob Application ID */
export const AD_MOB_APP_ID = "ca-app-pub-9379861410362276~8805957593";

/** Official Fixed Bottom Banner Unit ID */
export const AD_MOB_BANNER_UNIT_ID = "ca-app-pub-9379861410362276/3117504887";

/** Official Full-Screen Interstitial Unit ID (triggered at Game Over) */
export const AD_MOB_INTERSTITIAL_UNIT_ID = "ca-app-pub-9379861410362276/9176354610";

/** CSS variable setting the bottom padding/spacing to ensure zero control occlusion */
export const BANNER_RESERVE_VAR = "--ad-banner-h";

/** Standard mobile banner height in pixels (320x50 standard) */
export const DEFAULT_BANNER_HEIGHT_PX = 50;

/** Failsafe timeout to prevent any stalled ad network from hanging the game */
export const INTERSTITIAL_FAILSAFE_MS = 10_000;

export type AdBackend = "native" | "none";

export interface AdEventPayload {
  placement?: "banner" | "interstitial";
  height?: number;
  code?: number;
  message?: string;
}

export interface InterstitialHooks {
  onBeforeAd?: () => void;
  onClosed?: () => void;
  onFailedToLoad?: () => void;
}

declare global {
  interface Window {
    StrikeNeonNative?: NativeBridge;
    StrikeNeonOnAdLoaded?: (payload: AdEventPayload) => void;
    StrikeNeonOnAdFailedToLoad?: (payload: AdEventPayload) => void;
    StrikeNeonOnAdClosed?: (payload: AdEventPayload) => void;
  }
}

export interface WebInterstitialRequest {
  appId: string;
  unitId: string;
  placement: string;
  onClosed: () => void;
  onFailedToLoad: () => void;
}

export type WebInterstitialHandler = ((req: WebInterstitialRequest) => void) | null;

let customWebInterstitialHandler: WebInterstitialHandler = null;

export function registerWebInterstitialHandler(handler: WebInterstitialHandler): void {
  customWebInterstitialHandler = handler;
}

let backend: AdBackend = "none";
let interstitialPending = false;

function nativeBridge(): NativeBridge | undefined {
  return typeof window !== "undefined" ? window.StrikeNeonNative : undefined;
}

export function isNativeAdsAvailable(): boolean {
  return typeof nativeBridge()?.showAdMobBanner === "function";
}

/**
 * Sets the CSS variable --ad-banner-h on documentElement so that .stage and the canvas
 * adjust their height/padding when a browser-side banner exists. Native Android
 * banners are outside the WebView and therefore keep this CSS reserve at zero.
 */
export function setBannerReserve(height: number): void {
  if (typeof document === "undefined") return;
  try {
    const root = document.documentElement;
    if (height > 0) {
      root.style.setProperty(
        BANNER_RESERVE_VAR,
        `calc(${Math.round(height)}px + env(safe-area-inset-bottom, 0px))`,
      );
    } else {
      root.style.removeProperty(BANNER_RESERVE_VAR);
    }
  } catch {
    /* ignore DOM errors */
  }
}

/** Initialises the ads subsystem. Safe to call multiple times. */
export function initAds(): AdBackend {
  if (isNativeAdsAvailable()) {
    backend = "native";
    // The Android Activity places AdView as a native sibling below WebView.
    // Do not reserve CSS height here or the playfield would shrink twice.
    setBannerReserve(0);
    return backend;
  }

  // AdMob is not available from an ordinary browser/PWA. Only the Android
  // native bridge can request the AdMob units configured below.
  backend = "none";
  setBannerReserve(0);
  return backend;
}

/**
 * Mounts the bottom banner into `container`.
 * Guarantees that `--ad-banner-h` is immediately set so controls are never obscured.
 */
export function showBannerAd(container: HTMLElement | null): void {
  if (!container) return;

  // AdMob banners are requested only through the native Android SDK bridge.
  if (backend === "native") {
    // Native AdView is laid out below the WebView by Android; CSS reserve stays 0.
    container.style.display = "none";
    setBannerReserve(0);
    try {
      nativeBridge()?.showAdMobBanner?.(AD_MOB_BANNER_UNIT_ID);
    } catch (err) {
      console.warn("[AdMob] Native banner error:", err);
    }
    return;
  }

  // Browser/PWA has no native AdMob SDK. Do not render a fake placeholder.
  container.style.display = "none";
  setBannerReserve(0);
}

/** Hides the bottom banner and clears the reserved screen space. */
export function hideBannerAd(): void {
  try {
    if (backend === "native") {
      nativeBridge()?.hideAdMobBanner?.();
    }
    setBannerReserve(0);
  } catch (err) {
    console.warn("[AdMob] Error hiding banner:", err);
  }
}

/**
 * Triggers an interstitial ad on the Game Over event.
 * Pauses game and audio while the ad is open, and resumes once closed or finished.
 * Safely falls back if the API fails or is unavailable on normal browser/desktop.
 */
export function maybeShowInterstitial(
  placement: "game_over",
  hooks?: InterstitialHooks,
): boolean {
  if (interstitialPending) return false;

  interstitialPending = true;

  let settled = false;
  const settle = (result: "closed" | "failed") => {
    if (settled) return;
    settled = true;
    clearTimeout(failsafe);
    interstitialPending = false;

    try {
      if (result === "closed") {
        hooks?.onClosed?.();
      } else {
        hooks?.onFailedToLoad?.();
      }
    } catch (err) {
      console.warn("[AdMob] Error in ad settlement callback:", err);
    }
  };

  // 10s Failsafe timer so the game never freezes if an ad fails silently
  const failsafe = setTimeout(() => {
    console.warn("[AdMob] Interstitial failsafe timeout fired.");
    settle("closed");
  }, INTERSTITIAL_FAILSAFE_MS);

  hooks?.onBeforeAd?.();

  // 0. Custom / Mock handler (used in unit tests or custom integrations)
  if (customWebInterstitialHandler) {
    try {
      customWebInterstitialHandler({
        appId: AD_MOB_APP_ID,
        unitId: AD_MOB_INTERSTITIAL_UNIT_ID,
        placement,
        onClosed: () => settle("closed"),
        onFailedToLoad: () => settle("failed"),
      });
      return true;
    } catch {
      settle("failed");
      return false;
    }
  }

  // 1. Try the native Android WebView bridge
  const bridge = nativeBridge();
  if (typeof bridge?.showAdMobInterstitial === "function") {
    try {
      const gWin = typeof window !== "undefined" ? window : (globalThis as unknown as Window);
      const prevClosed = gWin.StrikeNeonOnAdClosed;
      const prevFailed = gWin.StrikeNeonOnAdFailedToLoad;

      gWin.StrikeNeonOnAdClosed = (payload) => {
        if (!payload || !payload.placement || payload.placement === "interstitial") {
          gWin.StrikeNeonOnAdClosed = prevClosed;
          gWin.StrikeNeonOnAdFailedToLoad = prevFailed;
          prevClosed?.(payload);
          settle("closed");
        } else {
          prevClosed?.(payload);
        }
      };

      gWin.StrikeNeonOnAdFailedToLoad = (payload) => {
        if (!payload || !payload.placement || payload.placement === "interstitial") {
          gWin.StrikeNeonOnAdClosed = prevClosed;
          gWin.StrikeNeonOnAdFailedToLoad = prevFailed;
          prevFailed?.(payload);
          settle("failed");
        } else {
          prevFailed?.(payload);
        }
      };

      bridge.showAdMobInterstitial(AD_MOB_INTERSTITIAL_UNIT_ID, placement);
      return true;
    } catch (err) {
      console.warn("[AdMob] Native interstitial invocation threw:", err);
      settle("failed");
      return false;
    }
  }

  // Clean fallback for browser/PWA or unavailable native SDK:
  // Finishes cleanly without locking the game or displaying any mock visual card.
  settle("closed");
  return false;
}
