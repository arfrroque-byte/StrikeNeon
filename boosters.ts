export interface ShardBoosterState {
  multiplier: number;
  expiresAt: number | null; // Unix timestamp ms, or null if run-based
  runsRemaining: number | null; // number of runs, or null if time-based
  label: string;
}

export const BOOSTER_KEY = "strike-neon:booster-state";

export function readBoosterState(): ShardBoosterState {
  try {
    const raw = localStorage.getItem(BOOSTER_KEY);
    if (!raw) return { multiplier: 1, expiresAt: null, runsRemaining: null, label: "NONE" };
    const parsed = JSON.parse(raw) as ShardBoosterState;
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      const reset: ShardBoosterState = { multiplier: 1, expiresAt: null, runsRemaining: null, label: "NONE" };
      writeBoosterState(reset);
      return reset;
    }
    if (parsed.runsRemaining !== null && parsed.runsRemaining <= 0) {
      const reset: ShardBoosterState = { multiplier: 1, expiresAt: null, runsRemaining: null, label: "NONE" };
      writeBoosterState(reset);
      return reset;
    }
    return parsed;
  } catch {
    return { multiplier: 1, expiresAt: null, runsRemaining: null, label: "NONE" };
  }
}

export function writeBoosterState(state: ShardBoosterState): ShardBoosterState {
  try {
    localStorage.setItem(BOOSTER_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  return state;
}

export function activateTimeBooster(durationMinutes: number = 15, multiplier: number = 2): ShardBoosterState {
  const current = readBoosterState();
  const baseTime = current.expiresAt && current.expiresAt > Date.now() ? current.expiresAt : Date.now();
  const next: ShardBoosterState = {
    multiplier,
    expiresAt: baseTime + durationMinutes * 60 * 1000,
    runsRemaining: null,
    label: `${multiplier}X SHARDS (${durationMinutes}M)`,
  };
  return writeBoosterState(next);
}

export function activateRunBooster(runs: number = 3, multiplier: number = 2): ShardBoosterState {
  const current = readBoosterState();
  const currentRuns = current.runsRemaining && current.runsRemaining > 0 ? current.runsRemaining : 0;
  const next: ShardBoosterState = {
    multiplier,
    expiresAt: null,
    runsRemaining: currentRuns + runs,
    label: `${multiplier}X SHARDS (${currentRuns + runs} RUNS)`,
  };
  return writeBoosterState(next);
}

export function consumeBoosterRun(): ShardBoosterState {
  const state = readBoosterState();
  if (state.runsRemaining !== null && state.runsRemaining > 0) {
    const next: ShardBoosterState = {
      ...state,
      runsRemaining: state.runsRemaining - 1,
      multiplier: state.runsRemaining - 1 > 0 ? state.multiplier : 1,
      label: state.runsRemaining - 1 > 0 ? `${state.multiplier}X SHARDS (${state.runsRemaining - 1} RUNS)` : "NONE",
    };
    return writeBoosterState(next);
  }
  return state;
}

export function getActiveShardMultiplier(): number {
  const state = readBoosterState();
  return state.multiplier > 1 ? state.multiplier : 1;
}

export function getBoosterDisplayInfo(): { active: boolean; text: string; details: string } {
  const state = readBoosterState();
  if (state.multiplier <= 1) {
    return { active: false, text: "NO BOOSTER", details: "Boosters multiply all shard rewards" };
  }
  if (state.expiresAt) {
    const leftMs = Math.max(0, state.expiresAt - Date.now());
    const mins = Math.floor(leftMs / 60000);
    const secs = Math.floor((leftMs % 60000) / 1000);
    return {
      active: true,
      text: `${state.multiplier}X ACTIVE`,
      details: `${mins}m ${secs < 10 ? "0" : ""}${secs}s remaining`,
    };
  }
  if (state.runsRemaining !== null && state.runsRemaining > 0) {
    return {
      active: true,
      text: `${state.multiplier}X ACTIVE`,
      details: `${state.runsRemaining} run${state.runsRemaining > 1 ? "s" : ""} remaining`,
    };
  }
  return { active: false, text: "NO BOOSTER", details: "" };
}
