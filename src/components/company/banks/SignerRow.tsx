import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { InitialsAvatar } from "@/components/company/counsel/InitialsAvatar";

/** A single authorized signer listed inside a bank account card. */
export default function SignerRow({
  signer,
  onEdit,
  onDelete,
}: {
  signer: any;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const name = signer.signer_name as string;

  return (
    <div className="flex items-start justify-between gap-2 py-1.5">
      <div className="flex items-start gap-2 min-w-0">
        <InitialsAvatar name={name} />
        <div className="min-w-0">
          <p className="text-sm truncate">
            <span className="font-medium">{name}</span>
            {signer.title && <span className="text-muted-foreground"> — {signer.title}</span>}
          </p>
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit} aria-label={`Edit ${name}`}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive"
          onClick={onDelete}
          aria-label={`Delete ${name}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
