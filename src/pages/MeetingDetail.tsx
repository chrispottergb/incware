import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Loader2 } from "lucide-react";
import MeetingInfoCard from "@/components/meeting/MeetingInfoCard";
import MeetingFinancials from "@/components/meeting/MeetingFinancials";
import MeetingSubTable from "@/components/meeting/MeetingSubTable";
import MeetingResolutions from "@/components/meeting/MeetingResolutions";

export default function MeetingDetail() {
  const { id, meetingId } = useParams<{ id: string; meetingId: string }>();
  const navigate = useNavigate();

  const { data: meeting, isLoading } = useQuery({
    queryKey: ["meeting", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("id", meetingId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!meetingId,
  });

  const { data: company } = useQuery({
    queryKey: ["company", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Calendar className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Meeting not found.</p>
        <Button variant="outline" size="sm" onClick={() => navigate(`/company/${id}`)}>
          Back to Company
        </Button>
      </div>
    );
  }

  const subTabs = [
    { value: "info", label: "Meeting Info" },
    { value: "financials", label: "Financial" },
    { value: "shareholders", label: "Shrhlds/Members" },
    { value: "directors", label: "Directors" },
    { value: "officers", label: "Officers" },
    { value: "counsel", label: "Counsel" },
    { value: "assets", label: "Assets" },
    { value: "amendments", label: "Amendments" },
    { value: "resolutions", label: "Resolutions" },
    { value: "benefits", label: "Benefits" },
    { value: "other", label: "Other" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/company/${id}`)}
          className="mt-0.5 shrink-0 h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-display text-xl font-bold tracking-tight">
              {meeting.meeting_type}
            </h1>
            {meeting.sub_type && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{meeting.sub_type}</Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {company?.name} · {new Date(meeting.meeting_date + "T00:00:00").toLocaleDateString()}
            {meeting.tax_year && ` · Tax Year ${meeting.tax_year}`}
          </p>
        </div>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <div className="border-b border-border overflow-x-auto">
          <TabsList className="h-auto w-max justify-start gap-0 rounded-none bg-transparent p-0">
            {subTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent px-3 py-2.5 text-[11px] sm:text-xs font-medium text-muted-foreground whitespace-nowrap transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="info" className="mt-5">
          <MeetingInfoCard meeting={meeting} />
        </TabsContent>
        <TabsContent value="financials" className="mt-5">
          <MeetingFinancials meetingId={meeting.id} />
        </TabsContent>
        <TabsContent value="shareholders" className="mt-5">
          <MeetingSubTable meetingId={meeting.id} tableName="meeting_shareholders" title="Shareholders / Members"
            columns={[
              { key: "shareholder_name", label: "Name", required: true },
              { key: "common_shares", label: "Common Shares", type: "number" },
              { key: "preferred_shares", label: "Preferred Shares", type: "number" },
              { key: "distribution", label: "Distribution" },
            ]}
          />
        </TabsContent>
        <TabsContent value="directors" className="mt-5">
          <MeetingSubTable meetingId={meeting.id} tableName="meeting_directors" title="Directors"
            columns={[{ key: "director_name", label: "Director Name", required: true }]}
          />
        </TabsContent>
        <TabsContent value="officers" className="mt-5">
          <MeetingSubTable meetingId={meeting.id} tableName="meeting_officers" title="Officers"
            columns={[
              { key: "title", label: "Title", required: true },
              { key: "name", label: "Name", required: true },
            ]}
          />
        </TabsContent>
        <TabsContent value="counsel" className="mt-5">
          <MeetingSubTable meetingId={meeting.id} tableName="meeting_counsel" title="Counsel / Banking / Loans"
            columns={[
              { key: "counsel_name", label: "Counsel" },
              { key: "bank_name", label: "Bank" },
              { key: "loans", label: "Loans" },
            ]}
          />
        </TabsContent>
        <TabsContent value="assets" className="mt-5">
          <MeetingSubTable meetingId={meeting.id} tableName="meeting_assets" title="Vehicles / Equipment / Leases / Property"
            columns={[
              { key: "asset_type", label: "Type", required: true },
              { key: "description", label: "Description", required: true },
              { key: "value", label: "Value", type: "number" },
            ]}
          />
        </TabsContent>
        <TabsContent value="amendments" className="mt-5">
          <MeetingSubTable meetingId={meeting.id} tableName="meeting_amendments" title="Amendments"
            columns={[{ key: "amendment_text", label: "Amendment", required: true, wide: true }]}
          />
        </TabsContent>
        <TabsContent value="resolutions" className="mt-5">
          <MeetingResolutions meetingId={meeting.id} />
        </TabsContent>
        <TabsContent value="benefits" className="mt-5">
          <MeetingSubTable meetingId={meeting.id} tableName="meeting_benefits" title="Benefits"
            columns={[{ key: "benefit_description", label: "Benefit Description", required: true, wide: true }]}
          />
        </TabsContent>
        <TabsContent value="other" className="mt-5">
          <MeetingSubTable meetingId={meeting.id} tableName="meeting_other" title="Other Notes"
            columns={[{ key: "notes", label: "Notes", required: true, wide: true }]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
