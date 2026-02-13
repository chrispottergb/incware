import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { exportCompliancePDF, exportStockLedgerPDF, exportShareholderPDF } from "@/lib/pdf-export";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShieldCheck,
  Users,
  BookOpen,
  Printer,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileDown,
} from "lucide-react";

export default function Reports() {
  const [selectedCompany, setSelectedCompany] = useState<string>("all");

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: shareholders = [], isLoading: shLoading } = useQuery({
    queryKey: ["all-shareholders", selectedCompany],
    queryFn: async () => {
      let q = supabase.from("shareholders").select("*, companies!inner(name)");
      if (selectedCompany !== "all") q = q.eq("company_id", selectedCompany);
      const { data, error } = await q.order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: certificates = [], isLoading: certLoading } = useQuery({
    queryKey: ["all-certificates", selectedCompany],
    queryFn: async () => {
      let q = supabase
        .from("stock_certificates")
        .select("*, companies!inner(name), shareholders(name)");
      if (selectedCompany !== "all") q = q.eq("company_id", selectedCompany);
      const { data, error } = await q.order("certificate_number");
      if (error) throw error;
      return data;
    },
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["all-meetings-report", selectedCompany],
    queryFn: async () => {
      let q = supabase.from("meetings").select("id, company_id");
      if (selectedCompany !== "all") q = q.eq("company_id", selectedCompany);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: directors = [] } = useQuery({
    queryKey: ["all-directors-report", selectedCompany],
    queryFn: async () => {
      let q = supabase.from("directors").select("id, company_id");
      if (selectedCompany !== "all") q = q.eq("company_id", selectedCompany);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: officers = [] } = useQuery({
    queryKey: ["all-officers-report", selectedCompany],
    queryFn: async () => {
      let q = supabase.from("officers").select("*");
      if (selectedCompany !== "all") q = q.eq("company_id", selectedCompany);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Build compliance data per company
  const complianceData = (selectedCompany === "all" ? companies : companies.filter((c) => c.id === selectedCompany)).map(
    (company) => {
      const companyMeetings = meetings.filter((m) => m.company_id === company.id);
      const companyDirectors = directors.filter((d) => d.company_id === company.id);
      const companyOfficers = officers.filter((o) => o.company_id === company.id);
      const companyShareholders = shareholders.filter((s) => s.company_id === company.id);
      const companyCerts = certificates.filter((c) => c.company_id === company.id);

      const checks = [
        {
          label: "Registered Agent on file",
          pass: !!company.registered_agent_name,
        },
        {
          label: "At least one meeting recorded",
          pass: companyMeetings.length > 0,
        },
        {
          label: "Directors appointed",
          pass: companyDirectors.length > 0,
        },
        {
          label: "Officers appointed",
          pass: companyOfficers.length > 0 && !!(companyOfficers[0]?.president || companyOfficers[0]?.secretary),
        },
        {
          label: "Shareholders on record",
          pass: companyShareholders.length > 0,
        },
        {
          label: "Stock certificates issued",
          pass: companyCerts.length > 0,
        },
        {
          label: "Incorporation date set",
          pass: !!company.incorporation_date,
        },
        {
          label: "Business purpose defined",
          pass: !!company.business_purpose,
        },
      ];

      const passed = checks.filter((c) => c.pass).length;
      const score = Math.round((passed / checks.length) * 100);

      return { company, checks, score, passed, total: checks.length };
    }
  );

  const overallScore =
    complianceData.length > 0
      ? Math.round(complianceData.reduce((s, c) => s + c.score, 0) / complianceData.length)
      : 0;

  const handlePrint = () => window.print();

  const handleExportCompliance = () => {
    exportCompliancePDF(
      complianceData.map((c) => ({
        companyName: c.company.name,
        score: c.score,
        passed: c.passed,
        total: c.total,
        checks: c.checks,
      })),
      overallScore
    );
  };

  const handleExportLedger = () => {
    exportStockLedgerPDF(
      certificates.map((cert: any) => ({
        certNumber: cert.certificate_number,
        companyName: cert.companies?.name || "—",
        shareholderName: cert.shareholders?.name || "—",
        shareClass: cert.share_class,
        numShares: cert.num_shares,
        parValue: cert.par_value,
        issueDate: cert.issue_date,
        status: cert.status,
      })),
      selectedCompany
    );
  };

  const handleExportShareholders = () => {
    exportShareholderPDF(
      shareholders.map((sh: any) => ({
        name: sh.name,
        companyName: sh.companies?.name || "—",
        address: [sh.address, sh.city, sh.state, sh.zip].filter(Boolean).join(", ") || "—",
        status: sh.status,
        dateAdded: sh.date_added,
      }))
    );
  };

  const fmt = (n: number | null) =>
    n != null ? n.toLocaleString() : "—";

  const fmtCurrency = (n: number | null) =>
    n != null ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—";

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Reports</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Compliance, shareholder, and stock ledger reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger className="w-56 h-9 text-sm">
              <SelectValue placeholder="All companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden">
            <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
          </Button>
        </div>
      </div>

      <Tabs defaultValue="compliance" className="w-full">
        <TabsList className="print:hidden">
          <TabsTrigger value="compliance" className="gap-1.5 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" /> Compliance
          </TabsTrigger>
          <TabsTrigger value="shareholders" className="gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" /> Shareholders
          </TabsTrigger>
          <TabsTrigger value="ledger" className="gap-1.5 text-xs">
            <BookOpen className="h-3.5 w-3.5" /> Stock Ledger
          </TabsTrigger>
        </TabsList>

        {/* COMPLIANCE TAB */}
        <TabsContent value="compliance" className="space-y-4 mt-4">
          <div className="flex justify-end print:hidden">
            <Button variant="outline" size="sm" onClick={handleExportCompliance} disabled={complianceData.length === 0}>
              <FileDown className="mr-1.5 h-3.5 w-3.5" /> Export PDF
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${overallScore >= 75 ? "bg-success/10" : overallScore >= 50 ? "bg-warning/10" : "bg-destructive/10"}`}>
                  {overallScore >= 75 ? (
                    <CheckCircle2 className="h-6 w-6 text-success" />
                  ) : overallScore >= 50 ? (
                    <AlertTriangle className="h-6 w-6 text-warning" />
                  ) : (
                    <XCircle className="h-6 w-6 text-destructive" />
                  )}
                </div>
                <div>
                  <p className="text-2xl font-display font-bold">{overallScore}%</p>
                  <p className="text-xs text-muted-foreground">Overall Compliance</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold">{complianceData.length}</p>
                  <p className="text-xs text-muted-foreground">Companies Reviewed</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                  <AlertTriangle className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold">
                    {complianceData.reduce((s, c) => s + (c.total - c.passed), 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Open Items</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Per-company compliance */}
          {complianceData.map(({ company, checks, score, passed, total }) => (
            <Card key={company.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-sm">{company.name}</CardTitle>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-2 ${
                      score >= 75
                        ? "bg-success/10 text-success border-success/20"
                        : score >= 50
                        ? "bg-warning/10 text-warning border-warning/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                    }`}
                  >
                    {passed}/{total} — {score}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {checks.map((check) => (
                    <div
                      key={check.label}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                        check.pass
                          ? "border-success/20 bg-success/5 text-success"
                          : "border-destructive/20 bg-destructive/5 text-destructive"
                      }`}
                    >
                      {check.pass ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 shrink-0" />
                      )}
                      {check.label}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* SHAREHOLDERS TAB */}
        <TabsContent value="shareholders" className="mt-4">
          {shLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-sm">
                    Shareholder Summary ({shareholders.length})
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={handleExportShareholders} disabled={shareholders.length === 0} className="print:hidden">
                    <FileDown className="mr-1.5 h-3.5 w-3.5" /> Export PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Company</TableHead>
                      <TableHead className="text-xs">Address</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Date Added</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shareholders.map((sh: any) => (
                      <TableRow key={sh.id}>
                        <TableCell className="text-sm font-medium">{sh.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {sh.companies?.name || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {[sh.address, sh.city, sh.state, sh.zip].filter(Boolean).join(", ") || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              sh.status === "active"
                                ? "bg-success/10 text-success border-success/20"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {sh.status || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {sh.date_added
                            ? new Date(sh.date_added + "T00:00:00").toLocaleDateString()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {shareholders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
                          No shareholders found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* STOCK LEDGER TAB */}
        <TabsContent value="ledger" className="mt-4">
          {certLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-sm">
                    Stock Ledger ({certificates.length} certificates)
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={handleExportLedger} disabled={certificates.length === 0} className="print:hidden">
                    <FileDown className="mr-1.5 h-3.5 w-3.5" /> Export PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="text-xs">Cert #</TableHead>
                      <TableHead className="text-xs">Company</TableHead>
                      <TableHead className="text-xs">Shareholder</TableHead>
                      <TableHead className="text-xs">Class</TableHead>
                      <TableHead className="text-xs text-right">Shares</TableHead>
                      <TableHead className="text-xs text-right">Par Value</TableHead>
                      <TableHead className="text-xs">Issue Date</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {certificates.map((cert: any) => (
                      <TableRow key={cert.id}>
                        <TableCell className="text-sm font-mono font-medium">
                          #{cert.certificate_number}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {cert.companies?.name || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {cert.shareholders?.name || "—"}
                        </TableCell>
                        <TableCell className="text-xs">{cert.share_class}</TableCell>
                        <TableCell className="text-xs text-right font-mono">
                          {fmt(cert.num_shares)}
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono">
                          {fmtCurrency(cert.par_value)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {cert.issue_date
                            ? new Date(cert.issue_date + "T00:00:00").toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              cert.status === "active"
                                ? "bg-success/10 text-success border-success/20"
                                : "bg-destructive/10 text-destructive border-destructive/20"
                            }`}
                          >
                            {cert.status || "—"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {certificates.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
                          No stock certificates found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
