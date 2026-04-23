import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link2, Settings as SettingsIcon, AlertCircle } from "lucide-react";
import { useMutation } from "convex/react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceConvex } from "@/hooks/useWorkspaceConvex";
import { NeuronWriterSetup } from "@/components/settings/NeuronWriterSetup";
import { WordPressSetup } from "@/components/settings/WordPressSetup";
import { GoogleSearchConsoleSetup } from "@/components/settings/GoogleSearchConsoleSetup";
import { api } from "../../convex/_generated/api";

const LANGUAGES = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
];

const COUNTRIES = [
  { value: "DE", label: "Deutschland" },
  { value: "AT", label: "Österreich" },
  { value: "CH", label: "Schweiz" },
  { value: "US", label: "USA" },
  { value: "GB", label: "UK" },
];

const DESIGN_PRESETS = [
  { value: "default", label: "Standard" },
  { value: "modern", label: "Modern" },
  { value: "minimal", label: "Minimal" },
  { value: "bold", label: "Bold" },
];

interface ProjectDefaults {
  domain: string;
  wpUrl: string;
  defaultLanguage: string;
  defaultCountry: string;
  defaultTonality: string;
  defaultTargetAudience: string;
  defaultDesignPreset: string;
}

export default function ProjectSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentProject } = useWorkspaceConvex();

  const updateProject = useMutation(api.tables.projects.update);

  const [defaults, setDefaults] = useState<ProjectDefaults>({
    domain: "",
    wpUrl: "",
    defaultLanguage: "de",
    defaultCountry: "DE",
    defaultTonality: "",
    defaultTargetAudience: "",
    defaultDesignPreset: "default",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentProject) {
      setDefaults({
        domain: currentProject.domain || "",
        wpUrl: currentProject.wpUrl || "",
        defaultLanguage: currentProject.defaultLanguage || "de",
        defaultCountry: currentProject.defaultCountry || "DE",
        defaultTonality: currentProject.defaultTonality || "",
        defaultTargetAudience: currentProject.defaultTargetAudience || "",
        defaultDesignPreset: currentProject.defaultDesignPreset || "default",
      });
    }
  }, [currentProject]);

  const saveDefaults = async () => {
    if (!currentProject?._id) return;
    setSaving(true);
    try {
      await updateProject({
        id: currentProject._id,
        domain: defaults.domain || undefined,
        wpUrl: defaults.wpUrl || undefined,
        defaultLanguage: defaults.defaultLanguage,
        defaultCountry: defaults.defaultCountry,
        defaultTonality: defaults.defaultTonality || undefined,
        defaultTargetAudience: defaults.defaultTargetAudience || undefined,
        defaultDesignPreset: defaults.defaultDesignPreset,
      });
      toast({
        title: "Gespeichert",
        description: "Projekt-Einstellungen wurden aktualisiert.",
      });
    } catch (error) {
      console.error("Error saving project defaults:", error);
      toast({
        title: "Fehler",
        description: "Einstellungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!currentProject) {
    return (
      <AppLayout title="Projekt nicht gefunden">
        <div className="flex flex-col items-center justify-center h-[50vh] text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Kein Projekt ausgewählt</h2>
          <p className="text-muted-foreground mb-4">
            Wähle ein Projekt, um die Einstellungen zu bearbeiten.
          </p>
          <Button onClick={() => navigate("/projects")}>Zu den Projekten</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Projekte", href: "/projects" },
        { label: currentProject.name, href: `/projects/${currentProject._id}` },
        { label: "Einstellungen" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Projekt-Einstellungen</h1>
          <p className="text-muted-foreground">
            Konfiguration für <strong>{currentProject.name}</strong>
          </p>
        </div>

        <Tabs defaultValue="integrations" className="w-full">
          <TabsList>
            <TabsTrigger value="integrations">
              <Link2 className="h-4 w-4 mr-2" />
              Integrationen
            </TabsTrigger>
            <TabsTrigger value="general">
              <SettingsIcon className="h-4 w-4 mr-2" />
              Allgemein
            </TabsTrigger>
          </TabsList>

          <TabsContent value="integrations" className="space-y-4 mt-4">
            <NeuronWriterSetup />
            <GoogleSearchConsoleSetup />
            <WordPressSetup />
          </TabsContent>

          <TabsContent value="general" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Projekt-Details</CardTitle>
                <CardDescription>
                  Allgemeine Konfiguration für "{currentProject.name}"
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="domain">Domain</Label>
                    <Input
                      id="domain"
                      placeholder="beispiel.de"
                      value={defaults.domain}
                      onChange={(e) =>
                        setDefaults({ ...defaults, domain: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wpUrl">WordPress URL</Label>
                    <Input
                      id="wpUrl"
                      placeholder="https://beispiel.de/wp-json"
                      value={defaults.wpUrl}
                      onChange={(e) =>
                        setDefaults({ ...defaults, wpUrl: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Standard-Sprache</Label>
                    <Select
                      value={defaults.defaultLanguage}
                      onValueChange={(v) =>
                        setDefaults({ ...defaults, defaultLanguage: v })
                      }
                    >
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
                    <Label>Standard-Land</Label>
                    <Select
                      value={defaults.defaultCountry}
                      onValueChange={(v) =>
                        setDefaults({ ...defaults, defaultCountry: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country.value} value={country.value}>
                            {country.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tonality">Standard-Tonalität</Label>
                    <Input
                      id="tonality"
                      placeholder="z.B. professionell, freundlich"
                      value={defaults.defaultTonality}
                      onChange={(e) =>
                        setDefaults({
                          ...defaults,
                          defaultTonality: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="audience">Standard-Zielgruppe</Label>
                    <Input
                      id="audience"
                      placeholder="z.B. B2B Entscheider"
                      value={defaults.defaultTargetAudience}
                      onChange={(e) =>
                        setDefaults({
                          ...defaults,
                          defaultTargetAudience: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Elementor Design-Preset</Label>
                  <Select
                    value={defaults.defaultDesignPreset}
                    onValueChange={(v) =>
                      setDefaults({ ...defaults, defaultDesignPreset: v })
                    }
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DESIGN_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={saveDefaults} disabled={saving}>
                  {saving ? "Speichern..." : "Speichern"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
