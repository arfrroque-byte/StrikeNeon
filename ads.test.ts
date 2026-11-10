import test from "node:test";
import assert from "node:assert/strict";
import {
  AD_MOB_APP_ID,
  AD_MOB_BANNER_UNIT_ID,
  AD_MOB_INTERSTITIAL_UNIT_ID,
  BANNER_RESERVE_VAR,
  DEFAULT_BANNER_HEIGHT_PX,
  initAds,
  setBannerReserve,
  registerWebInterstitialHandler,
  maybeShowInterstitial,
  showBannerAd,
  hideBannerAd,
} from "./ads";

test("official AdMob IDs match requirements exactly", () => {
  assert.equal(AD_MOB_APP_ID, "ca-app-pub-9379861410362276~8805957593");
  assert.equal(AD_MOB_BANNER_UNIT_ID, "ca-app-pub-9379861410362276/3117504887");
  assert.equal(AD_MOB_INTERSTITIAL_UNIT_ID, "ca-app-pub-9379861410362276/9176354610");
  assert.equal(BANNER_RESERVE_VAR, "--ad-banner-h");
  assert.equal(DEFAULT_BANNER_HEIGHT_PX, 50);
});

test("initAds initializes safely in non-native environment", () => {
  const backend = initAds();
  assert.ok(backend === "none" || backend === "native");
});

test("setBannerReserve sets documentElement variable safely", () => {
  setBannerReserve(60);
  hideBannerAd();
});

test("maybeShowInterstitial routes to web interstitial handler and pauses audio", () => {
  let beforeAdCalled = false;
  let closedCalled = false;
  let handlerCalled = false;

  registerWebInterstitialHandler((req) => {
    handlerCalled = true;
    assert.equal(req.appId, AD_MOB_APP_ID);
    assert.equal(req.unitId, AD_MOB_INTERSTITIAL_UNIT_ID);
    assert.equal(req.placement, "game_over");
    // Simulate user closing the ad after watching
    req.onClosed();
  });

  const shown = maybeShowInterstitial("game_over", {
    onBeforeAd: () => {
      beforeAdCalled = true;
    },
    onClosed: () => {
      closedCalled = true;
    },
  });

  assert.equal(shown, true);
  assert.equal(beforeAdCalled, true);
  assert.equal(handlerCalled, true);
  assert.equal(closedCalled, true);

  // Clean up
  registerWebInterstitialHandler(null);
});


test("native bridge requests the exact banner and completes a native interstitial", () => {
  const previousWindow = (globalThis as any).window;
  let bannerId = "";
  let interstitialId = "";
  let interstitialPlacement = "";
  (globalThis as any).window = {
    StrikeNeonNative: {
      showAdMobBanner: (id: string) => { bannerId = id; },
      hideAdMobBanner: () => {},
      showAdMobInterstitial: (id: string, placement: string) => {
        interstitialId = id;
        interstitialPlacement = placement;
        (globalThis as any).window.StrikeNeonOnAdClosed?.({ placement: "interstitial" });
      },
    },
  };

  try {
    assert.equal(initAds(), "native");
    const container = { style: { display: "flex" } } as HTMLElement;
    showBannerAd(container);
    assert.equal(bannerId, AD_MOB_BANNER_UNIT_ID);
    assert.equal(container.style.display, "none");

    let closed = false;
    assert.equal(maybeShowInterstitial("game_over", { onClosed: () => { closed = true; } }), true);
    assert.equal(interstitialId, AD_MOB_INTERSTITIAL_UNIT_ID);
    assert.equal(interstitialPlacement, "game_over");
    assert.equal(closed, true);
  } finally {
    hideBannerAd();
    if (previousWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = previousWindow;
  }
});

test("maybeShowInterstitial failsafe and error handling without hanging", () => {
  let failedCalled = false;

  registerWebInterstitialHandler((req) => {
    // Simulate an ad failure (e.g. ad blocker, network timeout)
    req.onFailedToLoad();
  });

  const shown = maybeShowInterstitial("game_over", {
    onFailedToLoad: () => {
      failedCalled = true;
    },
  });

  assert.equal(shown, true);
  assert.equal(failedCalled, true);

  registerWebInterstitialHandler(null);
});
