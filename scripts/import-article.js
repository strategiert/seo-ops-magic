/**
 * Import article JSON to database
 *
 * Usage:
 *   node scripts/import-article.js <brief-id> <path-to-json>
 *
 * Example:
 *   node scripts/import-article.js 5839afb0-42c8-4cc5-9f4b-c65860c4c8fb bbc2026.json
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Get arguments
const briefId = process.argv[2];
const jsonPath = process.argv[3];

if (!briefId || !jsonPath) {
  console.error('❌ Usage: node scripts/import-article.js <brief-id> <path-to-json>');
  process.exit(1);
}

// Get Supabase credentials from env
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set');
  console.error('   Add them to your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importArticle() {
  try {
    // Read JSON file
    console.log(`📖 Reading ${jsonPath}...`);
    const articleJson = JSON.parse(readFileSync(resolve(jsonPath), 'utf-8'));

    // Get brief to get project_id and primary_keyword
    console.log(`🔍 Loading brief ${briefId}...`);
    const { data: brief, error: briefError } = await supabase
      .from('content_briefs')
      .select('project_id, primary_keyword')
      .eq('id', briefId)
      .single();

    if (briefError) {
      console.error('❌ Brief not found:', briefError.message);
      process.exit(1);
    }

    // Insert article
    console.log('💾 Saving article to database...');
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .insert({
        project_id: brief.project_id,
        brief_id: briefId,
        title: articleJson.title,
        primary_keyword: brief.primary_keyword,
        content_markdown: articleJson.content_markdown,
        meta_title: articleJson.meta_title,
        meta_description: articleJson.meta_description,
        outline_json: articleJson.outline || [],
        faq_json: articleJson.faq || [],
        status: 'draft',
        version: 1,
      })
      .select()
      .single();

    if (articleError) {
      console.error('❌ Error saving article:', articleError.message);
      process.exit(1);
    }

    // Update brief status
    await supabase
      .from('content_briefs')
      .update({ status: 'completed' })
      .eq('id', briefId);

    console.log('✅ Article saved successfully!');
    console.log(`📝 Article ID: ${article.id}`);
    console.log(`📄 Title: ${article.title}`);
    console.log(`📊 Words: ${articleJson.content_markdown.split(/\s+/).length}`);
    console.log('');
    console.log(`🌐 View in app: /articles/${article.id}`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Go to the app and view the article');
    console.log('2. Generate Elementor template');
    console.log('3. Publish to WordPress');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

importArticle();
