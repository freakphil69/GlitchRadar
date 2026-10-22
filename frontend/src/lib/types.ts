export type GlitchType = "price_error" | "coupon" | "cashback" | "shipping" | "stack";
export type RiskLevel = "low" | "medium" | "high";

export interface Glitch {
  id: string;
  type: GlitchType;
  title: string;
  shop: string;
  category: string;
  description: string;
  why_it_works: string;
  original_price: number;
  glitched_price: number;
  currency: string;
  discount_pct: number;
  coupon_code: string | null;
  url: string | null;
  affiliate_url: string | null;
  risk_level: RiskLevel;
  risk_note: string;
  risk_analysis: string | null;
  success_rate: number;
  source_label: string;
  scout_model: string;
  status: "active" | "expired";
  enriched: boolean;
  instructions: string[];
  tips: string[];
  time_window_note: string | null;
  expires_at: string;
  created_at: string;
}

export interface Scan {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "done" | "failed";
  model_primary: string;
  model_scorer: string;
  found_count: number;
  total_savings: number;
  error: string | null;
}

export interface Stats {
  active_count: number;
  expired_count: number;
  total_found: number;
  total_savings_potential: number;
  avg_discount: number;
  by_type: Record<string, number>;
  last_scan: Scan | null;
}

export interface ScanResult {
  scan: Scan | null;
  glitches: Glitch[];
}

export const TYPE_LABELS: Record<GlitchType, string> = {
  price_error: "PREISFEHLER",
  coupon: "GUTSCHEIN",
  cashback: "CASHBACK",
  shipping: "VERSAND",
  stack: "STAPELBAR",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "GERING",
  medium: "MITTEL",
  high: "HOCH",
};
