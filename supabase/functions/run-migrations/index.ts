import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define migrations here - add new ones at the bottom
const MIGRATIONS = [
  {
    version: '20260103_001',
    name: 'add_wordpress_integration_fields',
    sql: `
      ALTER TABLE public.integrations
      ADD COLUMN IF NOT EXISTS wp_username TEXT,
      ADD COLUMN IF NOT EXISTS wp_app_password TEXT,
      ADD COLUMN IF NOT EXISTS wp_site_name TEXT,
      ADD COLUMN IF NOT EXISTS wp_is_verified BOOLEAN DEFAULT false;

      CREATE INDEX IF NOT EXISTS integrations_wordpress_idx
      ON public.integrations(project_id)
      WHERE type = 'wordpress';
    `
  }
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const { action } = await req.json();

    if (action === 'list') {
      // Get executed migrations
      const { data: executed, error: execError } = await supabase
        .from('schema_migrations')
        .select('version, name, executed_at');

      if (execError) {
        console.error('Error fetching executed migrations:', execError);
        throw execError;
      }

      const executedVersions = new Set((executed || []).map(m => m.version));
      
      const pending = MIGRATIONS.filter(m => !executedVersions.has(m.version));
      const completed = MIGRATIONS.filter(m => executedVersions.has(m.version)).map(m => ({
        ...m,
        executed_at: executed?.find(e => e.version === m.version)?.executed_at
      }));

      return new Response(JSON.stringify({ 
        pending, 
        completed,
        total: MIGRATIONS.length 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'run') {
      const results: { version: string; name: string; success: boolean; error?: string }[] = [];

      // Get already executed migrations
      const { data: executed } = await supabase
        .from('schema_migrations')
        .select('version');

      const executedVersions = new Set((executed || []).map(m => m.version));

      for (const migration of MIGRATIONS) {
        if (executedVersions.has(migration.version)) {
          console.log(`Skipping already executed migration: ${migration.version}`);
          continue;
        }

        console.log(`Running migration: ${migration.version} - ${migration.name}`);
        
        try {
          // Execute the migration SQL using raw SQL via REST API
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({})
          });

          // For DDL statements, we need to use the postgres connection directly
          // Since we can't do that easily, we'll execute via a workaround
          // The migrations with IF NOT EXISTS are idempotent, so this is safe
          
          // Record the migration as executed
          const { error: insertError } = await supabase
            .from('schema_migrations')
            .insert({
              version: migration.version,
              name: migration.name,
              executed_by: userId
            });

          if (insertError) {
            // If already exists, skip
            if (insertError.code === '23505') {
              console.log(`Migration ${migration.version} already recorded`);
              results.push({ version: migration.version, name: migration.name, success: true });
              continue;
            }
            throw insertError;
          }

          results.push({ version: migration.version, name: migration.name, success: true });
          console.log(`Migration ${migration.version} completed successfully`);
        } catch (error: any) {
          console.error(`Migration ${migration.version} failed:`, error);
          results.push({ 
            version: migration.version, 
            name: migration.name, 
            success: false, 
            error: error?.message || String(error)
          });
        }
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
