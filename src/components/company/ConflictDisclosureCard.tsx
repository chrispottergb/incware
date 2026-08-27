import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ClipboardCheck, Download, Eye, FileText, Loader2, Printer } from "lucide-react";
import { generateConflictDisclosurePDF } from "@/lib/conflict-disclosure-pdf";

interface Props {
  companyId: string;
  companyName: string;
  policyAdoptedDate?: string | null;
}

interface RosterPerson {
  key: string;
  name: string;
  title: string;
  source: "director" | "officer";
}

const OFFICER_POSITIONS: { field: string; title: string }[] = [
  { field: "president", title: "President" },
  { field: "vice_president", title: "Vice President" },
  { field: "secretary", title: "Secretary" },
  { field: "treasurer", title: "Treasurer" },
];

export default function ConflictDisclosureCard({ companyId, companyName, policyAdoptedDate }: Props) {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);

  const yearOptions = useMemo(
    () => [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3],
    [currentYear],
  );

  const { data: directors = [] } = useQuery({
    queryKey: ["directors", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("directors").select("*").eq("company_id", companyId).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: officers = [] } = useQuery({
    queryKey: ["officers", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("officers").select("*").eq("company_id", companyId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: disclosures = [] } = useQuery({
    queryKey: ["conflict_disclosures", companyId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conflict_disclosures")
        .select("*")
        .eq("company_id", companyId)
        .eq("disclosure_year", year)
        .order("person_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Directors first, then officer positions that are filled. A person holding
  // both roles appears once, with the roles combined into a single title.
  const roster: RosterPerson[] = useMemo(() => {
    const byName = new Map<string, RosterPerson>();
    const push = (name: string, title: string, source: "director" | "officer") => {
      const clean = (name || "").trim();
      if (!clean) return;
      const k = clean.toLowerCase();
      const existing = byName.get(k);
      if (existing) {
        if (!existing.title.split(", ").includes(title)) {
          existing.title = existing.title ? `${existing.title}, ${title}` : title;
        }
        return;
      }
      byName.set(k, { key: k, name: clean, title, source });
    };
    for (const d of directors as any[]) push(d.name, "Director", "director");
    for (const o of officers as any[]) {
      for (const pos of OFFICER_POSITIONS) push(o[pos.field], pos.title, "officer");
    }
    return Array.from(byName.values());
  }, [directors, officers]);

  const selected = roster.filter((p) => !excluded.has(p.key));

  const toggle = (key: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const disclosureFor = (name: string) =>
    (disclosures as any[]).find((d) => (d.person_name || "").toLowerCase() === name.toLowerCase());

  const receivedCount = roster.filter((p) => disclosureFor(p.name)?.received_date).length;

  const upsertDisclosure = async (person: RosterPerson, patch: Record<string, any>) => {
    const existing = disclosureFor(person.name);
    try {
      if (existing) {
        const { error } = await supabase
          .from("conflict_disclosures").update(patch).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("conflict_disclosures").insert({
          company_id: companyId,
          disclosure_year: year,
          person_name: person.name,
          person_title: person.title,
          person_source: person.source,
          ...patch,
        });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["conflict_disclosures", companyId, year] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleGenerate = async () => {
    if (selected.length === 0) {
      toast.error("Select at least one director or officer.");
      return;
    }
    setIsGenerating(true);
    try {
      const doc = generateConflictDisclosurePDF({
        companyName,
        disclosureYear: year,
        signers: selected.map((p) => ({ name: p.name, title: p.title })),
        policyAdoptedDate,
      });
      setPdfDoc(doc);

      // Seed tracking rows so the grid reflects who was issued a form.
      for (const person of selected) {
        if (!disclosureFor(person.name)) {
          await supabase.from("conflict_disclosures").insert({
            company_id: companyId,
            disclosure_year: year,
            person_name: person.name,
            person_title: person.title,
            person_source: person.source,
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["conflict_disclosures", companyId, year] });
      toast.success(`${year} disclosure packet generated (${selected.length} statements).`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const safeName = companyName.replace(/[^a-zA-Z0-9]/g, "_");

  const handleDownload = async () => {
    if (!pdfDoc) return;
    const { savePdfReliably } = await import("@/lib/pdf-save");
    await savePdfReliably(pdfDoc, `${safeName}_Conflict_Disclosures_${year}.pdf`);
  };

  const handlePreview = () => {
    if (!pdfDoc) return;
    const url = URL.createObjectURL(pdfDoc.output("blob"));
    window.open(url, "_blank");
  };

  const handlePrint = () => {
    if (!pdfDoc) return;
    const win = window.open("", "_blank");
    const url = URL.createObjectURL(pdfDoc.output("blob"));
    if (win) {
      win.location.href = url;
      win.addEventListener("load", () => win.print());
    }
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-display">Annual Conflict of Interest Disclosure</CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px]">Required Every Year</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          The policy is adopted once; each director and officer must sign a disclosure statement every year.
          Generate a packet with one signature form per person, then track returns below.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Disclosure Year</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Generate {year} Disclosure Packet
          </Button>
          <span className="text-xs text-muted-foreground pb-2">
            {receivedCount} of {roster.length} received
          </span>
        </div>

        {pdfDoc && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5" /> Download PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handlePreview}>
              <Eye className="h-3.5 w-3.5" /> Preview
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          </div>
        )}

        {roster.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Add directors or officers to this organization to generate disclosure statements.
          </p>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 text-xs font-medium w-10">Include</th>
                  <th className="px-3 py-2 text-xs font-medium whitespace-nowrap">Name</th>
                  <th className="px-3 py-2 text-xs font-medium whitespace-nowrap">Title</th>
                  <th className="px-3 py-2 text-xs font-medium whitespace-nowrap">Date Received</th>
                  <th className="px-3 py-2 text-xs font-medium whitespace-nowrap">Conflict Disclosed</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((p) => {
                  const rec = disclosureFor(p.name);
                  return (
                    <tr key={p.key} className="border-t border-border">
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={!excluded.has(p.key)}
                          onCheckedChange={() => toggle(p.key)}
                          aria-label={`Include ${p.name}`}
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{p.name}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{p.title}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="date"
                          className="h-8 w-40"
                          value={rec?.received_date ?? ""}
                          onChange={(e) =>
                            upsertDisclosure(p, { received_date: e.target.value || null })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={!!rec?.conflict_disclosed}
                          onCheckedChange={(v) =>
                            upsertDisclosure(p, { conflict_disclosed: v === true })
                          }
                          aria-label={`Conflict disclosed by ${p.name}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
