import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  useProjectIntegrations,
  updateNeuronWriterSyncTime,
} from "@/hooks/useProjectIntegrations";
import {
  startNewQuery,
  pollQueryUntilReady,
  type NWGuidelines,
} from "@/lib/api/neuronwriter";

interface NeuronWriterImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyword: string;
  onImport: (guidelines: NWGuidelines) => void;
}

type ImportStep = "confirm" | "loading" | "done" | "not-configured";

export function NeuronWriterImport({
  open,
  onOpenChange,
  keyword,
  onImport,
}: NeuronWriterImportProps) {
  const { toast } = useToast();
  const { currentProject } = useWorkspace();
  const { neuronwriter, loading: intLoading, refetch } = useProjectIntegrations();

  const [step, setStep] = useState<ImportStep>("confirm");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState("");

  // Reset state when modal opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      // Determine initial step based on integration status
      if (intLoading) {
        setStep("loading");
        setImportProgress("Prüfe NeuronWriter-Konfiguration...");
      } else if (!neuronwriter?.isConnected || !neuronwriter?.nwProjectId) {
        setStep("not-configured");
      } else {
        setStep("confirm");
      }
    }
    onOpenChange(isOpen);
  };

  // Update step when integration loading completes
  if (open && !intLoading && step === "loading" && importProgress.includes("Prüfe")) {
    if (!neuronwriter?.isConnected || !neuronwriter?.nwProjectId) {
      setStep("not-configured");
    } else {
      setStep("confirm");
    }
  }

  const handleStartAnalysis = async () => {
    if (!neuronwriter?.nwProjectId || !keyword.trim()) {
      toast({
        title: "Fehler",
        description: "Keyword oder NeuronWriter-Projekt fehlt.",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setStep("loading");
    setImportProgress("Starte Keyword-Analyse...");

    try {
      // Start new query with configured project settings
      const { queryId } = await startNewQuery(
        neuronwriter.nwProjectId,
        keyword.trim(),
        neuronwriter.nwLanguage || "de",
        neuronwriter.nwEngine || "google.de"
      );

      setImportProgress("Analysiere Keyword (ca. 60 Sekunden)...");

      // Poll until ready
      const guidelines = await pollQueryUntilReady(queryId);

      // Update sync time
      if (neuronwriter.id) {
        await updateNeuronWriterSyncTime(neuronwriter.id);
        await refetch();
      }

      setStep("done");
      onImport(guidelines);

      toast({
        title: "Import erfolgreich",
        description: `${guidelines.terms?.length || 0} SEO-Terme importiert.`,
      });
    } catch (error) {
      console.error("Error during NW analysis:", error);
      toast({
        title: "Analyse fehlgeschlagen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
      setStep("confirm");
    } finally {
      setImporting(false);
    }
  };

  const isConfigured = neuronwriter?.isConnected && neuronwriter?.nwProjectId;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>NeuronWriter Guidelines importieren</DialogTitle>
          <DialogDescription>
            {isConfigured
              ? `Keyword "${keyword}" wird im Projekt "${neuronwriter?.nwProjectName}" analysiert.`
              : "NeuronWriter ist für dieses Projekt nicht konfiguriert."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Not Configured State */}
          {step === "not-configured" && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Bitte konfiguriere zuerst NeuronWriter in den{" "}
                <strong>Projekt-Einstellungen → Integrationen</strong>.
              </p>
              <p className="text-xs text-muted-foreground">
                Dort kannst du das NeuronWriter-Projekt einmalig auswählen.
                Danach wird der Import automatisch mit diesen Einstellungen durchgeführt.
              </p>
            </div>
          )}

          {/* Confirm State */}
          {step === "confirm" && isConfigured && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="text-sm">
                  <p><strong>Keyword:</strong> {keyword}</p>
                  <p><strong>NW-Projekt:</strong> {neuronwriter?.nwProjectName}</p>
                  <p><strong>Sprache:</strong> {neuronwriter?.nwLanguage?.toUpperCase()}</p>
                  <p><strong>Engine:</strong> {neuronwriter?.nwEngine}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Eine neue Analyse dauert ca. 60 Sekunden. Die Ergebnisse werden 
                automatisch in den Content Brief importiert.
              </p>
            </div>
          )}

          {/* Loading State */}
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">{importProgress}</p>
            </div>
          )}

          {/* Done State */}
          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
                <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-medium">Guidelines erfolgreich importiert!</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {step === "done" ? "Schließen" : "Abbrechen"}
          </Button>
          
          {step === "confirm" && isConfigured && (
            <Button onClick={handleStartAnalysis} disabled={importing}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Analyse starten
            </Button>
          )}

          {step === "not-configured" && (
            <Button onClick={() => onOpenChange(false)}>
              Zu Einstellungen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
