import { useState, useEffect } from "react";
import { Loader2, Search, RefreshCw, Check } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  listNWProjects,
  listNWQueries,
  startNewQuery,
  getQueryGuidelines,
  pollQueryUntilReady,
  type NWProject,
  type NWQuery,
  type NWGuidelines,
} from "@/lib/api/neuronwriter";

interface NeuronWriterImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyword: string;
  onImport: (guidelines: NWGuidelines) => void;
}

type ImportStep = "select-project" | "select-query" | "loading" | "done";

export function NeuronWriterImport({
  open,
  onOpenChange,
  keyword,
  onImport,
}: NeuronWriterImportProps) {
  const { toast } = useToast();

  const [step, setStep] = useState<ImportStep>("select-project");
  const [projects, setProjects] = useState<NWProject[]>([]);
  const [queries, setQueries] = useState<NWQuery[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedQuery, setSelectedQuery] = useState<string>("");
  const [newKeyword, setNewKeyword] = useState(keyword);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingQueries, setLoadingQueries] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState("");

  // Load projects when modal opens
  useEffect(() => {
    if (open) {
      loadProjects();
      setNewKeyword(keyword);
      setStep("select-project");
      setSelectedProject("");
      setSelectedQuery("");
    }
  }, [open, keyword]);

  // Load queries when project is selected
  useEffect(() => {
    if (selectedProject) {
      loadQueries(selectedProject);
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const data = await listNWProjects();
      setProjects(data);
    } catch (error) {
      console.error("Error loading NW projects:", error);
      toast({
        title: "Fehler",
        description: "NeuronWriter Projekte konnten nicht geladen werden. API Key prüfen.",
        variant: "destructive",
      });
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadQueries = async (projectId: string) => {
    setLoadingQueries(true);
    try {
      const data = await listNWQueries(projectId, "ready");
      setQueries(data);
      setStep("select-query");
    } catch (error) {
      console.error("Error loading NW queries:", error);
      toast({
        title: "Fehler",
        description: "Queries konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoadingQueries(false);
    }
  };

  const handleImportExisting = async () => {
    if (!selectedQuery) return;

    setImporting(true);
    setStep("loading");
    setImportProgress("Lade Guidelines...");

    try {
      const guidelines = await getQueryGuidelines(selectedQuery);
      setStep("done");
      onImport(guidelines);
    } catch (error) {
      console.error("Error importing guidelines:", error);
      toast({
        title: "Fehler",
        description: "Guidelines konnten nicht geladen werden.",
        variant: "destructive",
      });
      setStep("select-query");
    } finally {
      setImporting(false);
    }
  };

  const handleStartNewAnalysis = async () => {
    if (!selectedProject || !newKeyword.trim()) {
      toast({
        title: "Keyword fehlt",
        description: "Bitte gib ein Keyword ein.",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setStep("loading");
    setImportProgress("Starte Analyse...");

    try {
      const { queryId } = await startNewQuery(selectedProject, newKeyword.trim());
      
      setImportProgress("Analysiere Keyword (ca. 60 Sekunden)...");
      
      const guidelines = await pollQueryUntilReady(queryId);
      
      setStep("done");
      onImport(guidelines);
    } catch (error) {
      console.error("Error starting new analysis:", error);
      toast({
        title: "Analyse fehlgeschlagen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
      setStep("select-query");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>NeuronWriter Guidelines importieren</DialogTitle>
          <DialogDescription>
            Wähle ein NeuronWriter Projekt und lade SEO-Optimierungsdaten.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Step 1: Select Project */}
          <div className="space-y-2">
            <Label>NeuronWriter Projekt</Label>
            {loadingProjects ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Lade Projekte...
              </div>
            ) : (
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Projekt auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Step 2: Select Query or Enter New Keyword */}
          {selectedProject && step !== "loading" && step !== "done" && (
            <>
              <div className="space-y-2">
                <Label>Bestehende Analyse wählen</Label>
                {loadingQueries ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Lade Queries...
                  </div>
                ) : queries.length > 0 ? (
                  <Select value={selectedQuery} onValueChange={setSelectedQuery}>
                    <SelectTrigger>
                      <SelectValue placeholder="Query auswählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {queries.map((query) => (
                        <SelectItem key={query.id} value={query.id}>
                          {query.query}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Keine fertigen Analysen gefunden.
                  </p>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">oder</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-keyword">Neue Analyse starten</Label>
                <div className="flex gap-2">
                  <Input
                    id="new-keyword"
                    placeholder="Keyword eingeben..."
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    onClick={handleStartNewAnalysis}
                    disabled={!newKeyword.trim() || importing}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Eine neue Analyse dauert ca. 60 Sekunden.
                </p>
              </div>
            </>
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
          {selectedQuery && step === "select-query" && (
            <Button onClick={handleImportExisting} disabled={importing}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guidelines laden
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
