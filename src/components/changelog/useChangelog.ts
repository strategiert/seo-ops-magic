import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const LS_CHANGELOG_SEEN = 'seo_content_ops.changelog_seen_version';

export interface ChangelogEntry {
  type: 'NEW' | 'UPDATED' | 'FIXED' | 'BREAKING';
  text: string;
}

export interface Changelog {
  id: string;
  version: string;
  title: string;
  release_date: string;
  entries: ChangelogEntry[];
  created_at: string;
}

export function useChangelog() {
  const [changelogs, setChangelogs] = useState<Changelog[]>([]);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNewVersion, setHasNewVersion] = useState(false);

  useEffect(() => {
    loadChangelogs();
  }, []);

  async function loadChangelogs() {
    try {
      const { data, error } = await supabase
        .from('changelog')
        .select('*')
        .order('release_date', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Failed to load changelog:', error);
        return;
      }

      if (data && data.length > 0) {
        const parsed = data.map((item) => ({
          ...item,
          entries: (item.entries as ChangelogEntry[]) || [],
        }));
        setChangelogs(parsed);
        setLatestVersion(parsed[0].version);

        // Check if user has seen the latest version
        const seenVersion = localStorage.getItem(LS_CHANGELOG_SEEN);
        setHasNewVersion(seenVersion !== parsed[0].version);
      }
    } catch (err) {
      console.error('Changelog error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  function markAsSeen() {
    if (latestVersion) {
      localStorage.setItem(LS_CHANGELOG_SEEN, latestVersion);
      setHasNewVersion(false);
    }
  }

  return {
    changelogs,
    latestVersion,
    isLoading,
    hasNewVersion,
    markAsSeen,
  };
}
