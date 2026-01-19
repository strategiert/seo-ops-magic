import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, XCircle, Settings2, Key, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useWorkspaceConvex } from "@/hooks/useWorkspaceConvex";
import {
  useProjectIntegrations,
  useSaveNeuronWriterIntegration,
} from "@/hooks/useProjectIntegrations";
import { listNWProjects, type NWProject } from "@/lib/api/neuronwriter";

const LANGUAGES = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "it", label: "Italiano" },
  { value: "pl", label: "Polski" },
];

const ENGINES = [
  { value: "google.de", label: "Google DE" },
  { value: "google.com", label: "Google US" },
  { value: "google.co.uk", label: "Google UK" },
  { value: "google.fr", label: "Google FR" },
  { value: "google.es", label: "Google ES" },
  { value: "google.it", label: "Google IT" },
  { value: "google.pl", label: "Google PL" },
];

export function NeuronWriterSetup() {
  const { toast } = useToast();
  const { currentProject } = useWorkspaceConvex();
  const { neuronwriter, loading: intLoading } = useProjectIntegrations();
  const saveNeuronWriter = useSaveNeuronWriterIntegration();

  const [nwProjects, setNwProjects] = useState<NWProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);

  // API Key state
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState(false);

  // Setup form state
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("de");
  const [selectedEngine, setSelectedEngine] = useState("google.de");
  const [saving, setSaving] = useState(false);

  // Get the effective API key (user input or stored)
  const getEffectiveApiKey = () => apiKey || neuronwriter?.nwApiKey || "";

  // Test API connection and load projects
  const testConnection = async (testApiKey?: string) => {
    const keyToUse = testApiKey || getEffectiveApiKey();
    if (!keyToUse) {
      setApiConnected(false);
      return [];
    }

    setTesting(true);
    try {
      const projects = await listNWProjects(keyToUse);
      setNwProjects(projects);
      setApiConnected(true);
      return projects;
    } catch (error) {
      console.error("NeuronWriter API test failed:", error);
      setApiConnected(false);
      toast({
        title: "Verbindung fehlgeschlagen",
        description: "API Key prüfen oder neuen Key eingeben.",
        variant: "destructive",
      });
      return [];
    } finally {
      setTesting(false);
    }
  };

  // Save API Key
  const handleSaveApiKey = async () => {
    if (!currentProject?._id || !apiKey.trim()) {
      toast({
        title: "API Key erforderlich",
        description: "Bitte gib einen gültigen API Key ein.",
        variant: "destructive",
      });
      return;
    }

    setSavingApiKey(true);
    try {
      // Test the key first
      const projects = await testConnection(apiKey.trim());

      if (projects.length > 0) {
        // Key works, save it
        await saveNeuronWriter(currentProject._id, {
          nwApiKey: apiKey.trim(),
        });

        toast({
          title: "API Key gespeichert",
          description: "NeuronWriter Verbindung erfolgreich.",
        });
        setApiKey(""); // Clear input after successful save
      }
    } catch (error) {
      console.error("Error saving API key:", error);
      toast({
        title: "Fehler beim Speichern",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setSavingApiKey(false);
    }
  };

  // Initial check on mount (only if API key is configured)
  useEffect(() => {
    if (neuronwriter?.nwApiKey) {
      testConnection(neuronwriter.nwApiKey);
    }
  }, [neuronwriter?.nwApiKey]);

  // Pre-fill form when editing existing config
  useEffect(() => {
    if (neuronwriter && isConfiguring) {
      setSelectedProject(neuronwriter.nwProjectId || "");
      setSelectedLanguage(neuronwriter.nwLanguage || "de");
      setSelectedEngine(neuronwriter.nwEngine || "google.de");
    }
  }, [neuronwriter, isConfiguring]);

  const startConfiguring = async () => {
    setLoadingProjects(true);
    const projects = await testConnection();
    setLoadingProjects(false);

    if (projects.length > 0) {
      setIsConfiguring(true);
      // Pre-fill with existing values if any
      if (neuronwriter) {
        setSelectedProject(neuronwriter.nwProjectId || "");
        setSelectedLanguage(neuronwriter.nwLanguage || "de");
        setSelectedEngine(neuronwriter.nwEngine || "google.de");
      }
    }
  };

  const handleSave = async () => {
    if (!currentProject?._id || !selectedProject) {
      toast({
        title: "Fehler",
        description: "Bitte wähle ein NeuronWriter Projekt aus.",
        variant: "destructive",
      });
      return;
    }

    const selectedNWProject = nwProjects.find((p) => p.id === selectedProject);
    if (!selectedNWProject) return;

    setSaving(true);
    try {
      await saveNeuronWriter(currentProject._id, {
        nwProjectId: selectedProject,
        nwProjectName: selectedNWProject.name,
        nwLanguage: selectedLanguage,
        nwEngine: selectedEngine,
      });

      toast({
        title: "Gespeichert",
        description: `NeuronWriter Projekt "${selectedNWProject.name}" wurde verknüpft.`,
      });

      setIsConfiguring(false);
    } catch (error) {
      console.error("Error saving NW integration:", error);
      toast({
        title: "Fehler beim Speichern",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!currentProject) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground">NeuronWriter</CardTitle>
          <CardDescription>Bitte wähle zuerst ein Projekt aus.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isConnected = neuronwriter?.isConnected && neuronwriter?.nwProjectId;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              NeuronWriter
              {apiConnected === true && isConnected && (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
              {apiConnected === false && <XCircle className="h-5 w-5 text-destructive" />}
            </CardTitle>
            <CardDescription>SEO Content-Optimierung und NLP-Keyword Analyse</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {intLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Lade Integration...
          </div>
        ) : isConfiguring ? (
          /* Configuration Form */
          <div className="space-y-4">
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
                    {nwProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sprache</Label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Suchmaschine</Label>
                <Select value={selectedEngine} onValueChange={setSelectedEngine}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENGINES.map((eng) => (
                      <SelectItem key={eng.value} value={eng.value}>
                        {eng.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={!selectedProject || saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Speichern
              </Button>
              <Button variant="outline" onClick={() => setIsConfiguring(false)}>
                Abbrechen
              </Button>
            </div>
          </div>
        ) : isConnected ? (
          /* Connected State */
          <div className="space-y-4">
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                ✓ NeuronWriter ist verbunden
              </p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <strong>Projekt:</strong> {neuronwriter.nwProjectName}
                </p>
                <p>
                  <strong>Sprache:</strong>{" "}
                  {LANGUAGES.find((l) => l.value === neuronwriter.nwLanguage)?.label ||
                    neuronwriter.nwLanguage}
                </p>
                <p>
                  <strong>Engine:</strong>{" "}
                  {ENGINES.find((e) => e.value === neuronwriter.nwEngine)?.label ||
                    neuronwriter.nwEngine}
                </p>
                <p>
                  <strong>API Key:</strong> ••••••••{neuronwriter.nwApiKey?.slice(-4) || "****"}
                </p>
                {neuronwriter.lastSyncAt && (
                  <p className="text-xs">
                    Letzter Sync: {new Date(neuronwriter.lastSyncAt).toLocaleString("de-DE")}
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" onClick={startConfiguring}>
              <Settings2 className="h-4 w-4 mr-2" />
              Konfiguration ändern
            </Button>
          </div>
        ) : (
          /* Not Connected State - API Key Input */
          <div className="space-y-4">
            {/* API Key Section */}
            <div className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium">API Key</Label>
              </div>

              {neuronwriter?.nwApiKey ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    API Key konfiguriert: ••••••••{neuronwriter.nwApiKey.slice(-4)}
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showApiKey ? "text" : "password"}
                        placeholder="Neuen API Key eingeben..."
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        disabled={savingApiKey}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button onClick={handleSaveApiKey} disabled={!apiKey.trim() || savingApiKey}>
                      {savingApiKey && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Ändern
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Gib deinen NeuronWriter API Key ein. Du findest ihn in deinem NeuronWriter
                    Account unter Settings → API.
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showApiKey ? "text" : "password"}
                        placeholder="API Key eingeben..."
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        disabled={savingApiKey}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button onClick={handleSaveApiKey} disabled={!apiKey.trim() || savingApiKey}>
                      {savingApiKey && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Speichern
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Connect Button */}
            {neuronwriter?.nwApiKey && apiConnected && (
              <>
                <p className="text-sm text-muted-foreground">
                  Verknüpfe ein NeuronWriter Projekt, um SEO Guidelines automatisch zu importieren.
                </p>
                <Button onClick={startConfiguring} disabled={testing || loadingProjects}>
                  {(testing || loadingProjects) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  NeuronWriter Projekt verbinden
                </Button>
              </>
            )}

            {apiConnected === false && neuronwriter?.nwApiKey && (
              <p className="text-sm text-destructive">
                API-Verbindung fehlgeschlagen. Bitte prüfe deinen API Key.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
