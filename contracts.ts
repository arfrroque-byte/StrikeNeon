export const PRODUCT_SHARDS: Record<string, number> = {
  shards_500: 500,
  shards_1000: 1000,
  shards_2500: 2500,
  shards_weekly_090: 1000,
};

export interface VerifyPurchaseRequest {
  productId: keyof typeof PRODUCT_SHARDS;
  purchaseToken: string;
  playerId: string;
}

export interface ScoreSubmission {
  playerId: string;
  score: number;
  wave: number;
  difficulty: "normal" | "hard" | "nightmare";
  kills: number;
  durationSeconds: number;
  signedRunToken: string;
}