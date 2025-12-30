import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Link2, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { listNWProjects } from "@/lib/api/neuronwriter";

export default function Settings() {
  const { toast } = useToast();
  const [nwConnected, setNwConnected] = useState<boolean | null>(null);
  const [nwTesting, setNwTesting] = useState(false);
  const [nwProjectCount, setNwProjectCount] = useState<number>(0);

  const testNeuronWriterConnection = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    setNwTesting(true);
    try {
      const projects = await listNWProjects();
      setNwConnected(true);
      setNwProjectCount(projects.length);
      if (!silent) {
        toast({
          title: "Verbindung erfolgreich",
          description: `${projects.length} NeuronWriter Projekte gefunden.`,
        });
      }
    } catch (error) {
      console.error("NeuronWriter connection test failed:", error);
      setNwConnected(false);
      if (!silent) {
        toast({
          title: "Verbindung fehlgeschlagen",
          description: error instanceof Error ? error.message : "API Key prüfen",
          variant: "destructive",
        });
      }
    } finally {
      setNwTesting(false);
    }
  };

  useEffect(() => {
    // silent check so the status stays consistent when navigating around
    void testNeuronWriterConnection({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Einstellungen</h1>
          <p className="text-muted-foreground">Projekt-Konfiguration und Integrationen</p>
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
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      NeuronWriter
                      {nwConnected === true && (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      )}
                      {nwConnected === false && (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                    </CardTitle>
                    <CardDescription>
                      SEO Content-Optimierung und NLP-Keyword Analyse
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>API Key Status</Label>
                  <p className="text-sm text-muted-foreground">
                    Der NeuronWriter API Key ist als Secret im Backend konfiguriert.
                    {nwConnected && ` ${nwProjectCount} Projekte verfügbar.`}
                  </p>
                </div>

                <Button 
                  onClick={() => testNeuronWriterConnection()} 
                  disabled={nwTesting}
                  variant={nwConnected ? "outline" : "default"}
                >
                  {nwTesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {nwConnected ? "Erneut testen" : "Verbindung testen"}
                </Button>

                {nwConnected && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium text-green-600">
                      ✓ NeuronWriter ist verbunden
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Du kannst jetzt SEO Guidelines in Content Briefs importieren.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

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

            <Card className="opacity-60">
              <CardHeader>
                <CardTitle className="text-muted-foreground">WordPress API</CardTitle>
                <CardDescription>
                  Direkte Veröffentlichung und Elementor Import (Demnächst)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" disabled>
                  Bald verfügbar
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="general" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Projekt-Einstellungen</CardTitle>
                <CardDescription>
                  Allgemeine Konfiguration für dieses Projekt
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain</Label>
                  <Input id="domain" placeholder="beispiel.de" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wpUrl">WordPress URL</Label>
                  <Input id="wpUrl" placeholder="https://beispiel.de/wp-json" />
                </div>
                <Button>Speichern</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
