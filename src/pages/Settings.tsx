import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Link2, AlertCircle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { NeuronWriterSetup } from "@/components/settings/NeuronWriterSetup";
import { WordPressSetup } from "@/components/settings/WordPressSetup";

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

export default function Settings() {
  const { toast } = useToast();
  const { currentProject } = useWorkspace();

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
  const [loading, setLoading] = useState(true);

  // Load project defaults
  useEffect(() => {
    const loadDefaults = async () => {
      if (!currentProject?.id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("projects")
          .select("domain, wp_url, default_language, default_country, default_tonality, default_target_audience, default_design_preset")
          .eq("id", currentProject.id)
          .single();

        if (error) throw error;

        if (data) {
          setDefaults({
            domain: data.domain || "",
            wpUrl: data.wp_url || "",
            defaultLanguage: data.default_language || "de",
            defaultCountry: data.default_country || "DE",
            defaultTonality: data.default_tonality || "",
            defaultTargetAudience: data.default_target_audience || "",
            defaultDesignPreset: data.default_design_preset || "default",
          });
        }
      } catch (error) {
        console.error("Error loading project defaults:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDefaults();
  }, [currentProject?.id]);

  const saveDefaults = async () => {
    if (!currentProject?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          domain: defaults.domain || null,
          wp_url: defaults.wpUrl || null,
          default_language: defaults.defaultLanguage,
          default_country: defaults.defaultCountry,
          default_tonality: defaults.defaultTonality || null,
          default_target_audience: defaults.defaultTargetAudience || null,
          default_design_preset: defaults.defaultDesignPreset,
        })
        .eq("id", currentProject.id);

      if (error) throw error;

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
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Kein Projekt ausgewählt</h2>
          <p className="text-muted-foreground">
            Bitte wähle zuerst ein Projekt aus, um die Einstellungen zu bearbeiten.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Einstellungen</h1>
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
            {/* NeuronWriter Integration */}
            <NeuronWriterSetup />

            {/* Future integrations placeholder */}
            <Card className="opacity-60">
              <CardHeader>
                <CardTitle className="text-muted-foreground">Google Search Console</CardTitle>
                <CardDescription>
                  Performance-Daten und Keyword-Rankings (Demnächst)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" disabled>
                  Bald verfügbar
                </Button>
              </CardContent>
            </Card>

            {/* WordPress Integration */}
            <WordPressSetup />
          </TabsContent>

          <TabsContent value="general" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Projekt-Einstellungen</CardTitle>
                <CardDescription>
                  Allgemeine Konfiguration für "{currentProject.name}"
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Domain & WordPress */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="domain">Domain</Label>
                    <Input
                      id="domain"
                      placeholder="beispiel.de"
                      value={defaults.domain}
                      onChange={(e) => setDefaults({ ...defaults, domain: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wpUrl">WordPress URL</Label>
                    <Input
                      id="wpUrl"
                      placeholder="https://beispiel.de/wp-json"
                      value={defaults.wpUrl}
                      onChange={(e) => setDefaults({ ...defaults, wpUrl: e.target.value })}
                    />
                  </div>
                </div>

                {/* Language & Country */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Standard-Sprache</Label>
                    <Select
                      value={defaults.defaultLanguage}
                      onValueChange={(v) => setDefaults({ ...defaults, defaultLanguage: v })}
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
                      onValueChange={(v) => setDefaults({ ...defaults, defaultCountry: v })}
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

                {/* Tonality & Target Audience */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tonality">Standard-Tonalität</Label>
                    <Input
                      id="tonality"
                      placeholder="z.B. professionell, freundlich"
                      value={defaults.defaultTonality}
                      onChange={(e) => setDefaults({ ...defaults, defaultTonality: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="audience">Standard-Zielgruppe</Label>
                    <Input
                      id="audience"
                      placeholder="z.B. B2B Entscheider"
                      value={defaults.defaultTargetAudience}
                      onChange={(e) => setDefaults({ ...defaults, defaultTargetAudience: e.target.value })}
                    />
                  </div>
                </div>

                {/* Design Preset */}
                <div className="space-y-2">
                  <Label>Elementor Design-Preset</Label>
                  <Select
                    value={defaults.defaultDesignPreset}
                    onValueChange={(v) => setDefaults({ ...defaults, defaultDesignPreset: v })}
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
