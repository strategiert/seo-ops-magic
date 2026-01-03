import { useState, useEffect } from 'react';
import { Sparkles, Rocket, Wrench, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useChangelog, ChangelogEntry } from './useChangelog';

const entryConfig: Record<ChangelogEntry['type'], {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: React.ReactNode;
  label: string;
}> = {
  NEW: {
    variant: 'default',
    icon: <Sparkles className="h-3 w-3" />,
    label: 'Neu'
  },
  UPDATED: {
    variant: 'secondary',
    icon: <RefreshCw className="h-3 w-3" />,
    label: 'Update'
  },
  FIXED: {
    variant: 'outline',
    icon: <Wrench className="h-3 w-3" />,
    label: 'Fix'
  },
  BREAKING: {
    variant: 'destructive',
    icon: <AlertTriangle className="h-3 w-3" />,
    label: 'Breaking'
  },
};

export function ChangelogModal() {
  const { changelogs, latestVersion, isLoading, hasNewVersion, markAsSeen } = useChangelog();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && hasNewVersion) {
      setOpen(true);
    }
  }, [isLoading, hasNewVersion]);

  const handleClose = () => {
    setOpen(false);
    markAsSeen();
  };

  if (isLoading || changelogs.length === 0) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  // Group entries by type for the latest version
  const latestChangelog = changelogs[0];
  const groupedEntries = latestChangelog.entries.reduce((acc, entry) => {
    if (!acc[entry.type]) {
      acc[entry.type] = [];
    }
    acc[entry.type].push(entry.text);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Was ist neu in v{latestVersion}
          </DialogTitle>
          <DialogDescription>
            {latestChangelog.title} — {formatDate(latestChangelog.release_date)}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {/* Latest Version - Grouped by Type */}
            {Object.entries(groupedEntries).map(([type, texts]) => {
              const config = entryConfig[type as ChangelogEntry['type']];
              return (
                <Card key={type} className="border-l-4" style={{
                  borderLeftColor: type === 'NEW' ? 'hsl(var(--primary))' :
                                   type === 'BREAKING' ? 'hsl(var(--destructive))' :
                                   'hsl(var(--muted-foreground))'
                }}>
                  <CardHeader className="pb-2 pt-3">
                    <Badge variant={config.variant} className="w-fit flex items-center gap-1">
                      {config.icon}
                      {config.label}
                    </Badge>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-1.5">
                      {texts.map((text, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>{text}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}

            {/* Previous Versions (collapsed) */}
            {changelogs.length > 1 && (
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-3">Frühere Versionen</p>
                {changelogs.slice(1).map((changelog) => (
                  <div key={changelog.id} className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">v{changelog.version}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(changelog.release_date)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{changelog.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button onClick={handleClose}>
            Verstanden
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
