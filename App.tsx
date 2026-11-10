import { useEffect, useRef, useState } from "react";
import {
  INITIAL_ABILITIES,
  NeonShooter,
  readBest,
  readMuted,
  readSfxMuted,
  readMusicMuted,
  readSfxVolume,
  readMusicVolume,
  type AbilityState,
  type GameResult,
  type Phase,
} from "./game/engine";
import {
  PACK_PRICE_USD,
  SHARD_PACKS,
  SHARDS_PER_PACK,
  SHIP_SKINS,
  SKIN_COST_SHARDS,
  getPackByPlayProductId,
  getSkinById,
  readEquippedSkinId,
  readShards,
  readUnlockedSkins,
  writeEquippedSkinId,
  writeShards,
  writeUnlockedSkins,
  getRarityLabel,
  getRarityColor,
  type ShardPack,
  type ShipSkin,
  type SkinRarity,
} from "./game/skins";
import {
  NEON_TRAILS,
  getTrailById,
  readUnlockedTrails,
  writeUnlockedTrails,
  readEquippedTrailId,
  writeEquippedTrailId,
  type NeonTrail,
} from "./game/trails";
import {
  PROGRESSION_TITLES,
  readPilotName,
  writePilotName,
  readActiveTitleId,
  writeActiveTitleId,
  getTitleById,
  type ProgressionTitle,
} from "./game/profileCustomization";
import {
  readBoosterState,
  writeBoosterState,
  activateTimeBooster,
  activateRunBooster,
  consumeBoosterRun,
  getActiveShardMultiplier,
  getBoosterDisplayInfo,
  type ShardBoosterState,
} from "./game/boosters";
import {
  BACKGROUND_COST_SHARDS,
  BACKGROUNDS,
  readEquippedBackgroundId,
  readUnlockedBackgrounds,
  writeEquippedBackgroundId,
  writeUnlockedBackgrounds,
  type BackgroundTheme,
} from "./game/backgrounds";
import {
  PLAY_STORE_WEB_URL,
  connectBilling,
  isShardProductId,
  openPlayStoreListing,
  requestPlayProducts,
  requestPlayPurchase,
  requestRestorePurchases,
  signalBillingReady,
  validatePurchaseEvent,
  validateShardAmount,
  type BillingStatus,
  type NativeProduct,
  type PurchaseFailEvent,
  type PurchaseSuccessEvent,
  type ShardProductId,
} from "./game/billing";
import {
  connectDigitalGoods,
  isDigitalGoodsSupported,
  purchaseWithDigitalGoods,
  reconcileDigitalGoodsPurchases,
  type DigitalGoodsFailure,
  type DigitalGoodsService,
} from "./game/digitalGoods";
import {
  hideBannerAd,
  initAds,
  maybeShowInterstitial,
  showBannerAd,
} from "./game/ads";
import {
  DAILY_CLAIM_SHARDS,
  applyRun,
  canClaimDaily,
  claimDaily,
  claimMission,
  readProfile,
  writeProfile,
  type Profile,
  type GameSettings,
} from "./game/progression";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

const pad7 = (n: number) => String(Math.max(0, Math.floor(n))).padStart(7, "0");
const WEEKLY_DEAL_KEY = "strike-neon:weekly-deal-last-purchase";
const WEEKLY_DEAL_INTERVAL = 7 * 24 * 60 * 60 * 1000;
function canBuyWeeklyDeal(): boolean {
  try {
    const last = Number(localStorage.getItem(WEEKLY_DEAL_KEY) || 0);
    return !last || Date.now() - last >= WEEKLY_DEAL_INTERVAL;
  } catch { return true; }
}
function recordWeeklyDealPurchase(): void {
  try { localStorage.setItem(WEEKLY_DEAL_KEY, String(Date.now())); } catch { /* storage unavailable */ }
}

const LEGEND = [
  { glyph: "W", label: "WEAPON UP", desc: "Upgrades blaster cannon spread & firepower", tone: "yellow" },
  { glyph: "M", label: "MISSILES", desc: "+1 Salvo of heat-seeking homing rockets (Q)", tone: "red" },
  { glyph: "B", label: "CLEAR BOMB", desc: "+1 EMP pulse that clears enemy bullets (B / Space)", tone: "orange" },
  { glyph: "S", label: "SHIELD CHARGE", desc: "+1 Temporary invulnerability energy barrier (E)", tone: "green" },
  { glyph: "+", label: "EXTRA LIFE", desc: "Repairs and restores +1 ship hull integrity point", tone: "cyan" },
];

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9.5h3.6L12.5 5v14l-4.9-4.5H4v-5Z" fill="currentColor" />
      {muted ? (
        <path d="m16 9.5 5 5m0-5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <path
          d="M16 9a4.2 4.2 0 0 1 0 6m2.6-8.6a8 8 0 0 1 0 11.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function SettingsGearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function MusicNoteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" fill="currentColor" />
      <circle cx="18" cy="16" r="3" fill="currentColor" />
    </svg>
  );
}

function MissileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5c2.2 2 3.2 4.6 3.2 7.6v6.4H8.8v-6.4c0-3 1-5.6 3.2-7.6Z" fill="currentColor" />
      <path d="M8.8 12.5 6 15.5v2.5l2.8-1.4M15.2 12.5l2.8 3v2.5l-2.8-1.4" fill="currentColor" opacity="0.75" />
      <path d="M10.4 18h3.2l-1.6 3.5Z" fill="#ffb347" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.8 19.5 5.6v5.6c0 4.8-3.1 8.6-7.5 10-4.4-1.4-7.5-5.2-7.5-10V5.6Z"
        fill="currentColor"
        opacity="0.25"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="m8.6 12 2.4 2.4 4.4-4.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BombIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="14" r="6.5" fill="currentColor" />
      <path d="M15.5 9.5 18 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18.5 3.5v2M21 6h-2M20.3 4.2l-1.2 1.2" stroke="#ffd83a" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

interface AbilityButtonProps {
  label: string;
  hint: string;
  tone: "red" | "green" | "orange";
  count: number;
  disabled: boolean;
  active?: boolean;
  /** Total seconds the active ring takes to drain. */
  duration?: number;
  /** Seconds already elapsed (so the ring resumes mid-way after a pause). */
  elapsed?: number;
  onFire: () => void;
  children: React.ReactNode;
}

function AbilityButton({
  label,
  hint,
  tone,
  count,
  disabled,
  active,
  duration = 0,
  elapsed = 0,
  onFire,
  children,
}: AbilityButtonProps) {
  return (
    <button
      type="button"
      className={`ability-btn ability-${tone} ${active ? "ability-active" : ""}`}
      disabled={disabled && !active}
      aria-disabled={disabled}
      aria-label={`${label}, ${count} left${active ? ", active" : ""}`}
      style={{ "--dur": `${duration}s`, "--delay": `${-elapsed}s` } as React.CSSProperties}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!disabled) onFire();
      }}
    >
      <span className="ability-ring" aria-hidden="true" />
      <span className="ability-icon">{children}</span>
      <span className="ability-count">{count}</span>
      <span className="ability-label">{label}</span>
      <span className="ability-key">{hint}</span>
    </button>
  );
}

function RatePopup({ onRate, onClose }: { onRate: () => void; onClose: () => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="rate-backdrop" role="dialog" aria-modal="true" aria-labelledby="rate-title" onClick={onClose}>
      <div className="rate-card" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="rate-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <p className="rate-eyebrow">ENJOYING STRIKE NEON?</p>
        <h3 id="rate-title" className="rate-title">RATE US ON GOOGLE PLAY</h3>
        <p className="rate-text">Your review helps more pilots find the game.</p>
        <div className="rate-stars" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`rate-star ${n <= hover ? "rate-star-on" : ""}`}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onClick={onRate}
              aria-label={`Rate ${n} star${n > 1 ? "s" : ""} on Google Play`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m12 2.6 2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3l-5.8 3.1 1.2-6.5L2.6 9.4l6.5-.8Z" />
              </svg>
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-primary rate-cta" onClick={onRate}>
          RATE ON PLAY STORE
        </button>
        <a className="rate-web-link" href={PLAY_STORE_WEB_URL} target="_blank" rel="noopener noreferrer">
          OPEN LISTING IN BROWSER
        </a>
        <button type="button" className="rate-later" onClick={onClose}>
          NOT NOW
        </button>
      </div>
    </div>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
    </svg>
  );
}

function MenuIcon({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg className={`menu-btn-icon ${className ?? ""}`} viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

function PlayMenuIcon() {
  return (
    <MenuIcon>
      <path d="M8 5.2v13.6L19 12 8 5.2Z" fill="currentColor" />
    </MenuIcon>
  );
}

function ShipMenuIcon() {
  return (
    <MenuIcon>
      <path
        d="M12 3 14.6 9 14.6 15 16.5 18 12 16.4 7.5 18 9.4 15 9.4 9 12 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M12 10.5v4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </MenuIcon>
  );
}

function MissionsMenuIcon() {
  return (
    <MenuIcon>
      <path
        d="M4 6.5h4M4 12h4M4 17.5h4M13 6.5h7M13 12h7M13 17.5h7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </MenuIcon>
  );
}

function ShardGemIcon() {
  return (
    <svg viewBox="0 0 24 24" className="shard-svg" aria-hidden="true">
      <polygon
        points="12,2 20,9 16,22 8,22 4,9"
        fill="rgba(34,230,255,0.28)"
        stroke="#22e6ff"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <polygon points="12,5 16,10 12,19 8,10" fill="#bff8ff" opacity="0.85" />
    </svg>
  );
}

function EditPencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function PilotAvatarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="pilot-avatar-svg" aria-hidden="true">
      <polygon points="12,2 20,8 18,18 12,22 6,18 4,8" fill="rgba(34,230,255,0.2)" stroke="#22e6ff" strokeWidth="1.6" strokeLinejoin="round" />
      <polygon points="12,6 16,11 12,17 8,11" fill="rgba(255,43,214,0.4)" stroke="#ff2bd6" strokeWidth="1.2" />
      <circle cx="12" cy="11" r="2" fill="#ffffff" />
    </svg>
  );
}

function LightningIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" stroke="none" aria-hidden="true">
      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" />
    </svg>
  );
}

function ShipPreviewSvg({ skin }: { skin: ShipSkin }) {
  const points = skin.hull.map(([x, y]) => `${x},${y}`).join(" ");
  const isCommon = skin.rarity === "common";
  const isEpic = skin.rarity === "epic";
  const isLegendary = skin.rarity === "legendary";

  return (
    <svg viewBox="-34 -34 68 62" className="ship-preview-svg" aria-hidden="true">
      {/* Legendary background energy halo & resonance ring */}
      {isLegendary && (
        <>
          <circle
            cx="0"
            cy="0"
            r="26"
            fill="none"
            stroke={skin.color}
            strokeWidth="1.1"
            opacity="0.85"
            style={{ filter: `drop-shadow(0 0 6px ${skin.color})` }}
          />
          <circle
            cx="0"
            cy="0"
            r="30"
            fill="none"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="0.8"
            strokeDasharray="3 3"
          />
        </>
      )}

      {/* Legendary Inner Hull Trace Echo */}
      {isLegendary && (
        <polygon
          points={skin.hull.map(([x, y]) => `${x * 0.7},${y * 0.7}`).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="0.9"
        />
      )}

      {/* Main Hull */}
      <polygon
        points={points}
        fill={skin.fillTop}
        stroke={skin.color}
        strokeWidth={isLegendary ? "2.6" : isEpic ? "2.2" : "1.8"}
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 ${isLegendary ? "9px" : isEpic ? "6px" : "3px"} ${skin.color})` }}
      />

      {/* Epic & Legendary Wing Armor Conduits & Stabilizers */}
      {(isEpic || isLegendary) && (
        <>
          <line x1="-10" y1="-2" x2="-18" y2="10" stroke={skin.color} strokeWidth="1.2" opacity="0.9" />
          <line x1="10" y1="-2" x2="18" y2="10" stroke={skin.color} strokeWidth="1.2" opacity="0.9" />
          <line x1="-6" y1="-7" x2="-14" y2="6" stroke="#ffffff" strokeWidth="0.9" opacity="0.85" />
          <line x1="6" y1="-7" x2="14" y2="6" stroke="#ffffff" strokeWidth="0.9" opacity="0.85" />
          <line x1="-21" y1="13" x2="-25" y2="18" stroke={isLegendary ? "#ffffff" : skin.color} strokeWidth="1.2" />
          <line x1="21" y1="13" x2="25" y2="18" stroke={isLegendary ? "#ffffff" : skin.color} strokeWidth="1.2" />
        </>
      )}

      {/* Common Central Clean Spinal Line */}
      {isCommon && (
        <line x1="0" y1="-6" x2="0" y2="10" stroke="rgba(255,255,255,0.4)" strokeWidth="0.9" />
      )}

      {/* Legendary Forward Hyper-Canards & Wing Plasma Emitters & Reactor Jewel */}
      {isLegendary && (
        <>
          <line x1="-4" y1="-25" x2="-9" y2="-15" stroke="#ffffff" strokeWidth="1.3" />
          <line x1="4" y1="-25" x2="9" y2="-15" stroke="#ffffff" strokeWidth="1.3" />
          <circle cx="-22" cy="12" r="2.0" fill="#ffffff" stroke={skin.color} strokeWidth="1.2" />
          <circle cx="22" cy="12" r="2.0" fill="#ffffff" stroke={skin.color} strokeWidth="1.2" />
          <polygon points="0,3 3.5,6.5 0,10 -3.5,6.5" fill="#ffffff" />
        </>
      )}

      {/* Cockpit */}
      <polygon points="0,-12 4.5,-1 0,8 -4.5,-1" fill={skin.cockpitColor} stroke="#ffffff" strokeWidth={isCommon ? "0.8" : "1.1"} />
      {(isEpic || isLegendary) && (
        <line x1="0" y1="-8" x2="0" y2="4" stroke="#ffffff" strokeWidth="1.2" />
      )}
    </svg>
  );
}

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<NeonShooter | null>(null);
  const [phase, setPhase] = useState<Phase>("menu");
  const [abilities, setAbilities] = useState<AbilityState>(INITIAL_ABILITIES);
  /** Bumped every time a shield starts so its drain ring restarts. */
  const [shieldRun, setShieldRun] = useState(0);
  const shieldWasActiveRef = useRef(false);
  const [muted, setMuted] = useState(readMuted);
  const [sfxMuted, setSfxMuted] = useState(readSfxMuted);
  const [musicMuted, setMusicMuted] = useState(readMusicMuted);
  const [sfxVolume, setSfxVolume] = useState(readSfxVolume);
  const [musicVolume, setMusicVolume] = useState(readMusicVolume);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"audio" | "gameplay">("audio");
  const [best, setBest] = useState(readBest);
  const [bestKills, setBestKills] = useState(() => Math.max(0, readProfile().bestKills || 0, ...readProfile().scores.map((s) => Number(s.kills) || 0)));
  const [result, setResult] = useState<GameResult | null>(null);
  const [ratePopupOpen, setRatePopupOpen] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [profile, setProfile] = useState<Profile>(readProfile);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [missionsTab, setMissionsTab] = useState<"daily" | "weekly">("daily");
  const [briefingOpen, setBriefingOpen] = useState(false);


  // Shards & 10 Ship Skins state
  const [shards, setShards] = useState<number>(readShards);
  const [unlockedSkins, setUnlockedSkins] = useState<string[]>(readUnlockedSkins);
  const [equippedSkinId, setEquippedSkinId] = useState<string>(readEquippedSkinId);
  const [hangarOpen, setHangarOpen] = useState(false);
  const [hangarTab, setHangarTab] = useState<"ships" | "trails" | "backgrounds">("ships");
  const [unlockedBgs, setUnlockedBgs] = useState<string[]>(readUnlockedBackgrounds);
  const [equippedBgId, setEquippedBgId] = useState<string>(readEquippedBackgroundId);
  const [unlockedTrails, setUnlockedTrails] = useState<string[]>(readUnlockedTrails);
  const [equippedTrailId, setEquippedTrailId] = useState<string>(readEquippedTrailId);
  const [pilotName, setPilotName] = useState<string>(readPilotName);
  const [activeTitleId, setActiveTitleId] = useState<string>(readActiveTitleId);
  const [titlesModalOpen, setTitlesModalOpen] = useState(false);
  const [nameEditorOpen, setNameEditorOpen] = useState(false);
  const [tempName, setTempName] = useState("");
  const [boosterState, setBoosterState] = useState<ShardBoosterState>(readBoosterState);
  const boosterDisplay = getBoosterDisplayInfo();

  useEffect(() => {
    const timer = setInterval(() => {
      setBoosterState(readBoosterState());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const [notice, setNotice] = useState<string | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatus>("checking");
  /** Bumped to re-run bridge detection after a failed connection (RETRY button). */
  const [billingAttempt, setBillingAttempt] = useState(0);
  const [buyingProductId, setBuyingProductId] = useState<string | null>(null);
  const [storePrices, setStorePrices] = useState<Record<string, string>>({});
  /** Which Play Billing path is live: browser Digital Goods API or Kotlin WebView bridge. */
  const [storeProvider, setStoreProvider] = useState<"digital-goods" | "native" | null>(null);
  const [billingError, setBillingError] = useState<DigitalGoodsFailure | null>(null);
  const [playStorePromptPack, setPlayStorePromptPack] = useState<ShardPack | null>(null);
  const digitalGoodsRef = useRef<DigitalGoodsService | null>(null);
  const lastBillingRetryRef = useRef(0);

  const equippedSkin = getSkinById(equippedSkinId);
  const playStoreReady = billingStatus === "ready";
  const shieldActive = abilities.shieldTime > 0;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const engine = new NeonShooter(host, {
      onPhase: (next) => {
        setPhase(next);
        if (engineRef.current) setBest(engineRef.current.getBest());
      },
      onAbilities: (next) => {
        if (next.shieldTime > 0 && shieldWasActiveRef.current === false) setShieldRun((n) => n + 1);
        shieldWasActiveRef.current = next.shieldTime > 0;
        setAbilities(next);
      },
      onGameOver: (r) => {
        setResult(r);
        setBest(r.best);
        setBestKills((current) => Math.max(current, r.kills));
        // Request AdMob interstitial on the game-over transition.
        // If native or H5 ad triggers, pauses audio while ad is open and restores when closed.
        const engine = engineRef.current;
        if (engine) {
          const wasMuted = engine.isMuted();
          const restore = () => {
            engineRef.current?.setMuted(wasMuted);
          };
          try {
            const active = maybeShowInterstitial("game_over", {
              onBeforeAd: () => {
                engineRef.current?.setMuted(true);
              },
              onClosed: () => {
                restore();
              },
              onFailedToLoad: () => {
                restore();
              },
            });
            if (active) {
              engine.setMuted(true);
            }
          } catch (err) {
            console.warn("[AdMob] Exception presenting interstitial:", err);
            restore();
          }
        }
        setProfile((current) => {
          const next = applyRun(current, {
            score: r.score,
            wave: r.wave,
            kills: r.kills,
            bosses: r.bosses,
            missileKills: r.missileKills,
            bombsUsed: r.bombsUsed,
            shieldsUsed: r.shieldsUsed,
            maxCombo: r.maxCombo,
            flawless: r.flawless,
          }, engineRef.current?.getStartMissions());
          const baseReward = Math.max(0, next.earnedShards - current.earnedShards);
          const mult = getActiveShardMultiplier();
          const reward = baseReward * mult;
          if (reward) {
            setShards((value) => writeShards(value + reward));
            if (mult > 1) {
              setNotice(`+${reward} SHARDS (${mult}X BOOSTER APPLIED!)`);
            }
          }
          consumeBoosterRun();
          setBoosterState(readBoosterState());
          // Ask after a new record, a boss kill, or every third run.
          const shouldAsk = r.newRecord || r.bosses > 0 || next.runs % 3 === 0;
          if (shouldAsk) setRatePopupOpen(true);
          return next;
        });
      },
    });
    engineRef.current = engine;
    setMuted(engine.isMuted());
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);

  // Browsers only allow audio after a gesture, so the first tap starts the theme.
  useEffect(() => {
    const wake = () => engineRef.current?.prepareAudio();
    window.addEventListener("pointerdown", wake, { once: true });
    window.addEventListener("keydown", wake, { once: true });
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  // AdMob: fixed bottom banner for the whole session.
  useEffect(() => {
    initAds();
    showBannerAd(bannerRef.current);
    return () => hideBannerAd();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (briefingOpen) {
        if (event.code === "Escape") {
          setBriefingOpen(false);
          return;
        }
        if (event.code === "Enter" || event.code === "Space") {
          event.preventDefault();
          start();
          return;
        }
      }
      if (hangarOpen || missionsOpen) {
        if (event.code === "Escape") {
          setHangarOpen(false);
          setMissionsOpen(false);
        }
        return;
      }
      if (event.code !== "Enter") return;
      if (phase === "menu") setBriefingOpen(true);
      else if (phase === "gameover") start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, hangarOpen, missionsOpen, briefingOpen]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Credits a Play purchase whose token was just claimed by digitalGoods.ts
  // (claiming first guarantees each token credits at most once).
  const creditPlayPack = (productId: ShardProductId) => {
    const pack = getPackByPlayProductId(productId);
    if (!pack) return;
    setShards(writeShards(readShards() + pack.shards));
    if (productId === "shards_weekly_090") recordWeeklyDealPurchase();
    engineRef.current?.playBuySfx();
    setNotice(`+${pack.shards} SHARDS · PLAY STORE PAYMENT CONFIRMED`);
    console.info("[billing] credited", pack.shards, "shards for", productId);
  };

  useEffect(() => {
    let disposed = false;

    // Native product list is trusted only for the exact Play Console IDs.
    const applyNativePrices = (products: NativeProduct[]) => {
      const next: Record<string, string> = {};
      for (const product of products) {
        if (isShardProductId(product.productId) && product.price) next[product.productId] = product.price;
      }
      if (Object.keys(next).length > 0) setStorePrices(next);
    };

    // Called by Kotlin only after the purchase is PURCHASED and consumed.
    const creditPurchase = (event: PurchaseSuccessEvent) => {
      const pack = getPackByPlayProductId(event.productId);
      if (!pack || !isShardProductId(event.productId)) {
        setBuyingProductId(null);
        setNotice("PURCHASE ID UNRECOGNIZED — NOTHING CREDITED");
        return;
      }
      if (!validatePurchaseEvent(event)) {
        // Replay of a transaction that was already credited: stay silent.
        setBuyingProductId(null);
        return;
      }
      if (!validateShardAmount(event.productId, event.shards)) {
        setBuyingProductId(null);
        setNotice("AMOUNT MISMATCH — PURCHASE HELD FOR REVIEW");
        return;
      }
      // The Play Console catalog is authoritative; the native-reported shard
      // field is informational only, so the pack mapping decides the amount.
      setShards((current) => writeShards(current + pack.shards));
      if (event.productId === "shards_weekly_090") recordWeeklyDealPurchase();
      setBuyingProductId(null);
      engineRef.current?.playBuySfx();
      setNotice(`+${pack.shards} SHARDS · PLAY STORE PAYMENT CONFIRMED`);
    };

    const failPurchase = (event: PurchaseFailEvent) => {
      setBuyingProductId(null);
      const reason = (event.reason || "FAILED").replace(/_/g, " ");
      setNotice(`PLAY STORE: ${reason}`);
    };

    window.StrikeNeonOnBillingReady = (payload) => {
      // Kotlin fires this only after onBillingSetupFinished reports OK —
      // this is the single "Play connection confirmed" signal.
      signalBillingReady();
      setBillingStatus("ready");
      if (payload?.products) applyNativePrices(payload.products);
    };
    window.StrikeNeonOnPurchaseSuccess = (event) => {
      creditPurchase(event);
      // Acknowledge durable native delivery only after this page has processed it.
      if (event.purchaseToken) window.StrikeNeonNative?.ackPurchaseDelivery?.(event.purchaseToken);
    };
    window.StrikeNeonOnPurchaseFailed = failPurchase;
    window.StrikeNeonOnPurchaseCanceled = () => {
      setBuyingProductId(null);
      setNotice("PURCHASE CANCELED");
    };
    window.StrikeNeonOnProducts = (payload) => {
      applyNativePrices(payload.products);
      if (payload.products.length > 0) {
        // A successful product query also proves the Play connection is up.
        signalBillingReady();
        setBillingStatus("ready");
      }
    };

    // Connect to Play Billing with automatic reconnection attempts. Product
    // queries only happen after connectBilling confirms the native
    // BillingClient finished its setup against Google Play.
    const init = async () => {
      setBillingStatus("checking");
      setBillingError(null);

      // 1) Browser environments that expose Google Play Digital Goods + PaymentRequest.
      if (isDigitalGoodsSupported()) {
        const dg = await connectDigitalGoods({
          isAborted: () => disposed,
          onAttempt: (attempt) => {
            if (attempt > 1) setNotice(`RECONNECTING TO GOOGLE PLAY (ATTEMPT ${attempt})`);
          },
        });
        if (disposed) return;
        if (dg.ok) {
          digitalGoodsRef.current = dg.service;
          const prices: Record<string, string> = {};
          for (const product of Object.values(dg.products)) {
            if (product?.price) prices[product.productId] = product.price;
          }
          setStorePrices(prices);
          setStoreProvider("digital-goods");
          setBillingStatus("ready");
          // Finish purchases interrupted by a crash or a failed consume.
          void reconcileDigitalGoodsPurchases(dg.service, creditPlayPack);
          return;
        }
        if (dg.reason !== "unsupported") {
          console.warn("[billing] Google Play Billing unavailable:", dg.reason, dg.message ?? "");
          setBillingError(dg.reason);
          setBillingStatus("unavailable");
          return;
        }
      }

      // 2) Android WebView build: Kotlin bridge (window.StrikeNeonNative).
      const result = await connectBilling({
        isAborted: () => disposed,
        onAttempt: (attempt, state) => {
          if (attempt > 1 && state === "connecting") {
            setNotice(`RECONNECTING TO GOOGLE PLAY (ATTEMPT ${attempt})`);
          }
        },
      });
      if (disposed) return;
      if (result.connected && result.bridge) {
        setStoreProvider("native");
        setBillingStatus("ready");
        requestPlayProducts();
      } else {
        console.warn(
          "[billing] No Google Play Billing path: this is not the Strike Neon Android app and no native bridge is present.",
        );
        setBillingError("unsupported");
        setBillingStatus("unavailable");
      }
    };
    void init();

    return () => {
      disposed = true;
      window.StrikeNeonOnBillingReady = undefined;
      window.StrikeNeonOnPurchaseSuccess = undefined;
      window.StrikeNeonOnPurchaseFailed = undefined;
      window.StrikeNeonOnPurchaseCanceled = undefined;
      window.StrikeNeonOnProducts = undefined;
    };
  }, [billingAttempt]);

  // Reactivation: when the store is down, retry when the app comes back to the
  // foreground, the network returns, or the Hangar is opened (throttled).
  useEffect(() => {
    if (billingStatus !== "unavailable" || billingError === "unsupported") return;
    const retry = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastBillingRetryRef.current < 15_000) return;
      lastBillingRetryRef.current = now;
      console.info("[billing] Reactivating Google Play Billing connection…");
      setBillingAttempt((n) => n + 1);
    };
    if (hangarOpen) retry();
    document.addEventListener("visibilitychange", retry);
    window.addEventListener("online", retry);
    return () => {
      document.removeEventListener("visibilitychange", retry);
      window.removeEventListener("online", retry);
    };
  }, [billingStatus, billingError, hangarOpen]);

  const start = () => {
    setBriefingOpen(false);
    setHangarOpen(false);
    setMissionsOpen(false);
    setRatePopupOpen(false);
    engineRef.current?.start();
  };

  const claimDailyReward = () => {
    if (!canClaimDaily(profile)) return;
    const { profile: next, shards: baseReward } = claimDaily(profile);
    const mult = getActiveShardMultiplier();
    const reward = baseReward * mult;
    setProfile(next);
    setShards((v) => writeShards(v + reward));
    engineRef.current?.playBuySfx();
    setNotice(mult > 1 ? `DAILY CLAIM: +${reward} SHARDS (${mult}X BOOSTER!)` : `DAILY CLAIM: +${reward} SHARDS`);
  };

  const claim = (id: string) => {
    setProfile(() => {
      const fresh = readProfile();
      const next = claimMission(fresh, id);
      const baseReward = next.earnedShards - fresh.earnedShards;
      if (baseReward > 0) {
        const mult = getActiveShardMultiplier();
        const reward = baseReward * mult;
        setShards((v) => writeShards(v + reward));
        engineRef.current?.playBuySfx();
        if (mult > 1) {
          setNotice(`MISSION CLAIM: +${reward} SHARDS (${mult}X BOOSTER!)`);
        }
      }
      return next;
    });
  };

  const handleSelectTrail = (trail: NeonTrail) => {
    const isUnlocked = trail.cost === 0 || unlockedTrails.includes(trail.id);
    if (isUnlocked) {
      const nextId = writeEquippedTrailId(trail.id);
      setEquippedTrailId(nextId);
      engineRef.current?.setTrail(nextId);
      engineRef.current?.playEquipSfx();
      setNotice(`EQUIPPED ${trail.name}`);
      return;
    }
    if (shards < trail.cost) {
      setNotice(`NEED ${trail.cost - shards} MORE SHARDS FOR THIS TRAIL`);
      return;
    }
    const nextShards = writeShards(shards - trail.cost);
    const nextUnlocked = writeUnlockedTrails([...unlockedTrails, trail.id]);
    const nextId = writeEquippedTrailId(trail.id);
    setShards(nextShards);
    setUnlockedTrails(nextUnlocked);
    setEquippedTrailId(nextId);
    engineRef.current?.setTrail(nextId);
    engineRef.current?.playBuySfx();
    setNotice(`UNLOCKED & EQUIPPED ${trail.name}!`);
  };

  const handleBuyBooster = (type: "time" | "runs", cost: number) => {
    if (shards < cost) {
      setNotice(`NEED ${cost - shards} MORE SHARDS`);
      return;
    }
    const nextShards = writeShards(shards - cost);
    setShards(nextShards);
    const nextState = type === "time" ? activateTimeBooster(15, 2) : activateRunBooster(3, 2);
    setBoosterState(nextState);
    engineRef.current?.playBuySfx();
    setNotice(`ACTIVATED 2X SHARD BOOSTER!`);
  };

  const handleSelectBackground = (bg: BackgroundTheme) => {
    const isUnlocked = bg.cost === 0 || unlockedBgs.includes(bg.id);
    if (isUnlocked) {
      const nextId = writeEquippedBackgroundId(bg.id);
      setEquippedBgId(nextId);
      engineRef.current?.setBackground(nextId);
      engineRef.current?.playEquipSfx();
      setNotice(`EQUIPPED ${bg.name}`);
      return;
    }
    if (shards < bg.cost) {
      setNotice(`NEED ${bg.cost} SHARDS FOR THIS BACKGROUND`);
      return;
    }
    const nextShards = writeShards(shards - bg.cost);
    const nextUnlocked = writeUnlockedBackgrounds([...unlockedBgs, bg.id]);
    const nextId = writeEquippedBackgroundId(bg.id);
    setShards(nextShards);
    setUnlockedBgs(nextUnlocked);
    setEquippedBgId(nextId);
    engineRef.current?.setBackground(nextId);
    engineRef.current?.playBuySfx();
    setNotice(`UNLOCKED & EQUIPPED ${bg.name}!`);
  };

  const rateGame = () => {
    // Opens market://details?id=com.sarfen1.strikeneon when the Play Store app
    // is available, otherwise the https listing on play.google.com.
    openPlayStoreListing();
    setRatePopupOpen(false);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    engineRef.current?.setMuted(next);
  };

  const toggleSfxMute = () => {
    const next = !sfxMuted;
    setSfxMuted(next);
    engineRef.current?.setSfxMuted(next);
  };

  const toggleMusicMute = () => {
    const next = !musicMuted;
    setMusicMuted(next);
    engineRef.current?.setMusicMuted(next);
  };

  const changeSfxVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setSfxVolume(clamped);
    engineRef.current?.setSfxVolume(clamped);
  };

  const changeMusicVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setMusicVolume(clamped);
    engineRef.current?.setMusicVolume(clamped);
  };

  const handleTestSfx = () => {
    engineRef.current?.testSfx();
  };

  const updateGameSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setProfile((prev) => {
      const nextSettings = { ...prev.settings, [key]: value };
      const next = { ...prev, settings: nextSettings };
      writeProfile(next);
      engineRef.current?.updateSettings(nextSettings);
      return next;
    });
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  const handleRestorePurchases = () => {
    if (!playStoreReady) {
      setNotice("CHECKOUT UNAVAILABLE.");
      return;
    }
    const service = digitalGoodsRef.current;
    if (storeProvider === "digital-goods" && service) {
      setNotice("RESTORING PLAY PURCHASES…");
      void reconcileDigitalGoodsPurchases(service, creditPlayPack).then((count) => {
        if (count === 0) setNotice("NO PENDING PURCHASES TO RESTORE");
      });
      return;
    }
    if (requestRestorePurchases()) setNotice("RESTORING PLAY PURCHASES…");
  };

  const handleBuyShardPack = (pack: ShardPack) => {
    if (pack.id === "weekly-deal" && !canBuyWeeklyDeal()) {
      const remaining = WEEKLY_DEAL_INTERVAL - (Date.now() - Number(localStorage.getItem(WEEKLY_DEAL_KEY) || 0));
      const days = Math.max(1, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
      setNotice(`WEEKLY DEAL AVAILABLE AGAIN IN ${days} DAY${days === 1 ? "" : "S"}.`);
      return;
    }

    if (!playStoreReady) {
      setPlayStorePromptPack(pack);
      return;
    }
    if (buyingProductId) return;
    const service = digitalGoodsRef.current;
    if (storeProvider === "digital-goods" && service && isShardProductId(pack.playProductId)) {
      setBuyingProductId(pack.playProductId);
      setNotice("OPENING GOOGLE PLAY CHECKOUT…");
      // Called synchronously so PaymentRequest.show() keeps the click gesture.
      void purchaseWithDigitalGoods(service, pack.playProductId, creditPlayPack).then((outcome) => {
        setBuyingProductId(null);
        if (outcome.status === "canceled") setNotice("PURCHASE CANCELED");
        else if (outcome.status === "failed") setNotice(`PLAY STORE: ${outcome.reason}`);
      });
      return;
    }
    setBuyingProductId(pack.playProductId);
    setNotice("OPENING GOOGLE PLAY CHECKOUT…");
    const launched = requestPlayPurchase(pack.playProductId);
    if (!launched) {
      setBuyingProductId(null);
      setPlayStorePromptPack(pack);
    }
  };

  const handleSelectSkin = (skin: ShipSkin) => {
    // The default ship is always free and available, even without a saved unlock list.
    const isUnlocked = skin.perk === "none" || skin.cost === 0 || unlockedSkins.includes(skin.id);
    if (isUnlocked) {
      const nextId = writeEquippedSkinId(skin.id);
      setEquippedSkinId(nextId);
      engineRef.current?.setSkin(nextId);
      engineRef.current?.playEquipSfx();
      setNotice(`EQUIPPED ${skin.name}`);
      return;
    }

    if (shards < skin.cost) {
      setNotice(`NEED ${skin.cost} SHARDS ($${PACK_PRICE_USD.toFixed(2)} = ${SHARDS_PER_PACK} SHARDS)`);
      return;
    }

    const nextShards = writeShards(shards - skin.cost);
    const nextUnlocked = writeUnlockedSkins([...unlockedSkins, skin.id]);
    const nextId = writeEquippedSkinId(skin.id);
    setShards(nextShards);
    setUnlockedSkins(nextUnlocked);
    setEquippedSkinId(nextId);
    engineRef.current?.setSkin(nextId);
    engineRef.current?.playBuySfx();
    setNotice(`UNLOCKED & EQUIPPED ${skin.name}!`);
  };

  const playing = phase === "playing";
  const claimableMissionsCount = profile.missions.filter((m) => m.progress >= m.target && !m.claimed).length;

  return (
    <main className="app">
      <div className="stage">
        <div ref={hostRef} className="stage-canvas" />

        {playing && (
          <div className="top-controls">
            <button
              className="icon-btn"
              onClick={toggleMute}
              aria-label={muted ? "Turn sound on" : "Turn sound off"}
              aria-pressed={muted}
            >
              <SoundIcon muted={muted} />
            </button>
            <button className="icon-btn" onClick={() => engineRef.current?.pause()} aria-label="Pause game">
              <PauseIcon />
            </button>
          </div>
        )}

        {playing && (
          <div
            className={`ability-dock ability-dock-${profile.settings.abilitySide}`}
            style={{ transform: `scale(${profile.settings.buttonScale})`, transformOrigin: `${profile.settings.abilitySide} bottom` }}
            role="group"
            aria-label="Special abilities"
          >
            <AbilityButton
              key={`shield-${shieldRun}`}
              label="SHIELD"
              hint="E"
              tone="green"
              count={abilities.shields}
              active={shieldActive}
              duration={abilities.shieldDuration}
              elapsed={abilities.shieldDuration - abilities.shieldTime}
              disabled={abilities.shields <= 0 || shieldActive}
              onFire={() => engineRef.current?.activateShield()}
            >
              <ShieldIcon />
            </AbilityButton>
            <AbilityButton
              label="MISSILE"
              hint="Q"
              tone="red"
              count={abilities.missiles}
              disabled={abilities.missiles <= 0}
              onFire={() => engineRef.current?.missiles()}
            >
              <MissileIcon />
            </AbilityButton>
            <AbilityButton
              label="BOMB"
              hint="B"
              tone="orange"
              count={abilities.bombs}
              disabled={abilities.bombs <= 0}
              onFire={() => engineRef.current?.bomb()}
            >
              <BombIcon />
            </AbilityButton>
          </div>
        )}

        {phase === "menu" && !hangarOpen && !missionsOpen && (
          <section className="screen menu" aria-label="Main menu">
            {/* Unified Top Navigation Bar - strictly aligned, zero overlap */}
            <div className="menu-top-bar">
              <div className="pilot-hud-card">
                <div className="pilot-avatar-box">
                  <PilotAvatarIcon />
                </div>
                <div className="pilot-info-col">
                  <div className="pilot-name-row">
                    <span className="pilot-name-text">{pilotName}</span>
                    <button
                      type="button"
                      className="pilot-edit-btn"
                      onClick={() => {
                        setTempName(pilotName);
                        setNameEditorOpen(true);
                      }}
                      aria-label="Edit pilot name"
                      title="Change pilot callsign"
                    >
                      <EditPencilIcon />
                    </button>
                  </div>
                  <div className="pilot-meta-row">
                    <span className="pilot-level-badge">LVL {profile.level}</span>
                    <button
                      type="button"
                      className="pilot-title-btn"
                      onClick={() => setTitlesModalOpen(true)}
                      aria-label={`Change active title. Current: ${getTitleById(activeTitleId).name}`}
                      title="Change Active Title"
                    >
                      {getTitleById(activeTitleId).name} ▾
                    </button>
                  </div>
                </div>
              </div>

              <div className="menu-top-actions">
                <button
                  type="button"
                  className="shard-pill"
                  onClick={() => setHangarOpen(true)}
                  aria-label={`Shards balance: ${shards}. Open Shard Store`}
                >
                  <ShardGemIcon />
                  <span className="shard-count">{shards}</span>
                  <span className="shard-plus">+</span>
                </button>

                {boosterDisplay.active && (
                  <div className="booster-pill" title={boosterDisplay.details}>
                    <LightningIcon />
                    <span>{boosterDisplay.text}</span>
                  </div>
                )}

                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Open Settings"
                  title="Settings"
                >
                  <SettingsGearIcon />
                </button>
              </div>
            </div>

            <header className="logo">
              <span className="logo-top">STRIKE</span>
              <span className="logo-bottom">NEON</span>
              <span className="logo-sub">
                <i className="logo-sub-line" aria-hidden="true" />
                LLCGAMES STUDIO
                <i className="logo-sub-line" aria-hidden="true" />
              </span>
            </header>

            <div className="menu-center">
              <button className="btn btn-primary btn-start-game" onClick={() => setBriefingOpen(true)}>
                <span className="btn-start-text">START GAME</span>
              </button>

              <button
                type="button"
                className="btn btn-hangar"
                onClick={() => setHangarOpen(true)}
              >
                <span className="btn-hangar-text">Hangar</span>
              </button>

              <button type="button" className="btn missions-menu-btn" onClick={() => setMissionsOpen(true)}>
                <span className="missions-btn-col">
                  <span className="missions-text-large">MISSIONS</span>
                  <span className="missions-claimable-text">
                    {claimableMissionsCount} {claimableMissionsCount === 1 ? "TO CLAIM" : "TO CLAIM"}
                  </span>
                </span>
                {claimableMissionsCount > 0 && (
                  <span className="missions-reward-badge" aria-label="Rewards ready">
                    {claimableMissionsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`btn daily-claim-btn ${canClaimDaily(profile) ? "daily-ready" : ""}`}
                disabled={!canClaimDaily(profile)}
                onClick={claimDailyReward}
              >
                <span className="daily-claim-text">
                  {canClaimDaily(profile) ? `DAILY CLAIM · +${DAILY_CLAIM_SHARDS} SHARDS` : "DAILY CLAIM COLLECTED"}
                </span>
              </button>

              <button
                type="button"
                className="btn btn-settings"
                onClick={() => setSettingsOpen(true)}
              >
                <span className="btn-row">
                  <SettingsGearIcon />
                  <span className="btn-settings-text">SETTINGS</span>
                </span>
              </button>

              <p className="best-line">
                <span>BEST SCORE</span>
                <b>{pad7(best)}</b>
                <span>BEST KILLS</span>
                <b>{pad7(bestKills)}</b>
              </p>
            </div>

            <div className="menu-ship-space" aria-hidden="true" />

            <footer className="menu-bottom">
              {installEvent && (
                <button className="link-btn" onClick={install}>
                  INSTALL APP
                </button>
              )}
            </footer>
          </section>
        )}

        {phase === "paused" && !hangarOpen && (
          <section className="screen overlay" aria-label="Game paused">
            <p className="eyebrow">SYSTEM HOLD</p>
            <h2 className="title title-cyan">PAUSED</h2>
            <div className="btn-stack">
              <button className="btn btn-primary" onClick={() => engineRef.current?.resume()}>
                RESUME
              </button>
              <button className="btn" onClick={() => setSettingsOpen(true)}>
                SETTINGS
              </button>
              <button className="btn" onClick={start}>
                RESTART
              </button>
              <button className="btn btn-ghost" onClick={() => engineRef.current?.quit()}>
                MAIN MENU
              </button>
            </div>
          </section>
        )}

        {phase === "gameover" && ratePopupOpen && !hangarOpen && (
          <RatePopup onRate={rateGame} onClose={() => setRatePopupOpen(false)} />
        )}

        {phase === "gameover" && result && !hangarOpen && (
          <section className="screen overlay" aria-label="Game over">
            <p className="eyebrow">MISSION FAILED</p>
            <h2 className="title title-danger">GAME OVER</h2>
            {result.newRecord && <p className="badge-record">NEW RECORD!</p>}
            <dl className="stats">
              <div>
                <dt>SCORE</dt>
                <dd>{pad7(result.score)}</dd>
              </div>
              <div>
                <dt>BEST</dt>
                <dd>{pad7(result.best)}</dd>
              </div>
              <div>
                <dt>WAVE</dt>
                <dd>{result.wave}</dd>
              </div>
              <div>
                <dt>KILLS</dt>
                <dd>{result.kills}</dd>
              </div>
            </dl>
            <div className="btn-stack">
              <button className="btn btn-primary" onClick={start}>
                PLAY AGAIN
              </button>
              <button className="btn" onClick={() => setHangarOpen(true)}>
                SHIP HANGAR ({unlockedSkins.length}/{SHIP_SKINS.length} SKINS)
              </button>
              <button className="btn btn-ghost" onClick={() => engineRef.current?.quit()}>
                MAIN MENU
              </button>
            </div>
          </section>
        )}

        {hangarOpen && (
          <section className="screen hangar-modal" aria-label="Cosmetics and Shard Store">
            <div className="hangar-header">
              <div className="hangar-title-wrap">
                <span className="hangar-eyebrow">
                  {hangarTab === "ships"
                    ? `${SHARDS_PER_PACK} SHARDS = $${PACK_PRICE_USD.toFixed(2)} · EACH SKIN = ${SKIN_COST_SHARDS} SHARDS`
                    : hangarTab === "trails"
                      ? "CUSTOMIZE YOUR NEON ENGINE DISCHARGE TRAIL"
                      : `EACH BACKGROUND = ${BACKGROUND_COST_SHARDS} SHARDS (≈ $1.99)`}
                </span>
                <h2 className="hangar-title">NEON HANGAR</h2>
              </div>
              <div className="hangar-header-actions">
                <div className="shard-pill" title={`Shards balance: ${shards}`}>
                  <ShardGemIcon />
                  <span className="shard-count">{shards}</span>
                </div>
                <button
                  type="button"
                  className="hangar-close"
                  onClick={() => setHangarOpen(false)}
                  aria-label="Close Hangar"
                >
                  ✕
                </button>
              </div>
            </div>

            {notice && <div className="hangar-toast">{notice}</div>}

            <div className="hangar-tabs" role="tablist" aria-label="Cosmetic categories">
              <button
                type="button"
                role="tab"
                aria-selected={hangarTab === "ships"}
                className={`hangar-tab ${hangarTab === "ships" ? "hangar-tab-on" : ""}`}
                onClick={() => setHangarTab("ships")}
              >
                SHIPS
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={hangarTab === "trails"}
                className={`hangar-tab ${hangarTab === "trails" ? "hangar-tab-on" : ""}`}
                onClick={() => setHangarTab("trails")}
              >
                NEON TRAILS
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={hangarTab === "backgrounds"}
                className={`hangar-tab ${hangarTab === "backgrounds" ? "hangar-tab-on" : ""}`}
                onClick={() => setHangarTab("backgrounds")}
              >
                BACKGROUNDS
              </button>
            </div>

            <div className="shard-store-box compact">
              <div className="shard-store-top">
                <span className="shard-store-label">GET SHARDS (PLAY STORE)</span>
                <span className="shard-store-actions">
                  {billingStatus === "unavailable" && (
                    <>
                      <span className="shard-rate-tag billing-off">
                        {billingError === "no-products"
                          ? "PRODUCTS NOT FOUND"
                          : "PLAY REQUIRED"}
                      </span>
                      <button
                        type="button"
                        className="shard-restore-btn"
                        onClick={openPlayStoreListing}
                        aria-label="Open in Google Play Store"
                        title="Open in Google Play"
                      >
                        PLAY STORE
                      </button>
                    </>
                  )}
                  {(billingStatus === "checking" || playStoreReady) && (
                    <span className={`shard-rate-tag ${playStoreReady ? "billing-live" : ""}`}>
                      {billingStatus === "checking" ? "CONNECTING…" : "PLAY CHECKOUT"}
                    </span>
                  )}
                  {playStoreReady && (
                    <button
                      type="button"
                      className="shard-restore-btn"
                      onClick={handleRestorePurchases}
                      aria-label="Restore Google Play purchases"
                    >
                      RESTORE
                    </button>
                  )}
                </span>
              </div>
              <div className="shard-packs-row compact">
                {SHARD_PACKS.filter((pack) => pack.id !== "weekly-deal").map((pack) => {
                  const livePrice = storePrices[pack.playProductId];
                  const busy = buyingProductId === pack.playProductId;
                  return (
                    <button
                      key={pack.id}
                      type="button"
                      className={`shard-pack-card compact ${pack.shards === 500 ? "shard-pack-featured" : ""} ${busy ? "shard-pack-busy" : ""}`}
                      disabled={Boolean(buyingProductId)}
                      onClick={() => handleBuyShardPack(pack)}
                      title={!playStoreReady ? "Tap to open on Google Play" : undefined}
                    >
                      <div className="shard-pack-amount">
                        <ShardGemIcon />
                        <span>{pack.shards}</span>
                      </div>
                      <span className="shard-pack-price">{busy ? "WAIT…" : `$${pack.priceUsd.toFixed(2)}`}</span>
                    </button>
                  );
                })}
              </div>

              <div className="weekly-deal-heading">
                <span>★ WEEKLY DEAL ★</span>
                <small>{canBuyWeeklyDeal() ? "ONCE PER WEEK" : "PURCHASED · 7 DAY COOLDOWN"}</small>
              </div>
              {SHARD_PACKS.filter((pack) => pack.id === "weekly-deal").map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  className={`weekly-deal-card ${buyingProductId === pack.playProductId ? "shard-pack-busy" : ""}`}
                  disabled={Boolean(buyingProductId)}
                  onClick={() => handleBuyShardPack(pack)}
                  aria-label="Weekly Deal: 1,000 Shards for $0.90, once per week"
                >
                  <span className="weekly-deal-gem"><ShardGemIcon /></span>
                  <span className="weekly-deal-copy">
                    <b>1,000 SHARDS</b>
                    <small>EXCLUSIVE WEEKLY VALUE · ONE PURCHASE EVERY 7 DAYS</small>
                  </span>
                  <strong>{buyingProductId === pack.playProductId ? "WAIT…" : "$0.90"}</strong>
                </button>
              ))}

            </div>

            <div className="skins-list-header">
              {hangarTab === "ships" ? (
                <>
                  <span>10 SHIP SKINS</span>
                  <span>
                    UNLOCKED {unlockedSkins.length}/{SHIP_SKINS.length}
                  </span>
                </>
              ) : hangarTab === "trails" ? (
                <>
                  <span>10 NEON TRAILS</span>
                  <span>
                    UNLOCKED {unlockedTrails.length}/{NEON_TRAILS.length}
                  </span>
                </>
              ) : (
                <>
                  <span>5 RETRO BACKGROUNDS</span>
                  <span>
                    UNLOCKED {unlockedBgs.length}/{BACKGROUNDS.length}
                  </span>
                </>
              )}
            </div>

            {hangarTab === "backgrounds" && (
              <div className="skins-grid">
                {BACKGROUNDS.map((bg, idx) => {
                  const unlocked = bg.cost === 0 || unlockedBgs.includes(bg.id);
                  const equipped = equippedBgId === bg.id;
                  return (
                    <div
                      key={bg.id}
                      className={`skin-card bg-card ${equipped ? "skin-card-equipped" : ""}`}
                      style={{ "--skin-color": bg.starColor } as React.CSSProperties}
                    >
                      <div className="skin-card-top">
                        <span className="skin-index">#{String(idx + 1).padStart(2, "0")}</span>
                        {bg.cost === 0 ? (
                          <span className="skin-perk-badge perk-none">DEFAULT</span>
                        ) : (
                          <span className="skin-perk-badge perk-speed">RETRO</span>
                        )}
                      </div>

                      <div className="bg-preview" style={{ background: bg.css }} aria-hidden="true">
                        <i className="bg-preview-star" style={{ left: "22%", top: "30%" }} />
                        <i className="bg-preview-star" style={{ left: "68%", top: "18%" }} />
                        <i className="bg-preview-star" style={{ left: "48%", top: "62%" }} />
                      </div>

                      <div className="skin-info">
                        <h3 className="skin-name">{bg.name}</h3>
                        <p className="skin-desc">{bg.tagline}</p>
                      </div>

                      <button
                        type="button"
                        className={`skin-action-btn ${
                          equipped ? "skin-btn-equipped" : unlocked ? "skin-btn-equip" : "skin-btn-buy"
                        }`}
                        onClick={() => handleSelectBackground(bg)}
                      >
                        {equipped ? (
                          "EQUIPPED"
                        ) : unlocked ? (
                          "EQUIP"
                        ) : (
                          <>
                            <ShardGemIcon />
                            <span>{bg.cost} SHARDS</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {hangarTab === "trails" && (
              <div className="skins-grid">
                {NEON_TRAILS.map((trail, idx) => {
                  const unlocked = trail.cost === 0 || unlockedTrails.includes(trail.id);
                  const equipped = equippedTrailId === trail.id;
                  return (
                    <div
                      key={trail.id}
                      className={`skin-card ${equipped ? "skin-card-equipped" : ""}`}
                      style={{ "--skin-color": trail.color } as React.CSSProperties}
                    >
                      <div className="skin-card-top">
                        <span className="skin-index">#{String(idx + 1).padStart(2, "0")}</span>
                        <span className={`skin-rarity-badge rarity-${trail.rarity}`}>
                          {trail.rarity.toUpperCase()}
                        </span>
                      </div>

                      <div className="trail-preview-box" aria-hidden="true">
                        <div className="trail-preview-dots" style={{ "--dot-color": trail.color } as React.CSSProperties}>
                          <span className="trail-dot trail-dot-1" style={{ background: trail.color }} />
                          <span className="trail-dot trail-dot-2" style={{ background: trail.color }} />
                          <span className="trail-dot trail-dot-3" style={{ background: "#ffffff" }} />
                        </div>
                      </div>

                      <div className="skin-info">
                        <h3 className="skin-name">{trail.name}</h3>
                        <p className="skin-desc">{trail.description}</p>
                      </div>

                      <button
                        type="button"
                        className={`skin-action-btn ${
                          equipped ? "skin-btn-equipped" : unlocked ? "skin-btn-equip" : "skin-btn-buy"
                        }`}
                        onClick={() => handleSelectTrail(trail)}
                      >
                        {equipped ? (
                          "EQUIPPED"
                        ) : unlocked ? (
                          "EQUIP"
                        ) : (
                          <>
                            <ShardGemIcon />
                            <span>{trail.cost} SHARDS</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {hangarTab === "ships" && (
            <div className="skins-grid">
              {SHIP_SKINS.map((skin, idx) => {
                const unlocked = skin.perk === "none" || skin.cost === 0 || unlockedSkins.includes(skin.id);
                const equipped = equippedSkinId === skin.id;
                const isDefaultSkin = skin.perk === "none";

                return (
                  <div
                    key={skin.id}
                    className={`skin-card ${equipped ? "skin-card-equipped" : ""} ${unlocked ? "skin-card-unlocked" : ""}`}
                    style={{ "--skin-color": skin.color } as React.CSSProperties}
                  >
                    <div className="skin-card-top">
                      <span className="skin-index">#{String(idx + 1).padStart(2, "0")}</span>
                    </div>

                    <div className="skin-preview-box">
                      <ShipPreviewSvg skin={skin} />
                    </div>

                    <div className="skin-info">
                      <h3 className="skin-name">{skin.name}</h3>
                      <div className="skin-tags-row">
                        <span className={`skin-rarity-badge rarity-${skin.rarity}`}>
                          {getRarityLabel(skin.rarity)}
                        </span>
                        <span
                          className="skin-laser-tag"
                          style={{
                            color: skin.color,
                            borderColor: skin.color,
                            boxShadow: `0 0 8px ${skin.color}40`,
                          }}
                        >
                          <i
                            className="skin-laser-dot"
                            style={{ background: skin.color, boxShadow: `0 0 6px ${skin.color}` }}
                          />
                          LASER
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`skin-action-btn ${
                        equipped ? "skin-btn-equipped" : unlocked ? "skin-btn-equip" : "skin-btn-buy"
                      }`}
                      onClick={() => handleSelectSkin(skin)}
                    >
                      {equipped ? (
                        "EQUIPPED"
                      ) : unlocked ? (
                        "EQUIP"
                      ) : isDefaultSkin ? (
                        "SELECT DEFAULT"
                      ) : (
                        <>
                          <ShardGemIcon />
                          <span>{skin.cost} SHARDS</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
            )}
          </section>
        )}

        {missionsOpen && (
          <section className="screen missions-panel" aria-label="Missions">
            <div className="hangar-header missions-header">
              <div className="hangar-title-wrap">
                <span className="hangar-eyebrow">PILOT MISSIONS · LV {profile.level}</span>
                <h2 className="hangar-title">MISSIONS</h2>
              </div>
              <div className="hangar-header-actions">
                <div className="shard-pill" title={`Shards balance: ${shards}`}>
                  <ShardGemIcon />
                  <span className="shard-count">{shards}</span>
                </div>
                <button type="button" className="hangar-close" onClick={() => setMissionsOpen(false)} aria-label="Close missions">✕</button>
              </div>
            </div>

            <div className="mission-summary">
              <span><b>{profile.missions.filter((m) => m.progress >= m.target && !m.claimed).length}</b> READY</span>
              <span><b>{profile.missions.filter((m) => m.claimed).length}</b>/50 CLAIMED</span>
              <span><b>{shards}</b> SHARDS</span>
            </div>

            <div className="mission-tabs" role="tablist" aria-label="Mission cycle">
              {(["daily", "weekly"] as const).map((tab) => {
                const list = profile.missions.filter((m) => m.cycle === tab);
                const ready = list.filter((m) => m.progress >= m.target && !m.claimed).length;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={missionsTab === tab}
                    className={`mission-tab ${missionsTab === tab ? "mission-tab-on" : ""}`}
                    onClick={() => setMissionsTab(tab)}
                  >
                    <span>{tab.toUpperCase()} 25</span>
                    <small>{ready} READY</small>
                  </button>
                );
              })}
            </div>

            <div className="mission-list">
              <div className="mission-reset-note">
                {missionsTab === "daily" ? "RESETS EVERY UTC DAY" : "RESETS EVERY UTC WEEK"}
              </div>
              {[...profile.missions.filter((m) => m.cycle === missionsTab)].sort((a, b) => Number(b.progress >= b.target && !b.claimed) - Number(a.progress >= a.target && !a.claimed)).map((m, index) => {
                const value = Math.min(m.progress, m.target);
                const pct = Math.min(100, (value / m.target) * 100);
                const ready = value >= m.target && !m.claimed;
                return (
                  <article className={`mission-card ${ready ? "mission-ready" : ""} ${m.claimed ? "mission-claimed" : ""}`} key={m.id}>
                    <div className="mission-card-top">
                      <span className="mission-number">#{String(index + 1).padStart(2, "0")}</span>
                      <h3>{m.title}</h3>
                      <span className="mission-reward"><ShardGemIcon /> +{m.reward}</span>
                    </div>
                    <div className="mission-progress-line">
                      <div className="mission-progress-track"><i style={{ width: `${pct}%` }} /></div>
                      <span>{value.toLocaleString()}/{m.target.toLocaleString()}</span>
                    </div>
                    <button type="button" disabled={!ready} onClick={() => claim(m.id)}>
                      {m.claimed ? "CLAIMED" : ready ? "CLAIM REWARD" : "IN PROGRESS"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {titlesModalOpen && (
          <div className="modal-overlay" onClick={() => setTitlesModalOpen(false)}>
            <div className="titles-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="titles-dialog-header">
                <h3 className="titles-dialog-title">PILOT TITLES (20)</h3>
                <button
                  type="button"
                  className="hangar-close"
                  onClick={() => setTitlesModalOpen(false)}
                >
                  ✕
                </button>
              </div>
              <div className="titles-list">
                {PROGRESSION_TITLES.map((t) => {
                  const unlocked = t.isUnlocked(profile, best);
                  const isCurrent = activeTitleId === t.id;
                  return (
                    <div
                      key={t.id}
                      className={`title-card ${isCurrent ? "title-card-active" : ""} ${!unlocked ? "title-locked" : ""}`}
                      onClick={() => {
                        if (unlocked) {
                          const id = writeActiveTitleId(t.id);
                          setActiveTitleId(id);
                          engineRef.current?.playBuySfx();
                          setNotice(`TITLE EQUIPPED: ${t.name}`);
                          setTitlesModalOpen(false);
                        }
                      }}
                    >
                      <div className="title-card-left">
                        <span className="title-card-name">{t.name}</span>
                        <span className="title-card-req">{t.requirement}</span>
                      </div>
                      <span className={`title-card-badge ${isCurrent ? "rarity-legendary" : unlocked ? "rarity-common" : "title-locked"}`}>
                        {isCurrent ? "ACTIVE" : unlocked ? "EQUIP" : "LOCKED"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {nameEditorOpen && (
          <div className="modal-overlay" onClick={() => setNameEditorOpen(false)}>
            <div className="name-editor-dialog" onClick={(e) => e.stopPropagation()}>
              <h3 className="titles-dialog-title">EDIT PILOT CALLSIGN</h3>
              <input
                type="text"
                className="name-editor-input"
                maxLength={16}
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="CALLSIGN (MAX 16)"
                autoFocus
              />
              <div className="btn-stack" style={{ marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ height: 42, padding: "8px 16px" }}
                  onClick={() => {
                    const saved = writePilotName(tempName);
                    setPilotName(saved);
                    setNameEditorOpen(false);
                    setNotice(`CALLSIGN UPDATED: ${saved}`);
                  }}
                >
                  CONFIRM
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ height: 38, padding: "6px 12px" }}
                  onClick={() => setNameEditorOpen(false)}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}

        {playStorePromptPack && (
          <div className="modal-overlay" onClick={() => setPlayStorePromptPack(null)}>
            <div className="titles-dialog" onClick={(e) => e.stopPropagation()} style={{ width: "min(320px, 92vw)" }}>
              <div className="titles-dialog-header">
                <h3 className="titles-dialog-title">GOOGLE PLAY CHECKOUT</h3>
                <button type="button" className="hangar-close" onClick={() => setPlayStorePromptPack(null)} aria-label="Close dialog">✕</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(34, 230, 255, 0.1)", borderRadius: 10, border: "1px solid rgba(34, 230, 255, 0.35)" }}>
                  <ShardGemIcon />
                  <div>
                    <div style={{ color: "#ffffff", fontSize: 13, fontWeight: 900, letterSpacing: "0.06em" }}>{playStorePromptPack.shards} SHARDS</div>
                    <div style={{ fontSize: 10, color: "var(--cyan)", fontWeight: 800 }}>$${playStorePromptPack.priceUsd.toFixed(2)} · PLAY STORE</div>
                  </div>
                </div>
                <p style={{ margin: 0, lineHeight: 1.45, color: "rgba(190, 205, 240, 0.85)", fontSize: 10.5, letterSpacing: "0.02em" }}>
                  Google Play Billing requires the official app installed from Google Play on Android. In a web browser, open Strike Neon from the Play Store to complete purchases with your Google account.
                </p>
                <div className="btn-stack" style={{ marginTop: 2 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: "100%", height: 44, minHeight: 44, padding: "6px 14px", fontSize: 11.5 }}
                    onClick={() => {
                      openPlayStoreListing();
                      setPlayStorePromptPack(null);
                    }}
                  >
                    OPEN PLAY STORE
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ width: "100%", height: 38, minHeight: 38, padding: "6px 12px", fontSize: 11 }}
                    onClick={() => setPlayStorePromptPack(null)}
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {briefingOpen && (
          <div className="modal-overlay" onClick={() => setBriefingOpen(false)}>
            <div className="briefing-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="briefing-header">
                <div className="briefing-title-wrap">
                  <span className="briefing-eyebrow">TACTICAL INTEL · POWER-UPS</span>
                  <h3 className="briefing-title">COMBAT BRIEFING</h3>
                </div>
                <button
                  type="button"
                  className="hangar-close"
                  onClick={() => setBriefingOpen(false)}
                  aria-label="Close briefing"
                >
                  ✕
                </button>
              </div>

              <p className="briefing-desc">
                Collect floating power-up energy cores during combat:
              </p>

              <div className="briefing-list">
                {LEGEND.map((item) => (
                  <div key={item.glyph} className={`briefing-item tone-${item.tone}`}>
                    <i className="briefing-hex">{item.glyph}</i>
                    <div className="briefing-item-info">
                      <span className="briefing-item-name">{item.label}</span>
                      <span className="briefing-item-desc">{item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="briefing-controls-hint">
                <span>CONTROLS: WASD / TOUCH TO MOVE · AUTO-FIRE</span>
              </div>

              <div className="briefing-actions">
                <button
                  type="button"
                  className="btn btn-primary briefing-start-btn"
                  onClick={start}
                  autoFocus
                >
                  <span className="btn-row">
                    <PlayMenuIcon />
                    START MISSION
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {settingsOpen && (
          <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
            <div className="settings-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="settings-title">
              <div className="settings-header">
                <div className="settings-title-wrap">
                  <span className="settings-eyebrow">SYSTEM CONFIGURATION</span>
                  <h3 id="settings-title" className="settings-title">SETTINGS</h3>
                </div>
                <button
                  type="button"
                  className="hangar-close"
                  onClick={() => setSettingsOpen(false)}
                  aria-label="Close Settings"
                >
                  ✕
                </button>
              </div>

              <div className="settings-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={settingsTab === "audio"}
                  className={`settings-tab ${settingsTab === "audio" ? "settings-tab-on" : ""}`}
                  onClick={() => setSettingsTab("audio")}
                >
                  AUDIO
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={settingsTab === "gameplay"}
                  className={`settings-tab ${settingsTab === "gameplay" ? "settings-tab-on" : ""}`}
                  onClick={() => setSettingsTab("gameplay")}
                >
                  CONTROLS & DISPLAY
                </button>
              </div>

              <div className="settings-body">
                {settingsTab === "audio" ? (
                  <>
                    {typeof window !== "undefined" &&
                      typeof window.StrikeNeonNative?.showPrivacyOptionsForm === "function" &&
                      window.StrikeNeonNative.isPrivacyOptionsRequired?.() === true && (
                      <div className="settings-card">
                        <div className="settings-card-head">
                          <div className="settings-card-info">
                            <span className="settings-card-title">Ad Privacy Options</span>
                            <span className="settings-card-sub">Review or change your advertising consent choices</span>
                          </div>
                          <button
                            type="button"
                            className="settings-switch-btn settings-switch-on"
                            onClick={() => window.StrikeNeonNative?.showPrivacyOptionsForm?.()}
                          >
                            PRIVACY
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Master Audio */}
                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div className="settings-card-info">
                          <span className="settings-card-title">
                            <SoundIcon muted={muted} />
                            Master Sound
                          </span>
                          <span className="settings-card-sub">Enable or mute all game sound</span>
                        </div>
                        <button
                          type="button"
                          className={`settings-switch-btn ${!muted ? "settings-switch-on" : "settings-switch-off"}`}
                          onClick={toggleMute}
                          aria-label={!muted ? "Mute all audio" : "Unmute all audio"}
                        >
                          {!muted ? "ON" : "MUTED"}
                        </button>
                      </div>
                    </div>



                    {/* Sound Effects SFX */}
                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div className="settings-card-info">
                          <span className="settings-card-title">
                            <SoundIcon muted={sfxMuted} />
                            Sound Effects (SFX)
                          </span>
                          <span className="settings-card-sub">Lasers, explosions, shields & alerts</span>
                        </div>
                        <button
                          type="button"
                          className={`settings-switch-btn ${!sfxMuted ? "settings-switch-on" : "settings-switch-off"}`}
                          onClick={toggleSfxMute}
                          aria-label={!sfxMuted ? "Mute sound effects" : "Unmute sound effects"}
                        >
                          {!sfxMuted ? "ON" : "OFF"}
                        </button>
                      </div>
                      <div className="settings-slider-row">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={sfxMuted ? 0 : sfxVolume}
                          disabled={sfxMuted}
                          onChange={(e) => changeSfxVolume(Number(e.target.value))}
                          className="settings-slider"
                          aria-label="Sound effects volume"
                        />
                        <span className="settings-slider-val">
                          {sfxMuted ? "OFF" : `${Math.round(sfxVolume * 100)}%`}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="settings-test-btn"
                        onClick={handleTestSfx}
                      >
                        ⚡ TEST SOUND
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Controls & Display */}
                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div className="settings-card-info">
                          <span className="settings-card-title">Touch Sensitivity</span>
                          <span className="settings-card-sub">Ship drag response speed</span>
                        </div>
                        <span className="settings-slider-val">{profile.settings.sensitivity.toFixed(1)}x</span>
                      </div>
                      <div className="settings-slider-row">
                        <input
                          type="range"
                          min="0.5"
                          max="2.5"
                          step="0.1"
                          value={profile.settings.sensitivity}
                          onChange={(e) => updateGameSetting("sensitivity", Number(e.target.value))}
                          className="settings-slider"
                          aria-label="Touch sensitivity"
                        />
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div className="settings-card-info">
                          <span className="settings-card-title">Ability Dock Side</span>
                          <span className="settings-card-sub">Combat ability buttons layout</span>
                        </div>
                        <div className="settings-choice-group">
                          <button
                            type="button"
                            className={`settings-choice-btn ${profile.settings.abilitySide === "left" ? "settings-choice-on" : ""}`}
                            onClick={() => updateGameSetting("abilitySide", "left")}
                          >
                            LEFT
                          </button>
                          <button
                            type="button"
                            className={`settings-choice-btn ${profile.settings.abilitySide === "right" ? "settings-choice-on" : ""}`}
                            onClick={() => updateGameSetting("abilitySide", "right")}
                          >
                            RIGHT
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div className="settings-card-info">
                          <span className="settings-card-title">Button Scale</span>
                          <span className="settings-card-sub">Size of in-game ability dock</span>
                        </div>
                        <div className="settings-choice-group">
                          {[
                            { label: "1.0x", val: 1 },
                            { label: "1.15x", val: 1.15 },
                            { label: "1.3x", val: 1.3 },
                          ].map((opt) => (
                            <button
                              key={opt.label}
                              type="button"
                              className={`settings-choice-btn ${Math.abs(profile.settings.buttonScale - opt.val) < 0.05 ? "settings-choice-on" : ""}`}
                              onClick={() => updateGameSetting("buttonScale", opt.val)}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div className="settings-card-info">
                          <span className="settings-card-title">Screen Shake</span>
                          <span className="settings-card-sub">Impact & explosion vibrations</span>
                        </div>
                        <button
                          type="button"
                          className={`settings-switch-btn ${profile.settings.screenShake > 0 ? "settings-switch-on" : "settings-switch-off"}`}
                          onClick={() => updateGameSetting("screenShake", profile.settings.screenShake > 0 ? 0 : 1)}
                        >
                          {profile.settings.screenShake > 0 ? "ON" : "OFF"}
                        </button>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div className="settings-card-info">
                          <span className="settings-card-title">Floating Damage</span>
                          <span className="settings-card-sub">Show hit points dealt above targets</span>
                        </div>
                        <button
                          type="button"
                          className={`settings-switch-btn ${profile.settings.damageNumbers ? "settings-switch-on" : "settings-switch-off"}`}
                          onClick={() => updateGameSetting("damageNumbers", !profile.settings.damageNumbers)}
                        >
                          {profile.settings.damageNumbers ? "ON" : "OFF"}
                        </button>
                      </div>
                    </div>

                    <div className="settings-card">
                      <div className="settings-card-head">
                        <div className="settings-card-info">
                          <span className="settings-card-title">Second Finger Bomb</span>
                          <span className="settings-card-sub">Tap with 2nd finger anywhere to fire EMP</span>
                        </div>
                        <button
                          type="button"
                          className={`settings-switch-btn ${profile.settings.secondFingerBomb ? "settings-switch-on" : "settings-switch-off"}`}
                          onClick={() => updateGameSetting("secondFingerBomb", !profile.settings.secondFingerBomb)}
                        >
                          {profile.settings.secondFingerBomb ? "ON" : "OFF"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="settings-actions">
                <button
                  type="button"
                  className="btn btn-primary settings-close-btn"
                  onClick={() => setSettingsOpen(false)}
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      <div className="ad-banner" ref={bannerRef} aria-hidden="true" />
    </main>
  );
}
