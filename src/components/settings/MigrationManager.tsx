import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database, Play, CheckCircle2, Clock, AlertCircle, RefreshCw } from "lucide-react";

interface Migration {
  version: string;
  name: string;
  executed_at?: string;
}

interface MigrationStatus {
  pending: Migration[];
  completed: Migration[];
  total: number;
}

export function MigrationManager() {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const { toast } = useToast();

  const fetchMigrations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-migrations', {
        body: { action: 'list' }
      });

      if (error) throw error;
      setStatus(data);
    } catch (error: any) {
      console.error('Error fetching migrations:', error);
      toast({
        title: "Fehler",
        description: "Konnte Migrationen nicht laden: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMigrations();
  }, []);

  const runMigrations = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-migrations', {
        body: { action: 'run' }
      });

      if (error) throw error;

      const successCount = data.results.filter((r: any) => r.success).length;
      const failCount = data.results.filter((r: any) => !r.success).length;

      if (failCount > 0) {
        toast({
          title: "Migrationen teilweise fehlgeschlagen",
          description: `${successCount} erfolgreich, ${failCount} fehlgeschlagen`,
          variant: "destructive",
        });
      } else if (successCount > 0) {
        toast({
          title: "Migrationen erfolgreich",
          description: `${successCount} Migration(en) ausgeführt`,
        });
      } else {
        toast({
          title: "Keine Migrationen",
          description: "Alle Migrationen wurden bereits ausgeführt",
        });
      }

      await fetchMigrations();
    } catch (error: any) {
      console.error('Error running migrations:', error);
      toast({
        title: "Fehler",
        description: "Migrationen fehlgeschlagen: " + error.message,
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Datenbank-Migrationen</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchMigrations} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription>
          Verwalte Datenbankschema-Änderungen sicher über die App
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : status ? (
          <>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{status.completed.length} ausgeführt</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span>{status.pending.length} ausstehend</span>
              </div>
            </div>

            {status.pending.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Ausstehende Migrationen:</h4>
                <div className="space-y-1">
                  {status.pending.map((m) => (
                    <div key={m.version} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50">
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                      <span className="font-mono text-xs">{m.version}</span>
                      <span>{m.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {status.completed.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Ausgeführte Migrationen:</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {status.completed.map((m) => (
                    <div key={m.version} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/30">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="font-mono text-xs">{m.version}</span>
                      <span>{m.name}</span>
                      {m.executed_at && (
                        <Badge variant="outline" className="ml-auto text-xs">
                          {new Date(m.executed_at).toLocaleDateString('de-DE')}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button 
              onClick={runMigrations} 
              disabled={running || status.pending.length === 0}
              className="w-full"
            >
              {running ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Führe Migrationen aus...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  {status.pending.length > 0 
                    ? `${status.pending.length} Migration(en) ausführen`
                    : 'Alle Migrationen ausgeführt'}
                </>
              )}
            </Button>
          </>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            Keine Migrationsdaten verfügbar
          </div>
        )}
      </CardContent>
    </Card>
  );
}
