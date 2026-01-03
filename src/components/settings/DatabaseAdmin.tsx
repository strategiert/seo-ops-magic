import { useState } from "react";
import { Loader2, CheckCircle2, Circle, Database, Play, RefreshCw, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMigrations, type MigrationResult } from "@/hooks/useMigrations";

export function DatabaseAdmin() {
  const { toast } = useToast();
  const { migrations, loading, error, running, runMigrations, refetch } = useMigrations();
  const [results, setResults] = useState<MigrationResult[]>([]);

  const pendingCount = migrations.filter((m) => m.status === "pending").length;

  const handleRunMigrations = async () => {
    const migrationResults = await runMigrations();
    setResults(migrationResults);

    const successCount = migrationResults.filter((r) => r.success).length;
    const failCount = migrationResults.filter((r) => !r.success).length;

    if (failCount === 0 && successCount > 0) {
      toast({
        title: "Migrationen erfolgreich",
        description: `${successCount} Migration(en) wurden ausgeführt.`,
      });
    } else if (failCount > 0) {
      toast({
        title: "Teilweise fehlgeschlagen",
        description: `${successCount} erfolgreich, ${failCount} fehlgeschlagen.`,
        variant: "destructive",
      });
    } else if (successCount === 0 && migrationResults.length === 0) {
      toast({
        title: "Keine Migrationen",
        description: "Alle Migrationen sind bereits ausgeführt.",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Datenbank-Migrationen
            </CardTitle>
            <CardDescription>
              Datenbank-Schema Updates ausführen
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Lade Migrationen...
          </div>
        ) : error ? (
          <div className="p-3 bg-destructive/10 rounded-lg">
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Die Edge Function "run-migrations" muss eventuell noch deployed werden.
            </p>
          </div>
        ) : (
          <>
            {/* Migration List */}
            <div className="space-y-2">
              {migrations.map((migration) => (
                <div
                  key={migration.version}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {migration.status === "executed" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{migration.name}</p>
                      <p className="text-xs text-muted-foreground">{migration.version}</p>
                    </div>
                  </div>
                  <Badge variant={migration.status === "executed" ? "secondary" : "outline"}>
                    {migration.status === "executed" ? "Ausgeführt" : "Ausstehend"}
                  </Badge>
                </div>
              ))}

              {migrations.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Keine Migrationen verfügbar
                </p>
              )}
            </div>

            {/* Results from last run */}
            {results.length > 0 && (
              <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                <p className="text-sm font-medium">Letzte Ausführung:</p>
                {results.map((result) => (
                  <div key={result.version} className="text-sm flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                    <span>{result.name}</span>
                    {result.error && (
                      <span className="text-xs text-destructive">({result.error})</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Action Button */}
            <div className="pt-2">
              <Button
                onClick={handleRunMigrations}
                disabled={running || pendingCount === 0}
              >
                {running && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {!running && <Play className="h-4 w-4 mr-2" />}
                {running
                  ? "Führe aus..."
                  : pendingCount > 0
                  ? `${pendingCount} Migration(en) ausführen`
                  : "Alle Migrationen aktuell"}
              </Button>
            </div>

            {/* Info Box */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Hinweis:</strong> Migrationen werden sicher über eine Edge Function
                mit Service Role Key ausgeführt. Alle Änderungen werden protokolliert.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
