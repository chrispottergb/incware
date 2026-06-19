import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHead, TableHeader, TableRow, TableCell, TableBody } from "@/components/ui/table";
import {
  positioning,
  market,
  competitors,
  marketGap,
  personas,
  pricing,
  plays,
  ninetyDayPlan,
  kpis,
  risks,
  seoKeywords,
} from "@/data/strategy";
import { Download, TrendingUp, Target, Users, DollarSign, Map, AlertTriangle, Search } from "lucide-react";
import { CompetitorPricingTracker } from "@/components/strategy/CompetitorPricingTracker";

const PDF_PATH = "/strategy/entityIQ-GTM-Playbook.pdf";

export default function Strategy() {
  const navigate = useNavigate();
  const { isAdmin, isLoading } = useUserRole();
  const [tab, setTab] = useState("overview");

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold mb-2">Strategy</h1>
        <p className="text-sm text-muted-foreground">
          This area is admin-only. Contact your administrator if you need access.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/95">
      <div className="mx-auto max-w-[1400px] px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Internal · Admin only</p>
            <h1 className="text-3xl font-semibold tracking-tight">entityIQ Market Strategy</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
              Deep market research, ICPs, competitive landscape, pricing, and a 5-play go-to-market plan
              for entityIQ across solo attorneys, small law firms, CPA practices, registered agents,
              and DIY SMB owners — national US.
            </p>
          </div>
          <Button asChild variant="default" className="shrink-0">
            <a href={PDF_PATH} download>
              <Download className="h-4 w-4 mr-2" />
              Download full PDF playbook
            </a>
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-8 w-full mb-6">
            <TabsTrigger value="overview"><Target className="h-3.5 w-3.5 mr-1.5" />Overview</TabsTrigger>
            <TabsTrigger value="market"><TrendingUp className="h-3.5 w-3.5 mr-1.5" />Market</TabsTrigger>
            <TabsTrigger value="competitors"><Map className="h-3.5 w-3.5 mr-1.5" />Competitors</TabsTrigger>
            <TabsTrigger value="personas"><Users className="h-3.5 w-3.5 mr-1.5" />Personas</TabsTrigger>
            <TabsTrigger value="pricing"><DollarSign className="h-3.5 w-3.5 mr-1.5" />Pricing</TabsTrigger>
            <TabsTrigger value="plays"><TrendingUp className="h-3.5 w-3.5 mr-1.5" />GTM Plays</TabsTrigger>
            <TabsTrigger value="plan"><Map className="h-3.5 w-3.5 mr-1.5" />90-Day Plan</TabsTrigger>
            <TabsTrigger value="seo"><Search className="h-3.5 w-3.5 mr-1.5" />SEO & Risks</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Positioning</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base leading-relaxed mb-6">{positioning.oneLiner}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  {positioning.pillars.map((p) => (
                    <div key={p.title} className="rounded-lg border border-border bg-card/50 p-3">
                      <div className="text-[13px] font-semibold mb-1">{p.title}</div>
                      <div className="text-[12px] text-muted-foreground leading-relaxed">{p.body}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/40">
              <CardHeader>
                <CardTitle className="text-primary">{marketGap.headline}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{marketGap.body}</p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[market.tam, market.sam, market.som].map((m) => (
                <Card key={m.label}>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground">{m.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-semibold text-primary">{m.value}</div>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{m.detail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* MARKET */}
          <TabsContent value="market" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>US Entity & Professional Counts</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Population</TableHead>
                      <TableHead>Count</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {market.entityCounts.map((e) => (
                      <TableRow key={e.label}>
                        <TableCell className="font-medium">{e.label}</TableCell>
                        <TableCell className="font-mono text-primary">{e.value}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{e.source}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* COMPETITORS */}
          <TabsContent value="competitors" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Competitive Landscape</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Competitor</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Pricing</TableHead>
                      <TableHead>Strengths</TableHead>
                      <TableHead>Weaknesses</TableHead>
                      <TableHead>Threat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {competitors.map((c) => (
                      <TableRow key={c.name}>
                        <TableCell className="font-medium align-top">
                          <div>{c.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">{c.positioning}</div>
                        </TableCell>
                        <TableCell className="text-xs align-top">{c.buyer}</TableCell>
                        <TableCell className="text-xs align-top">{c.pricing}</TableCell>
                        <TableCell className="text-xs align-top">
                          <ul className="list-disc pl-4 space-y-0.5">
                            {c.strengths.map((s) => <li key={s}>{s}</li>)}
                          </ul>
                        </TableCell>
                        <TableCell className="text-xs align-top">
                          <ul className="list-disc pl-4 space-y-0.5">
                            {c.weaknesses.map((s) => <li key={s}>{s}</li>)}
                          </ul>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge
                            variant={c.threat === "High" ? "destructive" : c.threat === "Medium" ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {c.threat}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PERSONAS */}
          <TabsContent value="personas" className="space-y-4">
            {personas.map((p) => (
              <Card key={p.id}>
                <CardHeader>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <CardTitle>{p.name} — {p.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{p.segment} · {p.size}</p>
                    </div>
                    <Badge variant="outline" className="font-mono">{p.wtp}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-[12px]">
                    <div>
                      <div className="font-semibold mb-1.5 uppercase text-[10px] tracking-widest text-muted-foreground">Pains</div>
                      <ul className="list-disc pl-4 space-y-1">{p.pains.map((x) => <li key={x}>{x}</li>)}</ul>
                    </div>
                    <div>
                      <div className="font-semibold mb-1.5 uppercase text-[10px] tracking-widest text-muted-foreground">Jobs-to-be-done</div>
                      <ul className="list-disc pl-4 space-y-1">{p.jobs.map((x) => <li key={x}>{x}</li>)}</ul>
                    </div>
                    <div>
                      <div className="font-semibold mb-1.5 uppercase text-[10px] tracking-widest text-muted-foreground">Buying triggers</div>
                      <ul className="list-disc pl-4 space-y-1">{p.triggers.map((x) => <li key={x}>{x}</li>)}</ul>
                    </div>
                    <div className="md:col-span-2">
                      <div className="font-semibold mb-1.5 uppercase text-[10px] tracking-widest text-muted-foreground">Objection handling</div>
                      <div className="space-y-2">
                        {p.objections.map((o, i) => (
                          <div key={i} className="rounded border border-border p-2">
                            <div className="font-medium mb-0.5">"{o.objection}"</div>
                            <div className="text-muted-foreground">{o.response}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold mb-1.5 uppercase text-[10px] tracking-widest text-muted-foreground">Where to reach them</div>
                      <ul className="list-disc pl-4 space-y-1">{p.channels.map((x) => <li key={x}>{x}</li>)}</ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* PRICING */}
          <TabsContent value="pricing" className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">entityIQ proposed tiers</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {pricing.map((tier) => (
                  <Card key={tier.tier} className={tier.highlight ? "border-primary border-2" : ""}>
                    <CardHeader>
                      {tier.highlight && <Badge className="mb-2 w-fit">Recommended wedge</Badge>}
                      <CardTitle>{tier.tier}</CardTitle>
                      <div className="text-2xl font-semibold text-primary mt-2">{tier.price}</div>
                      <p className="text-xs text-muted-foreground mt-1">{tier.audience}</p>
                    </CardHeader>
                    <CardContent>
                      <ul className="text-[12px] space-y-1.5">
                        {tier.entitlements.map((e) => (
                          <li key={e} className="flex gap-2"><span className="text-primary">✓</span><span>{e}</span></li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            <CompetitorPricingTracker />
          </TabsContent>

          {/* PLAYS */}
          <TabsContent value="plays" className="space-y-4">
            {plays.map((play) => (
              <Card key={play.id}>
                <CardHeader>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <CardTitle>Play {play.id} — {play.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-2 max-w-3xl">{play.thesis}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Badge variant="outline">Effort: {play.effort}</Badge>
                      <Badge variant={play.impact === "High" ? "default" : "secondary"}>Impact: {play.impact}</Badge>
                      <Badge variant="outline">Payback: {play.payback}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[12px]">
                    <div>
                      <div className="font-semibold mb-1.5 uppercase text-[10px] tracking-widest text-muted-foreground">Motions</div>
                      <ul className="list-disc pl-4 space-y-1">{play.motions.map((m) => <li key={m}>{m}</li>)}</ul>
                    </div>
                    <div>
                      <div className="font-semibold mb-1.5 uppercase text-[10px] tracking-widest text-muted-foreground">Success KPIs</div>
                      <ul className="list-disc pl-4 space-y-1">{play.kpis.map((m) => <li key={m}>{m}</li>)}</ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* 90-DAY PLAN */}
          <TabsContent value="plan" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>First 90 Days — Week-by-Week</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Week</TableHead>
                      <TableHead className="w-40">Track</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead className="w-32">Owner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ninetyDayPlan.map((m, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono">W{m.week}</TableCell>
                        <TableCell><Badge variant="outline">{m.track}</Badge></TableCell>
                        <TableCell>{m.task}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{m.owner}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>KPI Dashboard</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      <TableHead>Definition</TableHead>
                      <TableHead>Year-1 Target</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kpis.map((k) => (
                      <TableRow key={k.name}>
                        <TableCell className="font-medium">{k.name}</TableCell>
                        <TableCell className="text-xs">{k.value}</TableCell>
                        <TableCell className="font-mono text-primary">{k.target}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SEO + RISKS */}
          <TabsContent value="seo" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Priority SEO Keywords (Semrush, US)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Keyword</TableHead>
                      <TableHead>Volume / mo</TableHead>
                      <TableHead>Difficulty</TableHead>
                      <TableHead>Intent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seoKeywords.map((k) => (
                      <TableRow key={k.keyword}>
                        <TableCell className="font-medium">{k.keyword}</TableCell>
                        <TableCell className="font-mono">{k.volume.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={k.kdi < 20 ? "default" : k.kdi < 40 ? "secondary" : "outline"}>
                            {k.kdi}/100
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{k.intent}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground mt-3">
                  Quick wins: own the zero-difficulty "corporate minute book software", "stock ledger software", and
                  "registered agent software" pages immediately. Compete for "entity management software" (KDI 21) within 90 days.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Risks & Mitigations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {risks.map((r) => (
                    <div key={r.risk} className="rounded border border-border p-3">
                      <div className="text-sm font-semibold mb-1">{r.risk}</div>
                      <div className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Mitigation:</span> {r.mitigation}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
