import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Migration {
  version: string;
  name: string;
  status: "pending" | "executed";
  executedAt?: string;
}

export interface MigrationResult {
  version: string;
  name: string;
  success: boolean;
  error?: string;
}

export interface UseMigrationsReturn {
  migrations: Migration[];
  loading: boolean;
  error: string | null;
  running: boolean;
  runMigrations: (versions?: string[]) => Promise<MigrationResult[]>;
  refetch: () => Promise<void>;
}

export function useMigrations(): UseMigrationsReturn {
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMigrations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("run-migrations", {
        body: { action: "list" },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      if (data.migrations) {
        setMigrations(
          data.migrations.map((m: any) => ({
            version: m.version,
            name: m.name,
            status: m.status,
            executedAt: m.executed_at,
          }))
        );
      }
    } catch (err) {
      console.error("Error fetching migrations:", err);
      setError(err instanceof Error ? err.message : "Fehler beim Laden der Migrationen");
    } finally {
      setLoading(false);
    }
  }, []);

  const runMigrations = useCallback(
    async (versions?: string[]): Promise<MigrationResult[]> => {
      setRunning(true);
      setError(null);

      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session) {
          throw new Error("Not authenticated");
        }

        const response = await supabase.functions.invoke("run-migrations", {
          body: versions ? { migrations: versions } : {},
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        const data = response.data;

        // Refetch to update status
        await fetchMigrations();

        return data.executed || [];
      } catch (err) {
        console.error("Error running migrations:", err);
        const errorMessage = err instanceof Error ? err.message : "Fehler beim Ausführen der Migrationen";
        setError(errorMessage);
        return [];
      } finally {
        setRunning(false);
      }
    },
    [fetchMigrations]
  );

  useEffect(() => {
    fetchMigrations();
  }, [fetchMigrations]);

  return {
    migrations,
    loading,
    error,
    running,
    runMigrations,
    refetch: fetchMigrations,
  };
}
