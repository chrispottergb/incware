import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";

interface ResourcesPanelProps {
  category: string;
  onClose: () => void;
}

export default function ResourcesPanel({ category, onClose }: ResourcesPanelProps) {
  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["resources", category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .eq("category", category)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-[480px] max-w-[90vw] bg-card border-l border-border shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">{category}</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-8">
            {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

            {resources.map((r) => (
              <article key={r.id} className="space-y-2">
                {r.content_type === "markdown" && r.content && (
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground/80 prose-li:text-foreground/80 prose-strong:text-foreground prose-code:text-primary prose-td:text-foreground/80 prose-th:text-foreground/80">
                    <ReactMarkdown>{r.content}</ReactMarkdown>
                  </div>
                )}

                {r.content_type === "html" && r.content && (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: r.content }}
                  />
                )}

                {r.content_type === "pdf" && r.content_url && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">{r.title}</h3>
                    <iframe
                      src={r.content_url}
                      className="w-full h-[500px] rounded-md border border-border"
                      title={r.title}
                    />
                  </div>
                )}

                {r.content_type === "image" && r.content_url && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">{r.title}</h3>
                    <img
                      src={r.content_url}
                      alt={r.title}
                      className="w-full rounded-md border border-border"
                      loading="lazy"
                    />
                  </div>
                )}

                {r.content_type === "link" && r.content_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={r.content_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      {r.title}
                    </a>
                  </Button>
                )}
              </article>
            ))}

            {!isLoading && resources.length === 0 && (
              <p className="text-sm text-muted-foreground">No resources in this category yet.</p>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
