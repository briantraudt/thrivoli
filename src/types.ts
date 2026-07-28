export type Tone = "positive" | "attention" | "warning" | "error" | "info" | "neutral";

export interface Metric {
  label: string;
  value: string;
  detail: string;
  tone?: Tone;
}

export interface ScreenDefinition {
  id: string;
  path: string;
  title: string;
  eyebrow: string;
  action: string;
  metrics: Metric[];
  columns: string[];
  rows: string[][];
  insight: string;
}
