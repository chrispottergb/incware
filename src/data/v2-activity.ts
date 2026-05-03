import type { LucideIcon } from "lucide-react";
import { FileCheck2, Upload, AlertTriangle, UserPlus } from "lucide-react";

export interface ActivityItem {
  id: string;
  icon: LucideIcon;
  body: string;
  meta: string;
  tone: "neutral" | "warn" | "success";
}

export const v2Activity: ActivityItem[] = [
  { id: "a1", icon: FileCheck2, body: "ABC, LLC Annual Report filed (WI DFI)", meta: "2h ago · by you", tone: "success" },
  { id: "a2", icon: Upload, body: "Greystone Logistics — 14 documents imported", meta: "4h ago · Import bot", tone: "neutral" },
  { id: "a3", icon: AlertTriangle, body: "Cedar & Stone Co. flagged overdue Form 5", meta: "yesterday", tone: "warn" },
  { id: "a4", icon: UserPlus, body: "Harborlight Trust added to portfolio", meta: "2d ago", tone: "neutral" },
];
