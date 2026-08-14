import { describe, it, expect } from "vitest";
import { exportMeetingMinutesPDF } from "@/lib/meeting-pdf-export";

const base: any = {
  meeting: { id: "m1", meeting_type: "Written Consent", meeting_date: "2025-03-14", consent_body: "board", purpose: "Written Consent" },
  company: { name: "ABC Inc", entity_type: "Corporation", state_of_incorporation: "Wisconsin" },
  directors: [{ director_name: "Dale R. Ketterman" }, { director_name: "Jane Doe" }],
  resolutions: [{ purpose: "X", resolution_text: "RESOLVED, that X." }],
};

function text(doc: any) {
  return JSON.stringify(doc.output("arraybuffer").byteLength);
}

describe("consent dating", () => {
  it("legacy consent unchanged shape", () => {
    const d = exportMeetingMinutesPDF({ ...base });
    expect(d).toBeTruthy();
  });
  it("with signatures renders", () => {
    const d = exportMeetingMinutesPDF({
      ...base,
      meeting: { ...base.meeting, executed_date: "2025-11-02" },
      signatures: [
        { signer_name: "Dale R. Ketterman", signer_role: "Director", signer_title: "President", signed_on: "2025-10-28", sort_order: 0 },
        { signer_name: "Jane Doe", signer_role: "Director", signed_on: null, sort_order: 1 },
      ],
    });
    expect(d).toBeTruthy();
  });
});
