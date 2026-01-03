import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, XCircle, Settings2, Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  useProjectIntegrations,
  saveWordPressIntegration,
} from "@/hooks/useProjectIntegrations";

export function WordPressSetup() {
  const { toast } = useToast();
  const { currentProject } = useWorkspace();
  const { wordpress, loading: intLoading, refetch } = useProjectIntegrations();

  const [isConfiguring, setIsConfiguring] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [wpUrl, setWpUrl] = useState("");
  const [wpUsername, setWpUsername] = useState("");
  const [wpAppPassword, setWpAppPassword] = useState("");

  // Pre-fill form when editing existing config
  useEffect(() => {
    if (wordpress && isConfiguring) {
      setWpUrl(currentProject?.wp_url || "");
      setWpUsername(wordpress.wpUsername || "");
      setWpAppPassword(""); // Don't pre-fill password for security
    }
  }, [wordpress, isConfiguring, currentProject]);

  const testConnection = async (): Promise<{ success: boolean; siteName?: string }> => {
    if (!wpUrl || !wpUsername || !wpAppPassword) {
      toast({
        title: "Fehler",
        description: "Bitte alle Felder ausfüllen.",
        variant: "destructive",
      });
      return { success: false };
    }

    setTesting(true);
    try {
      // Normalize URL
      let baseUrl = wpUrl.trim();
      if (!baseUrl.startsWith("http")) {
        baseUrl = "https://" + baseUrl;
      }
      if (baseUrl.endsWith("/")) {
        baseUrl = baseUrl.slice(0, -1);
      }
      // Remove /wp-json suffix if user included it
      if (baseUrl.endsWith("/wp-json")) {
        baseUrl = baseUrl.slice(0, -8);
      }

      // Test connection by fetching current user
      const response = await fetch(`${baseUrl}/wp-json/wp/v2/users/me`, {
        headers: {
          Authorization: "Basic " + btoa(`${wpUsername}:${wpAppPassword}`),
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Authentifizierung fehlgeschlagen. Prüfe Username und App-Password.");
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const userData = await response.json();

      // Also try to get site info
      const siteResponse = await fetch(`${baseUrl}/wp-json`);
      const siteData = await siteResponse.json();

      toast({
        title: "Verbindung erfolgreich",
        description: `Verbunden als "${userData.name}" auf "${siteData.name}"`,
      });

      return { success: true, siteName: siteData.name };
    } catch (error) {
      console.error("WordPress connection test failed:", error);
      toast({
        title: "Verbindung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
      return { success: false };
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!currentProject?.id) {
      toast({
        title: "Fehler",
        description: "Kein Projekt ausgewählt.",
        variant: "destructive",
      });
      return;
    }

    // Test connection first
    const testResult = await testConnection();
    if (!testResult.success) {
      return;
    }

    setSaving(true);
    try {
      // Normalize URL
      let baseUrl = wpUrl.trim();
      if (!baseUrl.startsWith("http")) {
        baseUrl = "https://" + baseUrl;
      }
      if (baseUrl.endsWith("/")) {
        baseUrl = baseUrl.slice(0, -1);
      }
      // Remove /wp-json suffix if user included it
      if (baseUrl.endsWith("/wp-json")) {
        baseUrl = baseUrl.slice(0, -8);
      }

      await saveWordPressIntegration(currentProject.id, {
        wpUrl: baseUrl,
        wpUsername: wpUsername,
        wpAppPassword: wpAppPassword,
        wpSiteName: testResult.siteName || "",
      });

      toast({
        title: "Gespeichert",
        description: `WordPress "${testResult.siteName}" wurde verknüpft.`,
      });

      setIsConfiguring(false);
      setWpAppPassword(""); // Clear password from memory
      await refetch();
    } catch (error) {
      console.error("Error saving WordPress integration:", error);
      toast({
        title: "Fehler beim Speichern",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const startConfiguring = () => {
    setIsConfiguring(true);
    if (currentProject?.wp_url) {
      setWpUrl(currentProject.wp_url);
    }
    if (wordpress?.wpUsername) {
      setWpUsername(wordpress.wpUsername);
    }
  };

  if (!currentProject) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground">WordPress</CardTitle>
          <CardDescription>
            Bitte wähle zuerst ein Projekt aus.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isConnected = wordpress?.isConnected && wordpress?.wpIsVerified;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              WordPress
              {isConnected && (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
            </CardTitle>
            <CardDescription>
              Artikel direkt zu WordPress publishen
            </CardDescription>
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
              <Label htmlFor="wp-url">WordPress URL</Label>
              <Input
                id="wp-url"
                type="url"
                placeholder="https://example.com"
                value={wpUrl}
                onChange={(e) => setWpUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Die URL deiner WordPress-Seite (ohne /wp-json)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wp-username">Benutzername</Label>
              <Input
                id="wp-username"
                type="text"
                placeholder="admin"
                value={wpUsername}
                onChange={(e) => setWpUsername(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Dein WordPress <strong>Login-Name</strong> (nicht E-Mail oder Anzeigename)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wp-password">Application Password</Label>
              <Input
                id="wp-password"
                type="password"
                placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                value={wpAppPassword}
                onChange={(e) => setWpAppPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                WordPress → Benutzer → Profil → <strong>Application Passwords</strong> → Neues erstellen
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={!wpUrl || !wpUsername || !wpAppPassword || saving || testing}
              >
                {(saving || testing) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {testing ? "Teste..." : saving ? "Speichere..." : "Verbindung testen & speichern"}
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
                ✓ WordPress ist verbunden
              </p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Seite:</strong> {wordpress.wpSiteName || "Unbekannt"}</p>
                <p><strong>URL:</strong> {currentProject.wp_url}</p>
                <p><strong>Benutzer:</strong> {wordpress.wpUsername}</p>
              </div>
            </div>
            <Button variant="outline" onClick={startConfiguring}>
              <Settings2 className="h-4 w-4 mr-2" />
              Konfiguration ändern
            </Button>
          </div>
        ) : (
          /* Not Connected State */
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Verbinde deine WordPress-Seite, um Artikel direkt zu publishen.
            </p>
            <Button onClick={startConfiguring}>
              WordPress verbinden
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
