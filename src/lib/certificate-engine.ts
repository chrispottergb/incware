/**
 * Certificate-Numbering Logic Module v2
 * ======================================
 * Implements a certificate-per-transaction model with C-### numbering.
 * Each certificate is an immutable container for a specific block of units
 * in a single class.
 *
 * Rules:
 *  - Certificate numbers start at C-001 per entity and never reuse.
 *  - Every transfer, redemption, reclassification, restructure, consolidation,
 *    or split surrenders the source cert(s) and issues new cert(s).
 *  - Certificates are single-class only.
 *  - Voided/surrendered certificates retain their number permanently.
 *  - Output is deterministic and auditable.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CertificateStatus = "active" | "surrendered" | "voided";

export type CertEventType =
  | "initial_issuance"
  | "transfer_issue"
  | "remainder_issue"
  | "surrender"
  | "redemption_surrender"
  | "reclassification_surrender"
  | "reclassification_issue"
  | "restructure_surrender"
  | "restructure_issue"
  | "consolidation_surrender"
  | "consolidation_issue"
  | "split_surrender"
  | "split_issue";

export interface Certificate {
  /** Formatted as C-### */
  certNumber: string;
  /** Raw sequential integer (1-based) */
  seq: number;
  holderId: string;
  holderName: string;
  unitClass: string;
  units: number;
  status: CertificateStatus;
  issueDate: string;
  surrenderDate: string | null;
  /** ID of the transfer event that created or surrendered this cert */
  linkedEventId: string | null;
}

export interface CertificateEvent {
  eventId: string;
  eventType: CertEventType;
  date: string;
  certNumber: string;
  holderId: string;
  holderName: string;
  unitClass: string;
  units: number;
  /** For transfers: the counterpart cert number */
  relatedCertNumber: string | null;
  notes: string;
}

/** Structured JSON output for any certificate action — auditable envelope */
export interface TransferRecord {
  transferId: string;
  eventType: string;
  effectiveDate: string;
  metadata: {
    reason: string;
    consideration: string | null;
    statute: string | null;
  };
  surrendered: Array<{
    certNumber: string;
    holder: string;
    unitClass: string;
    units: number;
  }>;
  issued: Array<{
    certNumber: string;
    holder: string;
    unitClass: string;
    units: number;
    purpose: "transferee" | "remainder" | "reclass" | "restructure" | "consolidation" | "split" | "issuance";
  }>;
}

export interface CertificateActionResult {
  events: CertificateEvent[];
  certificates: Certificate[];
  /** Structured audit record ready for ledger / cap-table export */
  record: TransferRecord;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface IssuanceInput {
  eventId: string;
  date: string;
  holderId: string;
  holderName: string;
  unitClass: string;
  units: number;
  consideration?: string | null;
  statute?: string | null;
  notes?: string;
}

export interface TransferInput {
  eventId: string;
  date: string;
  fromHolderId: string;
  fromHolderName: string;
  toHolderId: string;
  toHolderName: string;
  unitClass: string;
  units: number;
  sourceCertNumber?: string;
  consideration?: string | null;
  statute?: string | null;
  notes?: string;
}

export interface RedemptionInput {
  eventId: string;
  date: string;
  holderId: string;
  holderName: string;
  unitClass: string;
  units: number;
  sourceCertNumber?: string;
  consideration?: string | null;
  statute?: string | null;
  notes?: string;
}

export interface ReclassificationInput {
  eventId: string;
  date: string;
  holderId: string;
  holderName: string;
  fromClass: string;
  toClass: string;
  units: number;
  sourceCertNumber?: string;
  statute?: string | null;
  notes?: string;
}

export interface RestructureInput {
  eventId: string;
  date: string;
  /** Original holder whose cert(s) are surrendered */
  fromHolderId: string;
  fromHolderName: string;
  /** New holder entity (e.g. a trust, new LLC) */
  toHolderId: string;
  toHolderName: string;
  /** Classes to restructure. All active certs for these classes are surrendered */
  classes: string[];
  reason: string;
  statute?: string | null;
  notes?: string;
}

export interface ConsolidationInput {
  eventId: string;
  date: string;
  holderId: string;
  holderName: string;
  unitClass: string;
  /** Specific cert numbers to consolidate. If omitted, all active certs for holder+class */
  certNumbers?: string[];
  statute?: string | null;
  notes?: string;
}

export interface SplitInput {
  eventId: string;
  date: string;
  holderId: string;
  holderName: string;
  unitClass: string;
  sourceCertNumber?: string;
  /** Array of unit amounts for the resulting certs. Must sum to source cert units. */
  splitAmounts: number[];
  statute?: string | null;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatCertNumber(seq: number): string {
  return `C-${String(seq).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class CertificateEngine {
  private nextSeq = 1;
  private certificates: Certificate[] = [];
  private events: CertificateEvent[] = [];

  constructor(existingCerts?: Certificate[], highestSeq?: number) {
    if (existingCerts) {
      this.certificates = [...existingCerts];
    }
    if (highestSeq != null) {
      this.nextSeq = highestSeq + 1;
    } else if (existingCerts && existingCerts.length > 0) {
      this.nextSeq = Math.max(...existingCerts.map((c) => c.seq)) + 1;
    }
  }

  // ---- Queries ----

  getCertificates(): Certificate[] {
    return [...this.certificates];
  }

  getActiveCertificates(): Certificate[] {
    return this.certificates.filter((c) => c.status === "active");
  }

  getEvents(): CertificateEvent[] {
    return [...this.events];
  }

  findActiveCert(holderId: string, unitClass: string): Certificate | null {
    return (
      this.certificates.find(
        (c) => c.holderId === holderId && c.unitClass === unitClass && c.status === "active"
      ) ?? null
    );
  }

  findAllActiveCerts(holderId: string, unitClass: string): Certificate[] {
    return this.certificates.filter(
      (c) => c.holderId === holderId && c.unitClass === unitClass && c.status === "active"
    );
  }

  findCertByNumber(certNumber: string): Certificate | null {
    return this.certificates.find((c) => c.certNumber === certNumber) ?? null;
  }

  // ---- Mutations ----

  /** Issue a brand-new certificate (initial issuance). */
  issueInitial(input: IssuanceInput): CertificateActionResult {
    const cert = this.mintCert({
      holderId: input.holderId,
      holderName: input.holderName,
      unitClass: input.unitClass,
      units: input.units,
      issueDate: input.date,
      linkedEventId: input.eventId,
    });

    const event: CertificateEvent = {
      eventId: input.eventId,
      eventType: "initial_issuance",
      date: input.date,
      certNumber: cert.certNumber,
      holderId: input.holderId,
      holderName: input.holderName,
      unitClass: input.unitClass,
      units: input.units,
      relatedCertNumber: null,
      notes: input.notes || "",
    };
    this.events.push(event);

    const record: TransferRecord = {
      transferId: input.eventId,
      eventType: "initial_issuance",
      effectiveDate: input.date,
      metadata: {
        reason: input.notes || "Initial issuance of units",
        consideration: input.consideration ?? null,
        statute: input.statute ?? null,
      },
      surrendered: [],
      issued: [
        { certNumber: cert.certNumber, holder: input.holderName, unitClass: input.unitClass, units: input.units, purpose: "issuance" },
      ],
    };

    return { events: [event], certificates: [cert], record };
  }

  /** Transfer units between holders (partial or full). */
  transfer(input: TransferInput): CertificateActionResult {
    const sourceCert = this.resolveSourceCert(input.fromHolderId, input.unitClass, input.sourceCertNumber);

    if (input.units > sourceCert.units) {
      throw new Error(`Cannot transfer ${input.units} units — certificate ${sourceCert.certNumber} only holds ${sourceCert.units}`);
    }

    const resultEvents: CertificateEvent[] = [];
    const resultCerts: Certificate[] = [];
    const surrenderedList: TransferRecord["surrendered"] = [];
    const issuedList: TransferRecord["issued"] = [];

    // 1. Surrender source cert
    this.surrenderCert(sourceCert, input.date, input.eventId);
    resultEvents.push(this.makeEvent(input.eventId, "surrender", input.date, sourceCert.certNumber, input.fromHolderId, input.fromHolderName, input.unitClass, sourceCert.units, null, input.notes));
    surrenderedList.push({ certNumber: sourceCert.certNumber, holder: input.fromHolderName, unitClass: input.unitClass, units: sourceCert.units });

    // 2. Issue new cert to transferee
    const buyerCert = this.mintCert({ holderId: input.toHolderId, holderName: input.toHolderName, unitClass: input.unitClass, units: input.units, issueDate: input.date, linkedEventId: input.eventId });
    resultEvents.push(this.makeEvent(input.eventId, "transfer_issue", input.date, buyerCert.certNumber, input.toHolderId, input.toHolderName, input.unitClass, input.units, sourceCert.certNumber, ""));
    resultCerts.push(buyerCert);
    issuedList.push({ certNumber: buyerCert.certNumber, holder: input.toHolderName, unitClass: input.unitClass, units: input.units, purpose: "transferee" });

    // 3. Remainder cert to transferor (if partial)
    const remainder = sourceCert.units - input.units;
    if (remainder > 0) {
      const remainderCert = this.mintCert({ holderId: input.fromHolderId, holderName: input.fromHolderName, unitClass: input.unitClass, units: remainder, issueDate: input.date, linkedEventId: input.eventId });
      resultEvents.push(this.makeEvent(input.eventId, "remainder_issue", input.date, remainderCert.certNumber, input.fromHolderId, input.fromHolderName, input.unitClass, remainder, sourceCert.certNumber, "Remainder after transfer"));
      resultCerts.push(remainderCert);
      issuedList.push({ certNumber: remainderCert.certNumber, holder: input.fromHolderName, unitClass: input.unitClass, units: remainder, purpose: "remainder" });
    }

    this.events.push(...resultEvents);

    const record: TransferRecord = {
      transferId: input.eventId,
      eventType: remainder > 0 ? "partial_transfer" : "full_transfer",
      effectiveDate: input.date,
      metadata: {
        reason: input.notes || (remainder > 0 ? "Partial transfer of units" : "Full transfer of units"),
        consideration: input.consideration ?? null,
        statute: input.statute ?? null,
      },
      surrendered: surrenderedList,
      issued: issuedList,
    };

    return { events: resultEvents, certificates: resultCerts, record };
  }

  /** Redeem (retire) units from a holder. */
  redeem(input: RedemptionInput): CertificateActionResult {
    const sourceCert = this.resolveSourceCert(input.holderId, input.unitClass, input.sourceCertNumber);

    if (input.units > sourceCert.units) {
      throw new Error(`Cannot redeem ${input.units} units — certificate ${sourceCert.certNumber} only holds ${sourceCert.units}`);
    }

    const resultEvents: CertificateEvent[] = [];
    const resultCerts: Certificate[] = [];
    const surrenderedList: TransferRecord["surrendered"] = [];
    const issuedList: TransferRecord["issued"] = [];

    this.surrenderCert(sourceCert, input.date, input.eventId);
    resultEvents.push(this.makeEvent(input.eventId, "redemption_surrender", input.date, sourceCert.certNumber, input.holderId, input.holderName, input.unitClass, sourceCert.units, null, input.notes));
    surrenderedList.push({ certNumber: sourceCert.certNumber, holder: input.holderName, unitClass: input.unitClass, units: sourceCert.units });

    const remainder = sourceCert.units - input.units;
    if (remainder > 0) {
      const remainderCert = this.mintCert({ holderId: input.holderId, holderName: input.holderName, unitClass: input.unitClass, units: remainder, issueDate: input.date, linkedEventId: input.eventId });
      resultEvents.push(this.makeEvent(input.eventId, "remainder_issue", input.date, remainderCert.certNumber, input.holderId, input.holderName, input.unitClass, remainder, sourceCert.certNumber, "Remainder after redemption"));
      resultCerts.push(remainderCert);
      issuedList.push({ certNumber: remainderCert.certNumber, holder: input.holderName, unitClass: input.unitClass, units: remainder, purpose: "remainder" });
    }

    this.events.push(...resultEvents);

    const record: TransferRecord = {
      transferId: input.eventId,
      eventType: remainder > 0 ? "partial_redemption" : "full_redemption",
      effectiveDate: input.date,
      metadata: {
        reason: input.notes || (remainder > 0 ? "Partial redemption of units" : "Full redemption of units"),
        consideration: input.consideration ?? null,
        statute: input.statute ?? null,
      },
      surrendered: surrenderedList,
      issued: issuedList,
    };

    return { events: resultEvents, certificates: resultCerts, record };
  }

  /** Reclassify units from one class to another (surrender old, issue new). */
  reclassify(input: ReclassificationInput): CertificateActionResult {
    const sourceCert = this.resolveSourceCert(input.holderId, input.fromClass, input.sourceCertNumber);

    if (input.units > sourceCert.units) {
      throw new Error(`Cannot reclassify ${input.units} units — certificate ${sourceCert.certNumber} only holds ${sourceCert.units}`);
    }

    const resultEvents: CertificateEvent[] = [];
    const resultCerts: Certificate[] = [];
    const surrenderedList: TransferRecord["surrendered"] = [];
    const issuedList: TransferRecord["issued"] = [];

    this.surrenderCert(sourceCert, input.date, input.eventId);
    resultEvents.push(this.makeEvent(input.eventId, "reclassification_surrender", input.date, sourceCert.certNumber, input.holderId, input.holderName, input.fromClass, sourceCert.units, null, input.notes));
    surrenderedList.push({ certNumber: sourceCert.certNumber, holder: input.holderName, unitClass: input.fromClass, units: sourceCert.units });

    const newClassCert = this.mintCert({ holderId: input.holderId, holderName: input.holderName, unitClass: input.toClass, units: input.units, issueDate: input.date, linkedEventId: input.eventId });
    resultEvents.push(this.makeEvent(input.eventId, "reclassification_issue", input.date, newClassCert.certNumber, input.holderId, input.holderName, input.toClass, input.units, sourceCert.certNumber, `Reclassified from ${input.fromClass}`));
    resultCerts.push(newClassCert);
    issuedList.push({ certNumber: newClassCert.certNumber, holder: input.holderName, unitClass: input.toClass, units: input.units, purpose: "reclass" });

    const remainder = sourceCert.units - input.units;
    if (remainder > 0) {
      const remainderCert = this.mintCert({ holderId: input.holderId, holderName: input.holderName, unitClass: input.fromClass, units: remainder, issueDate: input.date, linkedEventId: input.eventId });
      resultEvents.push(this.makeEvent(input.eventId, "remainder_issue", input.date, remainderCert.certNumber, input.holderId, input.holderName, input.fromClass, remainder, sourceCert.certNumber, "Remainder after reclassification"));
      resultCerts.push(remainderCert);
      issuedList.push({ certNumber: remainderCert.certNumber, holder: input.holderName, unitClass: input.fromClass, units: remainder, purpose: "remainder" });
    }

    this.events.push(...resultEvents);

    const record: TransferRecord = {
      transferId: input.eventId,
      eventType: "reclassification",
      effectiveDate: input.date,
      metadata: {
        reason: input.notes || `Reclassification from ${input.fromClass} to ${input.toClass}`,
        consideration: null,
        statute: input.statute ?? null,
      },
      surrendered: surrenderedList,
      issued: issuedList,
    };

    return { events: resultEvents, certificates: resultCerts, record };
  }

  /** Trust/entity restructuring — move all certs for given classes to a new holder entity. */
  restructure(input: RestructureInput): CertificateActionResult {
    const resultEvents: CertificateEvent[] = [];
    const resultCerts: Certificate[] = [];
    const surrenderedList: TransferRecord["surrendered"] = [];
    const issuedList: TransferRecord["issued"] = [];

    for (const cls of input.classes) {
      const activeCerts = this.findAllActiveCerts(input.fromHolderId, cls);
      if (activeCerts.length === 0) continue;

      for (const sourceCert of activeCerts) {
        this.surrenderCert(sourceCert, input.date, input.eventId);
        resultEvents.push(this.makeEvent(input.eventId, "restructure_surrender", input.date, sourceCert.certNumber, input.fromHolderId, input.fromHolderName, cls, sourceCert.units, null, input.reason));
        surrenderedList.push({ certNumber: sourceCert.certNumber, holder: input.fromHolderName, unitClass: cls, units: sourceCert.units });

        const newCert = this.mintCert({ holderId: input.toHolderId, holderName: input.toHolderName, unitClass: cls, units: sourceCert.units, issueDate: input.date, linkedEventId: input.eventId });
        resultEvents.push(this.makeEvent(input.eventId, "restructure_issue", input.date, newCert.certNumber, input.toHolderId, input.toHolderName, cls, sourceCert.units, sourceCert.certNumber, `Restructured from ${input.fromHolderName}`));
        resultCerts.push(newCert);
        issuedList.push({ certNumber: newCert.certNumber, holder: input.toHolderName, unitClass: cls, units: sourceCert.units, purpose: "restructure" });
      }
    }

    if (surrenderedList.length === 0) {
      throw new Error(`No active certificates found for holder ${input.fromHolderId} in classes [${input.classes.join(", ")}]`);
    }

    this.events.push(...resultEvents);

    const record: TransferRecord = {
      transferId: input.eventId,
      eventType: "restructure",
      effectiveDate: input.date,
      metadata: {
        reason: input.reason,
        consideration: null,
        statute: input.statute ?? null,
      },
      surrendered: surrenderedList,
      issued: issuedList,
    };

    return { events: resultEvents, certificates: resultCerts, record };
  }

  /** Consolidate multiple active certs for one holder+class into a single cert. */
  consolidate(input: ConsolidationInput): CertificateActionResult {
    let certsToConsolidate: Certificate[];

    if (input.certNumbers && input.certNumbers.length > 0) {
      certsToConsolidate = input.certNumbers.map((cn) => {
        const c = this.findCertByNumber(cn);
        if (!c) throw new Error(`Certificate ${cn} not found`);
        if (c.status !== "active") throw new Error(`Certificate ${cn} is not active`);
        if (c.holderId !== input.holderId) throw new Error(`Certificate ${cn} does not belong to holder ${input.holderId}`);
        if (c.unitClass !== input.unitClass) throw new Error(`Certificate ${cn} is class "${c.unitClass}", expected "${input.unitClass}"`);
        return c;
      });
    } else {
      certsToConsolidate = this.findAllActiveCerts(input.holderId, input.unitClass);
    }

    if (certsToConsolidate.length < 2) {
      throw new Error("Consolidation requires at least 2 active certificates");
    }

    const resultEvents: CertificateEvent[] = [];
    const surrenderedList: TransferRecord["surrendered"] = [];
    let totalUnits = 0;

    for (const cert of certsToConsolidate) {
      this.surrenderCert(cert, input.date, input.eventId);
      resultEvents.push(this.makeEvent(input.eventId, "consolidation_surrender", input.date, cert.certNumber, input.holderId, input.holderName, input.unitClass, cert.units, null, input.notes));
      surrenderedList.push({ certNumber: cert.certNumber, holder: input.holderName, unitClass: input.unitClass, units: cert.units });
      totalUnits += cert.units;
    }

    const consolidatedCert = this.mintCert({ holderId: input.holderId, holderName: input.holderName, unitClass: input.unitClass, units: totalUnits, issueDate: input.date, linkedEventId: input.eventId });
    resultEvents.push(this.makeEvent(input.eventId, "consolidation_issue", input.date, consolidatedCert.certNumber, input.holderId, input.holderName, input.unitClass, totalUnits, null, `Consolidated ${certsToConsolidate.length} certificates`));

    this.events.push(...resultEvents);

    const record: TransferRecord = {
      transferId: input.eventId,
      eventType: "consolidation",
      effectiveDate: input.date,
      metadata: {
        reason: input.notes || `Consolidated ${certsToConsolidate.length} certificates into one`,
        consideration: null,
        statute: input.statute ?? null,
      },
      surrendered: surrenderedList,
      issued: [
        { certNumber: consolidatedCert.certNumber, holder: input.holderName, unitClass: input.unitClass, units: totalUnits, purpose: "consolidation" },
      ],
    };

    return { events: resultEvents, certificates: [consolidatedCert], record };
  }

  /** Split one certificate into multiple certificates with specified unit amounts. */
  split(input: SplitInput): CertificateActionResult {
    const sourceCert = this.resolveSourceCert(input.holderId, input.unitClass, input.sourceCertNumber);
    const splitTotal = input.splitAmounts.reduce((s, a) => s + a, 0);

    if (splitTotal !== sourceCert.units) {
      throw new Error(`Split amounts sum to ${splitTotal} but certificate ${sourceCert.certNumber} holds ${sourceCert.units} units`);
    }

    if (input.splitAmounts.length < 2) {
      throw new Error("Split requires at least 2 output amounts");
    }

    if (input.splitAmounts.some((a) => a <= 0)) {
      throw new Error("All split amounts must be positive");
    }

    const resultEvents: CertificateEvent[] = [];
    const resultCerts: Certificate[] = [];
    const issuedList: TransferRecord["issued"] = [];

    this.surrenderCert(sourceCert, input.date, input.eventId);
    resultEvents.push(this.makeEvent(input.eventId, "split_surrender", input.date, sourceCert.certNumber, input.holderId, input.holderName, input.unitClass, sourceCert.units, null, input.notes));

    for (const amount of input.splitAmounts) {
      const newCert = this.mintCert({ holderId: input.holderId, holderName: input.holderName, unitClass: input.unitClass, units: amount, issueDate: input.date, linkedEventId: input.eventId });
      resultEvents.push(this.makeEvent(input.eventId, "split_issue", input.date, newCert.certNumber, input.holderId, input.holderName, input.unitClass, amount, sourceCert.certNumber, `Split from ${sourceCert.certNumber}`));
      resultCerts.push(newCert);
      issuedList.push({ certNumber: newCert.certNumber, holder: input.holderName, unitClass: input.unitClass, units: amount, purpose: "split" });
    }

    this.events.push(...resultEvents);

    const record: TransferRecord = {
      transferId: input.eventId,
      eventType: "split",
      effectiveDate: input.date,
      metadata: {
        reason: input.notes || `Split ${sourceCert.certNumber} into ${input.splitAmounts.length} certificates`,
        consideration: null,
        statute: input.statute ?? null,
      },
      surrendered: [
        { certNumber: sourceCert.certNumber, holder: input.holderName, unitClass: input.unitClass, units: sourceCert.units },
      ],
      issued: issuedList,
    };

    return { events: resultEvents, certificates: resultCerts, record };
  }

  // ---- Internal helpers ----

  private makeEvent(
    eventId: string, eventType: CertEventType, date: string, certNumber: string,
    holderId: string, holderName: string, unitClass: string, units: number,
    relatedCertNumber: string | null, notes?: string
  ): CertificateEvent {
    return { eventId, eventType, date, certNumber, holderId, holderName, unitClass, units, relatedCertNumber, notes: notes || "" };
  }

  private mintCert(params: {
    holderId: string;
    holderName: string;
    unitClass: string;
    units: number;
    issueDate: string;
    linkedEventId: string | null;
  }): Certificate {
    const seq = this.nextSeq++;
    const cert: Certificate = {
      certNumber: formatCertNumber(seq),
      seq,
      holderId: params.holderId,
      holderName: params.holderName,
      unitClass: params.unitClass,
      units: params.units,
      status: "active",
      issueDate: params.issueDate,
      surrenderDate: null,
      linkedEventId: params.linkedEventId,
    };
    this.certificates.push(cert);
    return cert;
  }

  private surrenderCert(cert: Certificate, date: string, eventId: string): void {
    cert.status = "surrendered";
    cert.surrenderDate = date;
    cert.linkedEventId = eventId;
  }

  private resolveSourceCert(holderId: string, unitClass: string, explicitCertNumber?: string): Certificate {
    let cert: Certificate | null = null;

    if (explicitCertNumber) {
      cert = this.findCertByNumber(explicitCertNumber);
      if (!cert) throw new Error(`Certificate ${explicitCertNumber} not found`);
      if (cert.status !== "active") throw new Error(`Certificate ${explicitCertNumber} is not active (status: ${cert.status})`);
      if (cert.holderId !== holderId) throw new Error(`Certificate ${explicitCertNumber} does not belong to holder ${holderId}`);
      if (cert.unitClass !== unitClass) throw new Error(`Certificate ${explicitCertNumber} is class "${cert.unitClass}", expected "${unitClass}"`);
    } else {
      cert = this.findActiveCert(holderId, unitClass);
      if (!cert) throw new Error(`No active certificate found for holder ${holderId} in class "${unitClass}"`);
    }

    return cert;
  }
}

// ---------------------------------------------------------------------------
// Example JSON outputs per event type
// ---------------------------------------------------------------------------
/*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE 1 — Initial Issuance
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "transferId": "evt-1",
  "eventType": "initial_issuance",
  "effectiveDate": "2025-01-15",
  "metadata": {
    "reason": "Initial capital contribution",
    "consideration": "$50,000 cash",
    "statute": "§ 180.0601"
  },
  "surrendered": [],
  "issued": [
    { "certNumber": "C-001", "holder": "Alice Smith", "unitClass": "Common", "units": 1000, "purpose": "issuance" }
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE 2 — Partial Transfer (300 of 1000)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "transferId": "evt-2",
  "eventType": "partial_transfer",
  "effectiveDate": "2025-03-01",
  "metadata": {
    "reason": "Sale of shares per purchase agreement",
    "consideration": "$15,000 cash",
    "statute": "§ 180.0627"
  },
  "surrendered": [
    { "certNumber": "C-001", "holder": "Alice Smith", "unitClass": "Common", "units": 1000 }
  ],
  "issued": [
    { "certNumber": "C-002", "holder": "Bob Jones", "unitClass": "Common", "units": 300, "purpose": "transferee" },
    { "certNumber": "C-003", "holder": "Alice Smith", "unitClass": "Common", "units": 700, "purpose": "remainder" }
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE 3 — Full Transfer (Bob transfers all 300)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "transferId": "evt-3",
  "eventType": "full_transfer",
  "effectiveDate": "2025-04-01",
  "metadata": {
    "reason": "Full transfer of shares",
    "consideration": "$15,000 cash",
    "statute": "§ 180.0627"
  },
  "surrendered": [
    { "certNumber": "C-002", "holder": "Bob Jones", "unitClass": "Common", "units": 300 }
  ],
  "issued": [
    { "certNumber": "C-004", "holder": "Charlie Doe", "unitClass": "Common", "units": 300, "purpose": "transferee" }
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE 4 — Partial Redemption (Alice redeems 200 of 700)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "transferId": "evt-4",
  "eventType": "partial_redemption",
  "effectiveDate": "2025-05-01",
  "metadata": {
    "reason": "Partial share redemption",
    "consideration": "$10,000 cash",
    "statute": "§ 180.0631"
  },
  "surrendered": [
    { "certNumber": "C-003", "holder": "Alice Smith", "unitClass": "Common", "units": 700 }
  ],
  "issued": [
    { "certNumber": "C-005", "holder": "Alice Smith", "unitClass": "Common", "units": 500, "purpose": "remainder" }
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE 5 — Full Redemption
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "transferId": "evt-5",
  "eventType": "full_redemption",
  "effectiveDate": "2025-05-15",
  "metadata": {
    "reason": "Full redemption — member withdrawal",
    "consideration": "$25,000 cash",
    "statute": "§ 180.0631"
  },
  "surrendered": [
    { "certNumber": "C-005", "holder": "Alice Smith", "unitClass": "Common", "units": 500 }
  ],
  "issued": []
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE 6 — Reclassification (100 Common → Preferred)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "transferId": "evt-6",
  "eventType": "reclassification",
  "effectiveDate": "2025-06-01",
  "metadata": {
    "reason": "Reclassification from Common to Preferred",
    "consideration": null,
    "statute": "§ 180.0604"
  },
  "surrendered": [
    { "certNumber": "C-004", "holder": "Charlie Doe", "unitClass": "Common", "units": 300 }
  ],
  "issued": [
    { "certNumber": "C-006", "holder": "Charlie Doe", "unitClass": "Preferred", "units": 100, "purpose": "reclass" },
    { "certNumber": "C-007", "holder": "Charlie Doe", "unitClass": "Common", "units": 200, "purpose": "remainder" }
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE 7 — Trust/Entity Restructuring
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "transferId": "evt-7",
  "eventType": "restructure",
  "effectiveDate": "2025-07-01",
  "metadata": {
    "reason": "Transfer to Smith Family Trust per estate plan",
    "consideration": null,
    "statute": null
  },
  "surrendered": [
    { "certNumber": "C-007", "holder": "Charlie Doe", "unitClass": "Common", "units": 200 },
    { "certNumber": "C-006", "holder": "Charlie Doe", "unitClass": "Preferred", "units": 100 }
  ],
  "issued": [
    { "certNumber": "C-008", "holder": "Smith Family Trust", "unitClass": "Common", "units": 200, "purpose": "restructure" },
    { "certNumber": "C-009", "holder": "Smith Family Trust", "unitClass": "Preferred", "units": 100, "purpose": "restructure" }
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE 8 — Certificate Consolidation (merge 2 certs into 1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "transferId": "evt-8",
  "eventType": "consolidation",
  "effectiveDate": "2025-08-01",
  "metadata": {
    "reason": "Consolidated 2 certificates into one",
    "consideration": null,
    "statute": null
  },
  "surrendered": [
    { "certNumber": "C-008", "holder": "Smith Family Trust", "unitClass": "Common", "units": 200 },
    { "certNumber": "C-010", "holder": "Smith Family Trust", "unitClass": "Common", "units": 50 }
  ],
  "issued": [
    { "certNumber": "C-011", "holder": "Smith Family Trust", "unitClass": "Common", "units": 250, "purpose": "consolidation" }
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE 9 — Certificate Split (1 cert into 3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "transferId": "evt-9",
  "eventType": "split",
  "effectiveDate": "2025-09-01",
  "metadata": {
    "reason": "Split C-011 into 3 certificates for estate planning",
    "consideration": null,
    "statute": null
  },
  "surrendered": [
    { "certNumber": "C-011", "holder": "Smith Family Trust", "unitClass": "Common", "units": 250 }
  ],
  "issued": [
    { "certNumber": "C-012", "holder": "Smith Family Trust", "unitClass": "Common", "units": 100, "purpose": "split" },
    { "certNumber": "C-013", "holder": "Smith Family Trust", "unitClass": "Common", "units": 100, "purpose": "split" },
    { "certNumber": "C-014", "holder": "Smith Family Trust", "unitClass": "Common", "units": 50, "purpose": "split" }
  ]
}
*/
