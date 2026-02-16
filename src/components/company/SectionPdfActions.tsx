import { Button } from "@/components/ui/button";
import { Eye, Download, Printer } from "lucide-react";
import {
  SectionPdfConfig,
  previewSectionPdf,
  downloadSectionPdf,
  printSectionPdf,
} from "@/lib/section-pdf";

interface Props {
  config: SectionPdfConfig;
}

export default function SectionPdfActions({ config }: Props) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Preview PDF"
        onClick={(e) => {
          e.preventDefault();
          previewSectionPdf(config);
        }}
      >
        <Eye className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Download PDF"
        onClick={(e) => {
          e.preventDefault();
          downloadSectionPdf(config);
        }}
      >
        <Download className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Print PDF"
        onClick={(e) => {
          e.preventDefault();
          printSectionPdf(config);
        }}
      >
        <Printer className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
