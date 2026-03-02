/**
 * Certificate-Numbering Logic Module
 * ===================================
 * Implements a certificate-per-transaction model with C-### numbering.
 * Each certificate is a container for a specific block of units in a single class.
 *
 * Rules:
 *  - Certificate numbers start at C-001 per entity and never reuse.
 *  - Every transfer, redemption, or reclassification surrenders the source cert
 *    and issues new cert(s) for the transferee and remainder.
 *  - Certificates are single-class only.
 *  - Voided/surrendered certificates retain their number permanently.
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
  | "reclassification_issue";

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

export interface TransferInput {
  eventId: string;
  date: string;
  fromHolderId: string;
  fromHolderName: string;
  toHolderId: string;
  toHolderName: string;
  unitClass: string;
  units: number;
  /** Source certificate to surrender. Engine locates it if omitted. */
  sourceCertNumber?: string;
  notes?: string;
}

export interface IssuanceInput {
  eventId: string;
  date: string;
  holderId: string;
  holderName: string;
  unitClass: string;
  units: number;
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
  notes?: string;
}

export interface CertificateActionResult {
  events: CertificateEvent[];
  certificates: Certificate[];
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

  /** Find the active cert for a holder + class. Returns null if none. */
  findActiveCert(holderId: string, unitClass: string): Certificate | null {
    return (
      this.certificates.find(
        (c) =>
          c.holderId === holderId &&
          c.unitClass === unitClass &&
          c.status === "active"
      ) ?? null
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

    return { events: [event], certificates: [cert] };
  }

  /** Transfer units between holders (partial or full). */
  transfer(input: TransferInput): CertificateActionResult {
    const sourceCert = this.resolveSourceCert(
      input.fromHolderId,
      input.unitClass,
      input.sourceCertNumber
    );

    if (input.units > sourceCert.units) {
      throw new Error(
        `Cannot transfer ${input.units} units — certificate ${sourceCert.certNumber} only holds ${sourceCert.units}`
      );
    }

    const resultEvents: CertificateEvent[] = [];
    const resultCerts: Certificate[] = [];

    // 1. Surrender source cert
    this.surrenderCert(sourceCert, input.date, input.eventId);
    resultEvents.push({
      eventId: input.eventId,
      eventType: "surrender",
      date: input.date,
      certNumber: sourceCert.certNumber,
      holderId: input.fromHolderId,
      holderName: input.fromHolderName,
      unitClass: input.unitClass,
      units: sourceCert.units,
      relatedCertNumber: null,
      notes: input.notes || "",
    });

    // 2. Issue new cert to transferee
    const buyerCert = this.mintCert({
      holderId: input.toHolderId,
      holderName: input.toHolderName,
      unitClass: input.unitClass,
      units: input.units,
      issueDate: input.date,
      linkedEventId: input.eventId,
    });
    resultEvents.push({
      eventId: input.eventId,
      eventType: "transfer_issue",
      date: input.date,
      certNumber: buyerCert.certNumber,
      holderId: input.toHolderId,
      holderName: input.toHolderName,
      unitClass: input.unitClass,
      units: input.units,
      relatedCertNumber: sourceCert.certNumber,
      notes: "",
    });
    resultCerts.push(buyerCert);

    // 3. Remainder cert to transferor (if partial)
    const remainder = sourceCert.units - input.units;
    if (remainder > 0) {
      const remainderCert = this.mintCert({
        holderId: input.fromHolderId,
        holderName: input.fromHolderName,
        unitClass: input.unitClass,
        units: remainder,
        issueDate: input.date,
        linkedEventId: input.eventId,
      });
      resultEvents.push({
        eventId: input.eventId,
        eventType: "remainder_issue",
        date: input.date,
        certNumber: remainderCert.certNumber,
        holderId: input.fromHolderId,
        holderName: input.fromHolderName,
        unitClass: input.unitClass,
        units: remainder,
        relatedCertNumber: sourceCert.certNumber,
        notes: "Remainder after transfer",
      });
      resultCerts.push(remainderCert);
    }

    this.events.push(...resultEvents);
    return { events: resultEvents, certificates: resultCerts };
  }

  /** Redeem (retire) units from a holder. */
  redeem(input: RedemptionInput): CertificateActionResult {
    const sourceCert = this.resolveSourceCert(
      input.holderId,
      input.unitClass,
      input.sourceCertNumber
    );

    if (input.units > sourceCert.units) {
      throw new Error(
        `Cannot redeem ${input.units} units — certificate ${sourceCert.certNumber} only holds ${sourceCert.units}`
      );
    }

    const resultEvents: CertificateEvent[] = [];
    const resultCerts: Certificate[] = [];

    // 1. Surrender source
    this.surrenderCert(sourceCert, input.date, input.eventId);
    resultEvents.push({
      eventId: input.eventId,
      eventType: "redemption_surrender",
      date: input.date,
      certNumber: sourceCert.certNumber,
      holderId: input.holderId,
      holderName: input.holderName,
      unitClass: input.unitClass,
      units: sourceCert.units,
      relatedCertNumber: null,
      notes: input.notes || "",
    });

    // 2. Remainder cert if partial redemption
    const remainder = sourceCert.units - input.units;
    if (remainder > 0) {
      const remainderCert = this.mintCert({
        holderId: input.holderId,
        holderName: input.holderName,
        unitClass: input.unitClass,
        units: remainder,
        issueDate: input.date,
        linkedEventId: input.eventId,
      });
      resultEvents.push({
        eventId: input.eventId,
        eventType: "remainder_issue",
        date: input.date,
        certNumber: remainderCert.certNumber,
        holderId: input.holderId,
        holderName: input.holderName,
        unitClass: input.unitClass,
        units: remainder,
        relatedCertNumber: sourceCert.certNumber,
        notes: "Remainder after redemption",
      });
      resultCerts.push(remainderCert);
    }

    this.events.push(...resultEvents);
    return { events: resultEvents, certificates: resultCerts };
  }

  /** Reclassify units from one class to another (surrender old, issue new). */
  reclassify(input: ReclassificationInput): CertificateActionResult {
    const sourceCert = this.resolveSourceCert(
      input.holderId,
      input.fromClass,
      input.sourceCertNumber
    );

    if (input.units > sourceCert.units) {
      throw new Error(
        `Cannot reclassify ${input.units} units — certificate ${sourceCert.certNumber} only holds ${sourceCert.units}`
      );
    }

    const resultEvents: CertificateEvent[] = [];
    const resultCerts: Certificate[] = [];

    // 1. Surrender source cert
    this.surrenderCert(sourceCert, input.date, input.eventId);
    resultEvents.push({
      eventId: input.eventId,
      eventType: "reclassification_surrender",
      date: input.date,
      certNumber: sourceCert.certNumber,
      holderId: input.holderId,
      holderName: input.holderName,
      unitClass: input.fromClass,
      units: sourceCert.units,
      relatedCertNumber: null,
      notes: input.notes || "",
    });

    // 2. Issue new cert in target class
    const newClassCert = this.mintCert({
      holderId: input.holderId,
      holderName: input.holderName,
      unitClass: input.toClass,
      units: input.units,
      issueDate: input.date,
      linkedEventId: input.eventId,
    });
    resultEvents.push({
      eventId: input.eventId,
      eventType: "reclassification_issue",
      date: input.date,
      certNumber: newClassCert.certNumber,
      holderId: input.holderId,
      holderName: input.holderName,
      unitClass: input.toClass,
      units: input.units,
      relatedCertNumber: sourceCert.certNumber,
      notes: `Reclassified from ${input.fromClass}`,
    });
    resultCerts.push(newClassCert);

    // 3. Remainder cert in original class
    const remainder = sourceCert.units - input.units;
    if (remainder > 0) {
      const remainderCert = this.mintCert({
        holderId: input.holderId,
        holderName: input.holderName,
        unitClass: input.fromClass,
        units: remainder,
        issueDate: input.date,
        linkedEventId: input.eventId,
      });
      resultEvents.push({
        eventId: input.eventId,
        eventType: "remainder_issue",
        date: input.date,
        certNumber: remainderCert.certNumber,
        holderId: input.holderId,
        holderName: input.holderName,
        unitClass: input.fromClass,
        units: remainder,
        relatedCertNumber: sourceCert.certNumber,
        notes: "Remainder after reclassification",
      });
      resultCerts.push(remainderCert);
    }

    this.events.push(...resultEvents);
    return { events: resultEvents, certificates: resultCerts };
  }

  // ---- Internal helpers ----

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

  private surrenderCert(
    cert: Certificate,
    date: string,
    eventId: string
  ): void {
    cert.status = "surrendered";
    cert.surrenderDate = date;
    cert.linkedEventId = eventId;
  }

  private resolveSourceCert(
    holderId: string,
    unitClass: string,
    explicitCertNumber?: string
  ): Certificate {
    let cert: Certificate | null = null;

    if (explicitCertNumber) {
      cert = this.findCertByNumber(explicitCertNumber);
      if (!cert) throw new Error(`Certificate ${explicitCertNumber} not found`);
      if (cert.status !== "active")
        throw new Error(`Certificate ${explicitCertNumber} is not active (status: ${cert.status})`);
      if (cert.holderId !== holderId)
        throw new Error(`Certificate ${explicitCertNumber} does not belong to holder ${holderId}`);
      if (cert.unitClass !== unitClass)
        throw new Error(`Certificate ${explicitCertNumber} is class "${cert.unitClass}", expected "${unitClass}"`);
    } else {
      cert = this.findActiveCert(holderId, unitClass);
      if (!cert)
        throw new Error(`No active certificate found for holder ${holderId} in class "${unitClass}"`);
    }

    return cert;
  }
}

// ---------------------------------------------------------------------------
// Example scenarios (for documentation / testing)
// ---------------------------------------------------------------------------
/*
EXAMPLE 1 — Initial Issuance:
  Input:  issueInitial({ eventId: "evt-1", date: "2025-01-15", holderId: "alice", holderName: "Alice Smith", unitClass: "Common", units: 1000 })
  Output: { events: [{ eventType: "initial_issuance", certNumber: "C-001", units: 1000 }],
            certificates: [{ certNumber: "C-001", status: "active", units: 1000 }] }

EXAMPLE 2 — Partial Transfer (300 of 1000):
  Input:  transfer({ eventId: "evt-2", date: "2025-03-01", fromHolderId: "alice", fromHolderName: "Alice Smith",
                      toHolderId: "bob", toHolderName: "Bob Jones", unitClass: "Common", units: 300 })
  Output: { events: [
              { eventType: "surrender",       certNumber: "C-001", units: 1000 },
              { eventType: "transfer_issue",   certNumber: "C-002", units: 300,  holder: "Bob Jones"   },
              { eventType: "remainder_issue",  certNumber: "C-003", units: 700,  holder: "Alice Smith" }
            ],
            certificates: [
              { certNumber: "C-001", status: "surrendered" },
              { certNumber: "C-002", status: "active", units: 300 },
              { certNumber: "C-003", status: "active", units: 700 }
            ] }

EXAMPLE 3 — Full Transfer (Bob transfers all 300):
  Input:  transfer({ eventId: "evt-3", date: "2025-04-01", fromHolderId: "bob", fromHolderName: "Bob Jones",
                      toHolderId: "charlie", toHolderName: "Charlie Doe", unitClass: "Common", units: 300 })
  Output: { events: [
              { eventType: "surrender",      certNumber: "C-002", units: 300 },
              { eventType: "transfer_issue", certNumber: "C-004", units: 300, holder: "Charlie Doe" }
            ] }
  Note: No remainder cert issued (full transfer).

EXAMPLE 4 — Redemption (Alice redeems 200 of 700):
  Input:  redeem({ eventId: "evt-4", date: "2025-05-01", holderId: "alice", holderName: "Alice Smith",
                   unitClass: "Common", units: 200 })
  Output: { events: [
              { eventType: "redemption_surrender", certNumber: "C-003", units: 700 },
              { eventType: "remainder_issue",      certNumber: "C-005", units: 500, holder: "Alice Smith" }
            ] }

EXAMPLE 5 — Reclassification (Alice converts 100 Common → Preferred):
  Input:  reclassify({ eventId: "evt-5", date: "2025-06-01", holderId: "alice", holderName: "Alice Smith",
                       fromClass: "Common", toClass: "Preferred", units: 100 })
  Output: { events: [
              { eventType: "reclassification_surrender", certNumber: "C-005", units: 500, class: "Common" },
              { eventType: "reclassification_issue",     certNumber: "C-006", units: 100, class: "Preferred" },
              { eventType: "remainder_issue",            certNumber: "C-007", units: 400, class: "Common" }
            ] }

EXAMPLE 6 — Multi-Class Initial Issuance:
  issueInitial({ ..., unitClass: "Common",    units: 1000 })  → C-001
  issueInitial({ ..., unitClass: "Preferred",  units: 500  })  → C-002
  Each certificate is single-class. Transfers within a class never affect the other class's certs.
*/
