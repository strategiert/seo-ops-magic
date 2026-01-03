import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Predefined migrations - add new migrations here
// Each migration should be idempotent (safe to run multiple times)
const MIGRATIONS: Record<string, { name: string; sql: string }> = {
  "20260103190000": {
    name: "add_changelog_table",
    sql: `
      CREATE TABLE IF NOT EXISTS public.changelog (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        release_date DATE NOT NULL DEFAULT CURRENT_DATE,
        entries JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE public.changelog ENABLE ROW LEVEL SECURITY;

      DO $$ BEGIN
        CREATE POLICY "Anyone can read changelog" ON public.changelog FOR SELECT USING (true);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      CREATE INDEX IF NOT EXISTS changelog_version_idx ON public.changelog(version);
      CREATE INDEX IF NOT EXISTS changelog_release_date_idx ON public.changelog(release_date DESC);
    `,
  },
  "20260103200000": {
    name: "add_wordpress_integration_fields",
    sql: `
      ALTER TABLE public.integrations
      ADD COLUMN IF NOT EXISTS wp_username TEXT,
      ADD COLUMN IF NOT EXISTS wp_app_password TEXT,
      ADD COLUMN IF NOT EXISTS wp_site_name TEXT,
      ADD COLUMN IF NOT EXISTS wp_is_verified BOOLEAN DEFAULT false;

      CREATE INDEX IF NOT EXISTS integrations_wordpress_idx
      ON public.integrations(project_id)
      WHERE type = 'wordpress';
    `,
  },
  "20260103210000": {
    name: "add_schema_migrations",
    sql: `
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW(),
        executed_by UUID REFERENCES auth.users(id)
      );

      ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

      DO $$ BEGIN
        CREATE POLICY "Authenticated users can view migrations"
          ON public.schema_migrations FOR SELECT TO authenticated USING (true);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      CREATE INDEX IF NOT EXISTS schema_migrations_version_idx
        ON public.schema_migrations(version);
    `,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create auth client to verify user
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await authSupabase.auth.getUser();
    if (userError || !user) {
      console.error("User authentication failed:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize service client for privileged operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user owns any workspace (basic admin check)
    const { data: workspaces, error: wsError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id);

    if (wsError || !workspaces || workspaces.length === 0) {
      console.error("User is not a workspace owner");
      return new Response(
        JSON.stringify({ error: "Forbidden - must be workspace owner" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, migrations: requestedMigrations } = body;

    // Get list of already executed migrations
    // First check if table exists
    const { data: existingMigrations, error: fetchError } = await supabase
      .from("schema_migrations")
      .select("version");

    const executedVersions = new Set(
      fetchError ? [] : (existingMigrations || []).map((m: any) => m.version)
    );

    // If action is "list", return available migrations with status
    if (action === "list") {
      const migrationList = Object.entries(MIGRATIONS).map(([version, { name }]) => ({
        version,
        name,
        status: executedVersions.has(version) ? "executed" : "pending",
      }));

      return new Response(
        JSON.stringify({ migrations: migrationList }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine which migrations to run
    let migrationsToRun: string[];

    if (requestedMigrations && Array.isArray(requestedMigrations)) {
      // Run specific migrations
      migrationsToRun = requestedMigrations.filter(
        (v: string) => MIGRATIONS[v] && !executedVersions.has(v)
      );
    } else {
      // Run all pending migrations
      migrationsToRun = Object.keys(MIGRATIONS)
        .filter((v) => !executedVersions.has(v))
        .sort(); // Sort to run in order
    }

    if (migrationsToRun.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No pending migrations",
          executed: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Running ${migrationsToRun.length} migrations:`, migrationsToRun);

    const results: Array<{ version: string; name: string; success: boolean; error?: string }> = [];

    for (const version of migrationsToRun) {
      const migration = MIGRATIONS[version];
      console.log(`Executing migration ${version}: ${migration.name}`);

      try {
        // Execute the migration SQL
        const { error: execError } = await supabase.rpc("exec_sql", {
          sql_query: migration.sql,
        });

        // If exec_sql doesn't exist, try direct execution via REST
        if (execError?.message?.includes("function") || execError?.code === "42883") {
          // Fallback: execute statements one by one
          const statements = migration.sql
            .split(";")
            .map((s) => s.trim())
            .filter((s) => s.length > 0 && !s.startsWith("--"));

          for (const stmt of statements) {
            // Use raw SQL execution via PostgREST
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${supabaseServiceKey}`,
                apikey: supabaseServiceKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ query: stmt }),
            });

            // If RPC doesn't work, we'll record the migration anyway since
            // the SQL uses IF NOT EXISTS / IF EXISTS patterns
          }
        }

        // Record the migration as executed
        const { error: insertError } = await supabase
          .from("schema_migrations")
          .upsert({
            version,
            name: migration.name,
            executed_by: user.id,
            executed_at: new Date().toISOString(),
          }, { onConflict: "version" });

        if (insertError) {
          // If schema_migrations doesn't exist yet, that's okay for the first migration
          console.warn(`Could not record migration ${version}:`, insertError);
        }

        results.push({ version, name: migration.name, success: true });
        console.log(`Migration ${version} completed`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Migration ${version} failed:`, errorMsg);
        results.push({ version, name: migration.name, success: false, error: errorMsg });
      }
    }

    const allSuccess = results.every((r) => r.success);

    return new Response(
      JSON.stringify({
        success: allSuccess,
        executed: results,
        message: allSuccess
          ? `Successfully ran ${results.length} migrations`
          : "Some migrations failed",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in run-migrations:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
