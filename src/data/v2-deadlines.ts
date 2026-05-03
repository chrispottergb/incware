export interface Deadline {
  id: string;
  month: string;
  day: number;
  title: string;
  form: string;
  entity: string;
  type: string;
  state: string;
  status: "overdue" | "due-soon" | "later";
  statusLabel: string;
  cta: string;
}

export const v2Deadlines: Deadline[] = [
  { id: "d1", month: "Jan", day: 8, title: "Annual Report", form: "Form 5", entity: "Cedar & Stone Co.", type: "Corporation", state: "WI", status: "overdue", statusLabel: "Overdue 3d", cta: "File now" },
  { id: "d2", month: "Jan", day: 14, title: "Quarterly Tax Filing", form: "Form 941", entity: "Acme Holdings", type: "S-Corp", state: "IL", status: "due-soon", statusLabel: "Due in 3d", cta: "Prepare" },
  { id: "d3", month: "Jan", day: 17, title: "Biennial Statement", form: "", entity: "Foxglove Studios", type: "S-Corp", state: "WI", status: "later", statusLabel: "Due in 6d", cta: "Prepare" },
  { id: "d4", month: "Jan", day: 21, title: "Annual Report", form: "", entity: "Birchwood Capital", type: "LLC", state: "MN", status: "later", statusLabel: "Due in 10d", cta: "View" },
  { id: "d5", month: "Jan", day: 25, title: "Registered Agent Renewal", form: "", entity: "Delta Ventures", type: "LLC", state: "IL", status: "later", statusLabel: "Due in 14d", cta: "View" },
];
