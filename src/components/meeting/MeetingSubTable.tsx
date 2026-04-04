import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Trash2, Loader2, Pencil, ChevronsUpDown, Check, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useZipLookup } from "@/hooks/useZipLookup";
import { useAddressBook } from "@/hooks/useAddressBook";
import AddressAutocomplete from "@/components/AddressAutocomplete";

interface Column {
  key: string;
  label: string;
  type?: "number" | "text" | "select";
  options?: string[];
  required?: boolean;
  wide?: boolean;
  width?: string;
}

export interface RosterRecord {
  id: string;
  name: string;
  [key: string]: any;
}

interface Props {
  meetingId: string;
  tableName: string;
  title: string;
  columns: Column[];
  displayRows?: any[];
  /** When provided for meeting_directors, syncs new directors to company-level directors table */
  companyId?: string;
  /** When provided, the Add dialog uses a roster picker instead of manual entry for the name/address fields */
  roster?: RosterRecord[];
  /** Maps roster field keys to column keys, e.g. { name: "shareholder_name", address: "address" } */
  rosterFieldMap?: Record<string, string>;
  /** Called when user creates a new roster entry inline; should insert into the master table and return the new RosterRecord */
  onCreateNewRosterEntry?: (formData: Record<string, any>) => Promise<RosterRecord | null>;
}

export default function MeetingSubTable({ meetingId, tableName, title, columns, displayRows, companyId, roster, rosterFieldMap, onCreateNewRosterEntry }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [creatingNew, setCreatingNew] = useState(false);
  const [rosterPickerOpen, setRosterPickerOpen] = useState(false);
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);
  const [isCreatingEntry, setIsCreatingEntry] = useState(false);

  // Zip lookup for inline create form
  const { handleZipChange: zipLookup } = useZipLookup((result) => {
    setForm((p) => ({ ...p, ...(rosterFieldMap ? {} : {}), city: result.city, state: result.state }));
    // Also update via rosterFieldMap keys if present
    if (rosterFieldMap) {
      const cityKey = Object.entries(rosterFieldMap).find(([k]) => k === "city")?.[1];
      const stateKey = Object.entries(rosterFieldMap).find(([k]) => k === "state")?.[1];
      setForm((p) => ({
        ...p,
        ...(cityKey ? { [cityKey]: result.city } : { city: result.city }),
        ...(stateKey ? { [stateKey]: result.state } : { state: result.state }),
      }));
    }
  });

  // Address book for inline create form
  const { searchAddressBook, getCompanySplitIndex, upsertEntry } = useAddressBook(companyId);

  const { data: rows = [] } = useQuery({
    queryKey: [tableName, meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tableName as any)
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const renderedRows = displayRows ?? rows;

  // Filter roster to exclude already-added names
  const existingNamesLower = useMemo(() => {
    const nameCol = rosterFieldMap ? Object.entries(rosterFieldMap).find(([k]) => k === "name")?.[1] : undefined;
    if (!nameCol) return new Set<string>();
    return new Set(rows.map((r: any) => (r[nameCol] || "").toLowerCase().trim()));
  }, [rows, rosterFieldMap]);

  const availableRoster = useMemo(() => {
    if (!roster) return [];
    return roster.filter((r) => !existingNamesLower.has(r.name.toLowerCase().trim()));
  }, [roster, existingNamesLower]);

  const buildPayload = () => {
    const payload: Record<string, any> = { meeting_id: meetingId };
    columns.forEach((col) => {
      const val = form[col.key] || "";
      if (col.type === "number") {
        payload[col.key] = val ? parseFloat(val) : null;
      } else {
        payload[col.key] = val || null;
      }
    });
    return payload;
  };

  const syncDirectorToCompany = async (directorName: string) => {
    if (tableName !== "meeting_directors" || !companyId || !directorName) return;
    const { data: existing } = await supabase
      .from("directors")
      .select("id")
      .eq("company_id", companyId)
      .ilike("name", directorName.trim());
    if (!existing || existing.length === 0) {
      await supabase.from("directors").insert({
        company_id: companyId,
        name: directorName.trim(),
        added_date: new Date().toISOString().split("T")[0],
      });
      queryClient.invalidateQueries({ queryKey: ["directors", companyId] });
    }
  };

  const addRow = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      const { error } = await supabase.from(tableName as any).insert(payload as any);
      if (error) throw error;
      if (tableName === "meeting_directors" && payload.director_name) {
        await syncDirectorToCompany(payload.director_name);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName, meetingId] });
      closeDialog();
      toast.success("Added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateRow = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      delete payload.meeting_id;
      const { error } = await supabase.from(tableName as any).update(payload as any).eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName, meetingId] });
      closeDialog();
      toast.success("Updated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteRow = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from(tableName as any).delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName, meetingId] });
      toast.success("Removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm({});
    setSelectedRosterId(null);
  };

  const openEdit = (row: any) => {
    setEditingId(row.id);
    const f: Record<string, string> = {};
    columns.forEach((col) => {
      f[col.key] = row[col.key] != null ? String(row[col.key]) : "";
    });
    setForm(f);
    setDialogOpen(true);
  };

  const applyRosterPersonToForm = useCallback((person: RosterRecord, preserveExisting = false) => {
    if (!rosterFieldMap) return;

    setForm((prev) => {
      const next = preserveExisting ? { ...prev } : {};

      Object.entries(rosterFieldMap).forEach(([rosterKey, formKey]) => {
        const val = person[rosterKey];
        if (val != null) {
          next[formKey] = String(val);
        }
      });

      return next;
    });
  }, [rosterFieldMap]);

  const handleSelectRosterPerson = (person: RosterRecord) => {
    applyRosterPersonToForm(person);
    setSelectedRosterId(person.id);
    setRosterPickerOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateRow.mutate();
    } else {
      addRow.mutate();
    }
  };

  const isPending = addRow.isPending || updateRow.isPending;

  // Check if we're in roster-picker mode (adding, not editing, with roster provided)
  const useRosterPicker = !!roster && !editingId;

  useEffect(() => {
    if (!useRosterPicker || !selectedRosterId || !roster) return;

    const selectedPerson = roster.find((person) => person.id === selectedRosterId);
    if (!selectedPerson) return;

    applyRosterPersonToForm(selectedPerson, true);
  }, [applyRosterPersonToForm, roster, selectedRosterId, useRosterPicker]);

  // Determine which column keys are auto-filled by roster
  const rosterAutoFilledKeys = useMemo(() => {
    if (!rosterFieldMap) return new Set<string>();
    return new Set(Object.values(rosterFieldMap));
  }, [rosterFieldMap]);

  const renderField = (col: Column) => {
    if (col.type === "select" && col.options) {
      return (
        <Select value={form[col.key] ?? ""} onValueChange={(v) => setForm((p) => ({ ...p, [col.key]: v }))}>
          <SelectTrigger className="bg-background"><SelectValue placeholder={`Select ${col.label}...`} /></SelectTrigger>
          <SelectContent className="bg-popover z-50 max-h-[300px]">
            {col.options.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (col.wide) {
      return (
        <Textarea
          value={form[col.key] ?? ""}
          onChange={(e) => setForm((p) => ({ ...p, [col.key]: e.target.value }))}
          required={col.required}
          rows={3}
        />
      );
    }
    return (
      <Input
        type={col.type === "number" ? "number" : "text"}
        step={col.type === "number" ? "0.01" : undefined}
        value={form[col.key] ?? ""}
        onChange={(e) => setForm((p) => ({ ...p, [col.key]: e.target.value }))}
        required={col.required}
      />
    );
  };


  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="font-display text-base">{title}</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setForm({}); setSelectedRosterId(null); }}>
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{editingId ? `Edit ${title}` : `Add ${title}`}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Roster picker when adding */}
              {useRosterPicker && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Select from Roster</Label>
                  <Popover open={rosterPickerOpen} onOpenChange={setRosterPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={rosterPickerOpen}
                        className="w-full justify-between font-normal"
                      >
                        {selectedRosterId
                          ? availableRoster.find((p) => p.id === selectedRosterId)?.name || roster?.find((p) => p.id === selectedRosterId)?.name || "Selected"
                          : "Search roster..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search by name..." />
                        <CommandList>
                          <CommandEmpty>No matching records.</CommandEmpty>
                          <CommandGroup>
                            {availableRoster.map((person) => (
                              <CommandItem
                                key={person.id}
                                value={person.name}
                                onSelect={() => handleSelectRosterPerson(person)}
                              >
                                <Check className={cn("mr-2 h-4 w-4", selectedRosterId === person.id ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{person.name}</span>
                                  {person.address && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {[person.address, person.city, person.state, person.zip].filter(Boolean).join(", ")}
                                    </span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {availableRoster.length === 0 && (
                    <p className="text-xs text-muted-foreground">All roster members have been added.</p>
                  )}
                </div>
              )}

              {/* Show remaining editable fields (non-roster-auto-filled when in roster mode, or all fields when editing) */}
              {columns.map((col) => {
                // In roster picker mode, hide auto-filled fields but show them as read-only summary
                if (useRosterPicker && rosterAutoFilledKeys.has(col.key)) {
                  return null;
                }
                return (
                  <div key={col.key} className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">{col.label}</Label>
                    {renderField(col)}
                  </div>
                );
              })}

              {/* Show auto-populated summary when a roster person is selected */}
              {useRosterPicker && selectedRosterId && (
                <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
                  <p className="text-[10px] uppercase font-medium text-muted-foreground">Auto-populated from roster</p>
                  {columns.filter(c => rosterAutoFilledKeys.has(c.key) && form[c.key]).map(col => (
                    <div key={col.key} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{col.label}:</span>
                      <span className="font-medium">{form[col.key]}</span>
                    </div>
                  ))}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isPending || (useRosterPicker && !selectedRosterId)}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? "Save Changes" : "Add"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {renderedRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center">
            <p className="text-sm text-muted-foreground">No entries yet</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {columns.map((col) => (
                    <TableHead key={col.key} className={col.type === "number" ? "text-right" : ""} style={col.width ? { width: col.width, minWidth: col.width } : undefined}>
                      {col.label}
                    </TableHead>
                  ))}
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {renderedRows.map((row: any) => (
                  <TableRow key={row.id}>
                    {columns.map((col) => (
                      <TableCell key={col.key} className={`whitespace-nowrap ${col.type === "number" ? "text-right font-mono text-sm" : ""}`} style={col.width ? { width: col.width, minWidth: col.width } : undefined}>
                        {col.type === "number" && row[col.key] != null
                          ? Number(row[col.key]).toLocaleString("en-US", { minimumFractionDigits: 2 })
                          : row[col.key] ?? "—"}
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteRow.mutate(row.id)}
                          className="h-8 w-8 text-destructive/60 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
