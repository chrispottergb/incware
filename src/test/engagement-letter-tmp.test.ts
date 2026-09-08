import { describe, it } from "vitest";
import fs from "fs";
import { buildEngagementLetterPDF } from "@/lib/engagement-letter-pdf";

describe("engagement letter", () => {
  it("renders", () => {
    const doc = buildEngagementLetterPDF({
      company: { name: "Stiegler Trans LLC", address: "123 Main St", city: "Madison", state: "WI", zip: "53703", contact_full_name: "John Stiegler", salutation_name: "Mr. Stiegler" },
      firm: { firm_name: "Incorporation Resources Company", address: "500 Oak Ave", city: "Brookfield", state: "WI", zip: "53005", phone: "262-555-0100", email: "info@example.com", contact_name: "Jane Doe", contact_title: "President" },
      feeTerms: "Flat annual fee of $750, invoiced each January, due on receipt.",
    });
    fs.writeFileSync("/tmp/el.pdf", Buffer.from(doc.output("arraybuffer")));
  });
});
