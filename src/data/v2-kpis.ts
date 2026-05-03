export interface Kpi {
  id: string;
  testId: string;
  label: string;
  value: string;
  delta: string;
  deltaTone: "up" | "down" | "warn";
  spark: number[];
  sparkTone: "brand" | "success" | "warn" | "danger";
  valueTone?: "danger";
  sub?: string;
}

export const v2Kpis: Kpi[] = [
  { id: "active", testId: "kpi-active-entities", label: "Active entities", value: "34", delta: "+3 this quarter", deltaTone: "up", spark: [22, 24, 25, 27, 28, 30, 31, 33, 34], sparkTone: "brand" },
  { id: "ontime", testId: "kpi-ontime-filings", label: "On-time filings", value: "94%", delta: "+2.1% vs. last qtr", deltaTone: "up", spark: [88, 89, 91, 90, 92, 93, 92, 94, 94], sparkTone: "success" },
  { id: "due30", testId: "kpi-due-30", label: "Due next 30 days", value: "9", delta: "+4 from last week", deltaTone: "warn", spark: [3, 4, 5, 5, 6, 7, 8, 8, 9], sparkTone: "warn" },
  { id: "overdue", testId: "kpi-overdue", label: "Overdue", value: "1", delta: "Cedar & Stone Co.", deltaTone: "warn", spark: [0, 0, 1, 0, 0, 1, 0, 1, 1], sparkTone: "danger", valueTone: "danger" },
];
