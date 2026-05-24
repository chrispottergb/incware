import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  companyId: string;
}

type Company = {
  name: string | null;
  ein: string | null;
  address: string | null;
  address_2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  fiscal_year_end: string | null;
  state_of_incorporation: string | null;
  incorporation_date: string | null;
  ntee_code: string | null;
  entity_type: string | null;
  organizational_structure: string | null;
  contact_full_name: string | null;
  contact_phone: string | null;
  business_purpose: string | null;
  tax_exempt_purpose: string | null;
};

type InitialDirector = {
  id: string;
  full_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  term_length: string | null;
  hours_per_week: string | null;
};

type BoardDirector = {
  id: string;
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

const PAY_GOV_URL = "https://pay.gov/public/form/start/233418342";

function formatAddress(
  address: string | null,
  address2: string | null,
  city: string | null,
  state: string | null,
  zip: string | null
) {
  const line1 = [address, address2].filter(Boolean).join(", ");
  const line2 = [city, state].filter(Boolean).join(", ");
  const full = [line1, line2, zip].filter(Boolean).join(" ");
  return full || "—";
}

function formatMonthYear(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  // Accept YYYY-MM-DD or ISO; build date in local TZ to avoid off-by-one
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}



function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{value && value.trim() !== "" ? value : "—"}</div>
    </div>
  );
}

export function Form1023EZReferenceView({ companyId }: Props) {
  const [open, setOpen] = useState(false);

  const { data: company } = useQuery({
    queryKey: ["company_1023ez_reference", companyId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select(
          "name, ein, address, address_2, city, state, zip, fiscal_year_end, state_of_incorporation, incorporation_date, ntee_code, entity_type, organizational_structure, contact_full_name, contact_phone, business_purpose, tax_exempt_purpose"
        )
        .eq("id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data as Company | null;
    },
  });

  const { data: initialDirectors = [] } = useQuery({
    queryKey: ["nonprofit_initial_directors_ref", companyId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("nonprofit_initial_directors")
        .select("id, full_name, address, city, state, zip, term_length, hours_per_week")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as InitialDirector[];
    },
  });

  const { data: boardDirectors = [] } = useQuery({
    queryKey: ["directors_ref", companyId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("directors")
        .select("id, name, address, city, state, zip")
        .eq("company_id", companyId);
      if (error) throw error;
      return (data ?? []) as BoardDirector[];
    },
  });

  const allPeople = [
    ...initialDirectors.map((d) => ({
      id: `init-${d.id}`,
      name: d.full_name,
      role: "Initial Director",
      address: formatAddress(d.address, null, d.city, d.state, d.zip),
      hours: d.hours_per_week,
    })),
    ...boardDirectors.map((d) => ({
      id: `board-${d.id}`,
      name: d.name,
      role: "Director",
      address: formatAddress(d.address, null, d.city, d.state, d.zip),
      hours: null as string | null,
    })),
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <FileText className="h-3 w-3 mr-1" /> View 1023-EZ Filing Reference
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background/95">
        <DialogHeader>
          <DialogTitle>Form 1023-EZ Filing Reference</DialogTitle>
          <DialogDescription>
            Reference data from the client record, labeled to match the IRS Form 1023-EZ.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Organization Info */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold border-b pb-1">Organization Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Legal Name of Organization" value={company?.name} />
              <Field label="Employer Identification Number (EIN)" value={company?.ein} />
              <Field
                label="Mailing Address"
                value={formatAddress(
                  company?.address ?? null,
                  company?.address_2 ?? null,
                  company?.city ?? null,
                  company?.state ?? null,
                  company?.zip ?? null
                )}
              />
              <Field label="Fiscal Year End Month" value={company?.fiscal_year_end} />
              <Field label="State of Incorporation" value={company?.state_of_incorporation} />
              <Field label="Date of Incorporation" value={company?.incorporation_date} />
              <Field label="NTEE Code" value={company?.ntee_code} />
              <Field label="Organizational Structure" value={company?.entity_type} />
              <Field label="Primary Contact Name" value={company?.contact_full_name} />
              <Field label="Primary Contact Phone" value={company?.contact_phone} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <Field label="Mission Statement" value={company?.business_purpose} />
              <Field label="Tax-Exempt Purpose" value={company?.tax_exempt_purpose} />
            </div>
          </section>

          {/* Officers & Directors */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold border-b pb-1">Officers &amp; Directors</h3>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-2 py-2 font-medium">Full Name</th>
                    <th className="px-2 py-2 font-medium">Title / Role</th>
                    <th className="px-2 py-2 font-medium">Address</th>
                    <th className="px-2 py-2 font-medium">Hours/Week</th>
                  </tr>
                </thead>
                <tbody>
                  {allPeople.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-2 py-4 text-center text-muted-foreground">
                        No directors recorded.
                      </td>
                    </tr>
                  )}
                  {allPeople.map((p) => (
                    <tr key={p.id} className="border-t align-top">
                      <td className="px-2 py-1.5">{p.name || "—"}</td>
                      <td className="px-2 py-1.5">{p.role}</td>
                      <td className="px-2 py-1.5">{p.address}</td>
                      <td className="px-2 py-1.5">{p.hours || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Footer */}
          <section className="space-y-3 pt-2 border-t">
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => window.open(PAY_GOV_URL, "_blank", "noopener,noreferrer")}
            >
              File 1023-EZ on Pay.gov <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Have your EIN, formation documents, and officer information ready before filing. The
              IRS user fee is $275.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
