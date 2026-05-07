import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, FileText, Loader2, CheckCircle2, Building2, Users } from "lucide-react";

export interface OAExtracted {
  company: {
    name: string | null;
    entity_type: string | null;
    state_of_incorporation: string | null;
    formation_date: string | null;
    address: string | null;
    address_2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    ein: string | null;
    business_purpose: string | null;
    fiscal_year_end: string | null;
    management_type: string | null;
    registered_agent_name: string | null;
    registered_agent_address: string | null;
    registered_agent_city: string | null;
    registered_agent_state: string | null;
    registered_agent_zip: string | null;
  };
  members: Array<{
    name: string;
    address: string | null;
    address_2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    units_held: number | null;
    ownership_pct: number | null;
    capital_contribution: number | null;
  }>;
  managers: Array<{ name: string; title: string | null }>;
}

interface Props {
  trigger?: React.ReactNode;
  onConfirm: (data: { extracted: OAExtracted; file: File }) => Promise<void> | void;
}

export default function OperatingAgreementUpload({ trigger, onConfirm }: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [extracted, setExtracted] = useState<OAExtracted | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setExtracted(null);
    setParsing(false);
    setCreating(false);
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    if (!["pdf", "docx"].includes(ext)) {
      toast.error("Please upload a PDF or DOCX file");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("File must be 20 MB or smaller");
      return;
    }
    setFile(f);
    setExtracted(null);
  };

  const handleParse = async () => {
    if (!file) return;
    setParsing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please log in first"); return; }

      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-operating-agreement`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: fd,
        },
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${resp.status})`);
      }
      const { extracted } = await resp.json();
      if (!extracted?.company?.name) {
        throw new Error("Could not detect a company name in the agreement");
      }
      setExtracted(extracted);
      toast.success("Operating Agreement parsed successfully");
    } catch (err: any) {
      toast.error(err.message || "Parsing failed");
    } finally {
      setParsing(false);
    }
  };

  const handleConfirm = async () => {
    if (!extracted || !file) return;
    setCreating(true);
    try {
      await onConfirm({ extracted, file });
      setOpen(false);
      reset();
    } catch (err: any) {
      toast.error(err.message || "Failed to create company");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="w-full">
            <Upload className="mr-2 h-3.5 w-3.5" /> Import from Operating Agreement
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base">Import from Operating Agreement</DialogTitle>
          <DialogDescription className="text-xs">
            Upload a PDF or Word file. We'll extract company details, members, and managers, then create the company file for you.
          </DialogDescription>
        </DialogHeader>

        {!extracted && (
          <div className="space-y-3">
            <div
              onClick={() => fileRef.current?.click()}
              className="rounded-md border-2 border-dashed border-border p-6 text-center cursor-pointer hover:border-primary transition-colors"
            >
              <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">{file ? file.name : "Click to choose a file"}</p>
              <p className="text-[10px] text-muted-foreground mt-1">PDF or DOCX, up to 20 MB</p>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleParse} disabled={!file || parsing}>
                {parsing
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Parsing…</>
                  : <><FileText className="h-3.5 w-3.5" /> Parse Document</>}
              </Button>
            </DialogFooter>
          </div>
        )}

        {extracted && (
          <div className="space-y-3">
            <Card>
              <CardContent className="pt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Extracted successfully</span>
                </div>
                <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs pt-2 border-t border-border">
                  <span className="text-muted-foreground">Company:</span>
                  <span className="font-medium flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {extracted.company.name}
                  </span>
                  {extracted.company.entity_type && (
                    <>
                      <span className="text-muted-foreground">Entity Type:</span>
                      <span><Badge variant="outline" className="text-[10px]">{extracted.company.entity_type}</Badge></span>
                    </>
                  )}
                  {extracted.company.state_of_incorporation && (
                    <>
                      <span className="text-muted-foreground">State:</span>
                      <span>{extracted.company.state_of_incorporation}</span>
                    </>
                  )}
                  {extracted.company.management_type && (
                    <>
                      <span className="text-muted-foreground">Management:</span>
                      <span>{extracted.company.management_type}</span>
                    </>
                  )}
                  {extracted.company.formation_date && (
                    <>
                      <span className="text-muted-foreground">Formed:</span>
                      <span>{extracted.company.formation_date}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">Members:</span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {extracted.members.length}
                  </span>
                  {extracted.managers.length > 0 && (
                    <>
                      <span className="text-muted-foreground">Managers:</span>
                      <span>{extracted.managers.length}</span>
                    </>
                  )}
                </div>
                {extracted.members.length > 0 && (
                  <div className="text-xs pt-2 border-t border-border">
                    <p className="text-muted-foreground mb-1">Members:</p>
                    <ul className="space-y-0.5">
                      {extracted.members.map((m, i) => (
                        <li key={i} className="flex justify-between">
                          <span>{m.name}</span>
                          {m.ownership_pct != null && (
                            <span className="text-muted-foreground">{m.ownership_pct}%</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={reset}>Re-upload</Button>
              <Button size="sm" onClick={handleConfirm} disabled={creating}>
                {creating
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…</>
                  : <>Create Company</>}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
