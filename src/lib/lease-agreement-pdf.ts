import jsPDF from "jspdf";
import { savePdfReliably } from "./pdf-save";
import { registerArialFont } from "@/lib/arial-font";

interface LeaseData {
  landlordName: string;
  landlordAddress: string;
  tenantName: string;
  tenantAddress: string;
  propertyAddress: string;
  leaseStartDate: string;
  leaseEndDate: string;
  monthlyRent: string;
  leaseTerm: string;
  securityDeposit: string;
  purpose: string;
}

function fmtDate(d: string) {
  if (!d) return "_______________";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function fmtCurrency(v: string) {
  if (!v) return "_______________";
  return `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export function generateLeaseAgreementPdf(data: LeaseData): jsPDF {
  const doc = new jsPDF();
  registerArialFont(doc);
  const pw = doc.internal.pageSize.getWidth();
  const margin = 25.4; // 1 inch for binder compatibility
  const maxW = pw - margin * 2;
  let y = 20;

  const addText = (text: string, opts?: { bold?: boolean; size?: number; center?: boolean; indent?: number }) => {
    const sz = opts?.size || 10;
    doc.setFontSize(sz);
    doc.setFont("Arial", opts?.bold ? "bold" : "normal");
    doc.setTextColor(30, 30, 30);
    const x = opts?.indent ? margin + opts.indent : margin;
    const w = maxW - (opts?.indent || 0);
    if (opts?.center) {
      doc.text(text, pw / 2, y, { align: "center" });
      y += sz * 0.5;
    } else {
      const lines = doc.splitTextToSize(text, w);
      doc.text(lines, x, y);
      y += lines.length * (sz * 0.45) + 2;
    }
    if (y > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = 20;
    }
  };

  const gap = (n = 4) => { y += n; };

  // Title
  addText("LEASE AGREEMENT", { bold: true, size: 16, center: true });
  gap(6);

  // Parties
  addText(`This Lease Agreement ("Agreement") is made and entered into as of ${fmtDate(data.leaseStartDate)}, by and between:`, { size: 10 });
  gap(2);
  addText(`LANDLORD: ${data.landlordName || "_______________"}`, { bold: true, indent: 10 });
  addText(`Address: ${data.landlordAddress || "_______________"}`, { indent: 10 });
  gap(2);
  addText(`TENANT: ${data.tenantName || "_______________"}`, { bold: true, indent: 10 });
  addText(`Address: ${data.tenantAddress || "_______________"}`, { indent: 10 });
  gap(4);

  // 1. Premises
  addText("1. PREMISES", { bold: true, size: 11 });
  addText(`Landlord hereby leases to Tenant, and Tenant hereby leases from Landlord, the property located at: ${data.propertyAddress || "_______________"} (the "Premises").`);
  gap();

  // 2. Term
  addText("2. TERM", { bold: true, size: 11 });
  addText(`The lease term shall commence on ${fmtDate(data.leaseStartDate)} and shall terminate on ${fmtDate(data.leaseEndDate)}${data.leaseTerm ? ` (a term of ${data.leaseTerm})` : ""}, unless sooner terminated or renewed in accordance with the terms of this Agreement.`);
  gap();

  // 3. Rent
  addText("3. RENT", { bold: true, size: 11 });
  addText(`Tenant shall pay Landlord a monthly rent of ${fmtCurrency(data.monthlyRent)}, due on the first day of each calendar month during the term. Rent shall be payable to Landlord at the address set forth above, or at such other place as Landlord may designate in writing.`);
  gap();

  // 4. Security Deposit
  addText("4. SECURITY DEPOSIT", { bold: true, size: 11 });
  if (data.securityDeposit) {
    addText(`Upon execution of this Agreement, Tenant shall deposit with Landlord the sum of ${fmtCurrency(data.securityDeposit)} as a security deposit. The deposit shall be returned to Tenant within thirty (30) days after termination of the lease and surrender of the Premises, less any amounts lawfully withheld for damages or unpaid rent.`);
  } else {
    addText("No security deposit is required under this Agreement.");
  }
  gap();

  // 5. Use
  addText("5. USE OF PREMISES", { bold: true, size: 11 });
  addText(`The Premises shall be used and occupied by Tenant exclusively for ${data.purpose || "business operations"} and for no other purpose without the prior written consent of Landlord.`);
  gap();

  // 6. Maintenance
  addText("6. MAINTENANCE AND REPAIRS", { bold: true, size: 11 });
  addText("Tenant shall maintain the Premises in good, clean, and habitable condition during the term of this lease. Tenant shall be responsible for all minor repairs and routine maintenance. Landlord shall be responsible for structural repairs and major systems (roof, foundation, HVAC, plumbing, and electrical) unless damage is caused by Tenant's negligence.");
  gap();

  // 7. Utilities
  addText("7. UTILITIES", { bold: true, size: 11 });
  addText("Unless otherwise agreed in writing, Tenant shall be responsible for the payment of all utilities and services furnished to the Premises, including but not limited to electricity, gas, water, sewer, telephone, internet, and trash removal.");
  gap();

  // 8. Insurance
  addText("8. INSURANCE", { bold: true, size: 11 });
  addText("Tenant shall, at Tenant's own expense, maintain appropriate liability and property insurance covering the Premises during the term. Landlord shall maintain insurance on the structure and building. Each party shall provide proof of insurance to the other upon request.");
  gap();

  // 9. Alterations
  addText("9. ALTERATIONS", { bold: true, size: 11 });
  addText("Tenant shall not make any alterations, additions, or improvements to the Premises without the prior written consent of Landlord. Any approved alterations shall become the property of Landlord upon termination of this lease, unless otherwise agreed in writing.");
  gap();

  // 10. Assignment / Subletting
  addText("10. ASSIGNMENT AND SUBLETTING", { bold: true, size: 11 });
  addText("Tenant shall not assign this Agreement or sublet the Premises, or any part thereof, without the prior written consent of Landlord.");
  gap();

  // 11. Default
  addText("11. DEFAULT", { bold: true, size: 11 });
  addText("If Tenant fails to pay rent within ten (10) days of the due date, or fails to perform any other obligation under this Agreement within thirty (30) days after written notice from Landlord, Landlord may, at Landlord's option, terminate this Agreement and pursue all available legal remedies, including recovery of all unpaid rent and damages.");
  gap();

  // 12. Renewal
  addText("12. RENEWAL", { bold: true, size: 11 });
  addText("This Agreement may be renewed for additional terms upon mutual written agreement of both parties. Either party shall provide at least thirty (30) days written notice prior to the expiration of the current term of their intent to renew or not renew.");
  gap();

  // 13. Notices
  addText("13. NOTICES", { bold: true, size: 11 });
  addText("All notices required or permitted under this Agreement shall be in writing and shall be deemed delivered when personally delivered, or three (3) business days after being sent by certified mail, return receipt requested, to the addresses set forth above.");
  gap();

  // 14. Governing Law
  addText("14. GOVERNING LAW", { bold: true, size: 11 });
  addText("This Agreement shall be governed by and construed in accordance with the laws of the state in which the Premises are located.");
  gap();

  // 15. Entire Agreement
  addText("15. ENTIRE AGREEMENT", { bold: true, size: 11 });
  addText("This Agreement constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, or agreements. This Agreement may only be modified by a written instrument signed by both parties.");
  gap();

  // 16. Severability
  addText("16. SEVERABILITY", { bold: true, size: 11 });
  addText("If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.");
  gap(8);

  // Signatures
  addText("IN WITNESS WHEREOF, the parties have executed this Lease Agreement as of the date first written above.", { size: 10 });
  gap(10);

  // Landlord sig
  addText("LANDLORD:", { bold: true });
  gap(8);
  doc.setDrawColor(100);
  doc.line(margin, y, margin + 80, y);
  y += 4;
  addText(`Name: ${data.landlordName || "_______________"}`, { size: 9 });
  addText("Date: _______________", { size: 9 });
  gap(8);

  // Tenant sig
  addText("TENANT:", { bold: true });
  gap(8);
  doc.line(margin, y, margin + 80, y);
  y += 4;
  addText(`Name: ${data.tenantName || "_______________"}`, { size: 9 });
  addText("Date: _______________", { size: 9 });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text("EntityIQ — Confidential", margin, ph - 8);
    doc.text(`Page ${i} of ${pageCount}`, pw - margin, ph - 8, { align: "right" });
  }

  return doc;
}

export async function downloadLeaseAgreement(data: LeaseData) {
  const doc = generateLeaseAgreementPdf(data);
  await savePdfReliably(doc, "lease-agreement.pdf");
}

export function previewLeaseAgreement(data: LeaseData) {
  const doc = generateLeaseAgreementPdf(data);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;";
  const container = document.createElement("div");
  container.style.cssText = "width:90vw;height:90vh;max-width:900px;background:#fff;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;";
  const toolbar = document.createElement("div");
  toolbar.style.cssText = "display:flex;justify-content:flex-end;padding:8px 12px;background:#f3f4f6;border-bottom:1px solid #e5e7eb;";
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕ Close";
  closeBtn.style.cssText = "padding:4px 12px;border:1px solid #d1d5db;border-radius:4px;background:#fff;cursor:pointer;font-size:13px;";
  closeBtn.onclick = () => { document.body.removeChild(overlay); URL.revokeObjectURL(url); };
  toolbar.appendChild(closeBtn);
  const iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.style.cssText = "flex:1;border:0;width:100%;";
  container.appendChild(toolbar);
  container.appendChild(iframe);
  overlay.appendChild(container);
  overlay.onclick = (e) => { if (e.target === overlay) { document.body.removeChild(overlay); URL.revokeObjectURL(url); } };
  document.body.appendChild(overlay);
}
