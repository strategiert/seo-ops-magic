import { useState, useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { Loader2, Check, AlertCircle, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceConvex } from "@/hooks/useWorkspaceConvex";
import {
  useProjectIntegrations,
  useUpdateNeuronWriterSyncTime,
} from "@/hooks/useProjectIntegrations";
import { api } from "../../../convex/_generated/api";
import {
  startNewQuery,
  getQueryGuidelines,
  type NWGuidelines,
} from "@/lib/api/neuronwriter";

interface BriefCreationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WizardStep = "keyword" | "analyzing" | "done" | "error" | "not-configured";

export const BriefCreationWizard = memo(function BriefCreationWizard({
  open,
  onOpenChange,
}: BriefCreationWizardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentProject } = useWorkspaceConvex();
  const { neuronwriter, loading: intLoading } = useProjectIntegrations();
  const updateSyncTime = useUpdateNeuronWriterSyncTime();

  // Convex mutations for content briefs
  const createBrief = useMutation(api.tables.contentBriefs.create);
  const updateBrief = useMutation(api.tables.contentBriefs.update);

  const [step, setStep] = useState<WizardStep>("keyword");
  const [keyword, setKeyword] = useState("");
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [createdBriefId, setCreatedBriefId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setKeyword("");
      setTitle("");
      setProgress(0);
      setProgressText("");
      setCreatedBriefId(null);
      setErrorMessage("");
      
      // Check if NW is configured
      if (!intLoading) {
        if (!neuronwriter?.isConnected || !neuronwriter?.nwProjectId) {
          setStep("not-configured");
        } else {
          setStep("keyword");
        }
      }
    }
  }, [open, intLoading, neuronwriter]);

  // Update step when integration loads
  useEffect(() => {
    if (open && !intLoading) {
      if (!neuronwriter?.isConnected || !neuronwriter?.nwProjectId) {
        setStep("not-configured");
      } else if (step === "not-configured") {
        setStep("keyword");
      }
    }
  }, [open, intLoading, neuronwriter, step]);

  const startAnalysis = async () => {
    if (!keyword.trim() || !currentProject?._id || !neuronwriter?.nwProjectId) {
      return;
    }

    if (!neuronwriter.nwApiKey) {
      toast({
        title: "API Key fehlt",
        description: "Bitte konfiguriere den NeuronWriter API Key in den Einstellungen.",
        variant: "destructive",
      });
      return;
    }

    const briefTitle = title.trim() || keyword.trim();

    setStep("analyzing");
    setProgress(5);
    setProgressText("Brief wird erstellt...");

    try {
      // Step 1: Create brief with status "pending" using Convex
      const briefId = await createBrief({
        projectId: currentProject._id,
        title: briefTitle,
        primaryKeyword: keyword.trim(),
        status: "pending",
      });

      setCreatedBriefId(briefId);
      setProgress(15);
      setProgressText("Starte NeuronWriter Analyse...");

      // Step 2: Start NeuronWriter query
      const { queryId } = await startNewQuery(
        neuronwriter.nwProjectId,
        keyword.trim(),
        neuronwriter.nwLanguage || "de",
        neuronwriter.nwEngine || "google.de",
        neuronwriter.nwApiKey
      );

      // Save query ID to brief for resume capability
      await updateBrief({
        id: briefId,
        nwQueryId: queryId,
      });

      setProgress(25);
      setProgressText("Analysiere Keyword bei NeuronWriter (ca. 60s)...");

      // Step 3: Poll for results with progress updates
      let pollCount = 0;
      const maxPolls = 20;

      const pollWithProgress = async (): Promise<NWGuidelines> => {
        for (let i = 0; i < maxPolls; i++) {
          pollCount++;
          // Update progress from 25% to 90%
          const pollProgress = 25 + (pollCount / maxPolls) * 65;
          setProgress(Math.min(pollProgress, 90));
          setProgressText(`Analysiere Keyword... (${pollCount}/${maxPolls})`);

          try {
            // Use the Convex-based API client
            const guidelines = await getQueryGuidelines(queryId, neuronwriter.nwApiKey!);

            if (guidelines.status === "ready" || (guidelines.terms && guidelines.terms.length > 0)) {
              return guidelines;
            }

            if (guidelines.status === "error") {
              throw new Error("NeuronWriter Analyse fehlgeschlagen");
            }
          } catch (e) {
            // Continue polling on temporary errors
            console.log("Poll attempt failed, retrying...", e);
          }

          // Wait 5 seconds before next poll
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

        throw new Error("Analyse-Timeout: Bitte versuche es erneut.");
      };

      const guidelines = await pollWithProgress();

      setProgress(95);
      setProgressText("Speichere Guidelines...");

      // Step 4: Save guidelines to brief and update status using Convex
      await updateBrief({
        id: briefId,
        nwGuidelines: guidelines,
        status: "draft",
        nwQueryId: undefined, // Clear query ID after success
      });

      // Update sync time
      if (neuronwriter.id) {
        await updateSyncTime(neuronwriter.id);
      }

      setProgress(100);
      setStep("done");

      toast({
        title: "Brief erstellt",
        description: `${guidelines.terms?.length || 0} SEO-Terme importiert.`,
      });

    } catch (error) {
      console.error("Brief creation error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Unbekannter Fehler");
      setStep("error");

      // Update brief status to draft on error (so user can still use it)
      if (createdBriefId) {
        await updateBrief({
          id: createdBriefId as any,
          status: "draft",
        });
      }
    }
  };

  const handleOpenBrief = () => {
    if (createdBriefId) {
      onOpenChange(false);
      navigate(`/briefs/${createdBriefId}`);
    }
  };

  const handleClose = () => {
    // If analyzing, don't allow close without confirmation
    if (step === "analyzing") {
      if (!confirm("Analyse läuft noch. Wirklich abbrechen?")) {
        return;
      }
    }
    onOpenChange(false);
  };

  const isConfigured = neuronwriter?.isConnected && neuronwriter?.nwProjectId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Neues Content Brief
          </DialogTitle>
          <DialogDescription>
            {step === "keyword" && "Gib das Keyword ein – NeuronWriter analysiert es automatisch."}
            {step === "analyzing" && "NeuronWriter analysiert das Keyword..."}
            {step === "done" && "Brief erfolgreich erstellt!"}
            {step === "error" && "Es ist ein Fehler aufgetreten."}
            {step === "not-configured" && "NeuronWriter ist nicht konfiguriert."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Not Configured */}
          {step === "not-configured" && (
            <div className="text-center py-4 space-y-4">
              <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Bitte konfiguriere zuerst NeuronWriter in den Projekt-Einstellungen.
                </p>
                <p className="text-xs text-muted-foreground">
                  Projekt → Einstellungen → Integrationen → NeuronWriter
                </p>
              </div>
            </div>
          )}

          {/* Keyword Input */}
          {step === "keyword" && isConfigured && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wizard-keyword">Primary Keyword *</Label>
                <Input
                  id="wizard-keyword"
                  placeholder="z.B. beste seo tools 2024"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wizard-title">Titel (optional)</Label>
                <Input
                  id="wizard-title"
                  placeholder="Wird aus Keyword generiert falls leer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                <p><strong>NW-Projekt:</strong> {neuronwriter?.nwProjectName}</p>
                <p><strong>Sprache:</strong> {neuronwriter?.nwLanguage?.toUpperCase()}</p>
                <p className="mt-2">
                  Nach dem Start wird automatisch eine NeuronWriter-Analyse 
                  durchgeführt (~60 Sekunden). Die SEO-Guidelines werden direkt 
                  in das Brief importiert.
                </p>
              </div>
            </div>
          )}

          {/* Analyzing */}
          {step === "analyzing" && (
            <div className="space-y-4 py-4">
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-sm font-medium mb-2">{progressText}</p>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                Bitte warte, bis die Analyse abgeschlossen ist.
              </p>
            </div>
          )}

          {/* Done */}
          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
                <Check className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-medium">SEO-Guidelines erfolgreich importiert!</p>
              <p className="text-xs text-muted-foreground mt-1">
                Das Brief ist jetzt bereit zur Bearbeitung.
              </p>
            </div>
          )}

          {/* Error */}
          {step === "error" && (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="h-14 w-14 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center mb-4">
                <AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-sm font-medium mb-2">Fehler bei der Analyse</p>
              <p className="text-xs text-muted-foreground text-center">
                {errorMessage}
              </p>
              {createdBriefId && (
                <p className="text-xs text-muted-foreground mt-3">
                  Das Brief wurde trotzdem erstellt. Du kannst die Guidelines später manuell importieren.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "keyword" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Abbrechen
              </Button>
              <Button 
                onClick={startAnalysis} 
                disabled={!keyword.trim() || !isConfigured}
              >
                Analyse starten
              </Button>
            </>
          )}

          {step === "analyzing" && (
            <Button variant="outline" onClick={handleClose}>
              Abbrechen
            </Button>
          )}

          {step === "done" && (
            <Button onClick={handleOpenBrief}>
              Brief öffnen
            </Button>
          )}

          {step === "error" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Schließen
              </Button>
              {createdBriefId && (
                <Button onClick={handleOpenBrief}>
                  Brief trotzdem öffnen
                </Button>
              )}
            </>
          )}

          {step === "not-configured" && (
            <Button onClick={() => navigate("/settings")}>
              Zu Einstellungen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
