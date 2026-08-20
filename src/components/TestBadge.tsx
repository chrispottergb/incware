import { Badge } from "@/components/ui/badge";

/**
 * Small marker rendered next to a company name when `companies.is_test = true`.
 * Test companies are excluded from suggestion lists and can be purged.
 */
export default function TestBadge({ className = "" }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={`border-destructive/40 bg-destructive/10 text-destructive text-[9px] px-1.5 py-0 leading-tight uppercase tracking-wide ${className}`}
      title="Test company — excluded from reports and suggestion lists"
    >
      Test
    </Badge>
  );
}
