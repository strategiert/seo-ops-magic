import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useMutation } from "convex/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type ParsedProspect = {
  domain: string;
  url?: string;
  method?: string;
  contactEmail?: string;
  contactName?: string;
  contactPage?: string;
};

type ParseResult = {
  prospects: ParsedProspect[];
  invalidRows: number;
  headers: string[];
};

interface ProspectImportDialogProps {
  campaignId: Id<"outreachCampaigns">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseDomain(value: string): { domain: string; url?: string } {
  const candidate = value.trim();
  if (!candidate) return { domain: "" };

  if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
    try {
      const url = new URL(candidate);
      return {
        domain: url.hostname.replace(/^www\./, ""),
        url: candidate,
      };
    } catch {
      return { domain: "" };
    }
  }

  const domain = candidate
    .replace(/^www\./, "")
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .trim();

  return { domain };
}

function splitRow(line: string): string[] {
  return line.split(/[,\t;]/).map((part) => part.trim()).filter(Boolean);
}

function detectHeader(parts: string[]): string[] {
  const normalized = parts.map((part) => part.toLowerCase());
  const known = ["domain", "url", "method", "email", "contactemail", "contactname", "name", "contactpage"];
  return normalized.some((part) => known.includes(part)) ? normalized : [];
}

function parseProspectRows(input: string): ParseResult {
  const rows = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const firstParts = rows[0] ? splitRow(rows[0]) : [];
  const headers = detectHeader(firstParts);
  const dataRows = headers.length > 0 ? rows.slice(1) : rows;
  let invalidRows = 0;

  const prospects = dataRows
    .map((line) => {
      const parts = splitRow(line);
      const valueFor = (names: string[], fallbackIndex: number) => {
        const index = headers.findIndex((header) => names.includes(header));
        return index >= 0 ? parts[index] : parts[fallbackIndex];
      };

      const domainInput = valueFor(["domain", "url"], 0) || "";
      const { domain, url } = parseDomain(domainInput);
      const email = parts.find((part) => part.includes("@"));
      const method = parts.find((part) =>
        ["resource_page", "broken_link", "guest_post", "competitor_replication", "unlinked_mention"].includes(part)
      );
      const contactPage = parts.find((part) => part.startsWith("http") && part !== url);
      const contactName =
        valueFor(["contactname", "name"], 3) ||
        parts.find((part) => !part.includes("@") && !part.startsWith("http") && part !== method && part !== domainInput);

      const prospect = {
        domain,
        url,
        contactEmail: valueFor(["email", "contactemail"], -1) || email,
        method: valueFor(["method"], -1) || method,
        contactName,
        contactPage: valueFor(["contactpage"], -1) || contactPage,
      };
    })
    .filter((prospect) => {
      const valid = prospect.domain.length > 0;
      if (!valid) invalidRows += 1;
      return valid;
    });

  return { prospects, invalidRows, headers };
}

export function ProspectImportDialog({
  campaignId,
  open,
  onOpenChange,
}: ProspectImportDialogProps) {
  const { toast } = useToast();
  const createProspectsBatch = useMutation(api.tables.outreach.createProspectsBatch);
  const [input, setInput] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const parseResult = useMemo(() => parseProspectRows(input), [input]);
  const parsedProspects = parseResult.prospects;

  const handleClose = () => {
    if (!isImporting) {
      setInput("");
      onOpenChange(false);
    }
  };

  const handleImport = async () => {
    if (parsedProspects.length === 0) {
      toast({
        title: "Keine Prospects erkannt",
        description: "Bitte füge mindestens eine Domain oder URL ein.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      await createProspectsBatch({
        campaignId,
        prospects: parsedProspects,
      });

      toast({
        title: "Prospects importiert",
        description: `${parsedProspects.length} Einträge wurden hinzugefügt.`,
      });

      setInput("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error importing prospects:", error);
      toast({
        title: "Import fehlgeschlagen",
        description: "Die Prospects konnten nicht importiert werden.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Prospects importieren</DialogTitle>
          <DialogDescription>
            Eine Zeile pro Prospect. Spalten können mit Komma, Semikolon oder Tab getrennt sein.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={isImporting}
            rows={10}
            placeholder={"https://example.com/resources,resource_page,editor@example.com\nhttps://example.org/blog,guest_post\npartner-site.de"}
          />
          <p className="text-sm text-muted-foreground">
            Erkannte Prospects: {parsedProspects.length}
            {parseResult.invalidRows > 0 ? ` · Ungueltige Zeilen: ${parseResult.invalidRows}` : ""}
          </p>
          {parsedProspects.length > 0 && (
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">Vorschau</p>
              <div className="mt-2 space-y-1 text-muted-foreground">
                {parsedProspects.slice(0, 5).map((prospect) => (
                  <div key={`${prospect.domain}-${prospect.contactEmail || ""}`}>
                    {prospect.domain}
                    {prospect.contactName ? ` · ${prospect.contactName}` : ""}
                    {prospect.contactEmail ? ` · ${prospect.contactEmail}` : ""}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            Abbrechen
          </Button>
          <Button onClick={handleImport} disabled={isImporting || parsedProspects.length === 0}>
            {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isImporting ? "Importiere..." : "Importieren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
