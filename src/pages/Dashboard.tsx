import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, LayoutTemplate, PenTool, Plus, ArrowRight, Zap } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { currentProject, projects, isLoading: workspaceLoading } = useWorkspace();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || workspaceLoading) {
    return (
      <AppLayout title="Dashboard">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </AppLayout>
    );
  }

  if (!currentProject) {
    return (
      <AppLayout title="Willkommen" breadcrumbs={[{ label: 'Dashboard' }]}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
            <Zap className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Erstelle dein erstes Projekt</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Ein Projekt repräsentiert eine Website oder Brand. Du kannst NeuronWriter-Guidelines,
            Content Briefs und Elementor Templates pro Projekt verwalten.
          </p>
          <Button onClick={() => navigate('/projects')}>
            <Plus className="mr-2 h-4 w-4" />
            Projekt erstellen
          </Button>
        </div>
      </AppLayout>
    );
  }

  const quickActions = [
    {
      title: 'Neuer Content Brief',
      description: 'Keyword, Intent und Zielgruppe definieren',
      icon: FileText,
      href: '/briefs/new',
      color: 'bg-chart-1/10 text-chart-1',
    },
    {
      title: 'Artikel generieren',
      description: 'SEO-Text mit KI erstellen',
      icon: PenTool,
      href: '/articles',
      color: 'bg-chart-2/10 text-chart-2',
    },
    {
      title: 'Template exportieren',
      description: 'Elementor JSON erstellen',
      icon: LayoutTemplate,
      href: '/templates',
      color: 'bg-chart-3/10 text-chart-3',
    },
  ];

  return (
    <AppLayout 
      title={`Projekt: ${currentProject.name}`}
      breadcrumbs={[{ label: 'Dashboard' }]}
    >
      <div className="space-y-6">
        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          {quickActions.map((action) => (
            <Card 
              key={action.title} 
              className="group cursor-pointer transition-smooth hover:shadow-md hover:border-primary/20"
              onClick={() => navigate(action.href)}
            >
              <CardHeader className="pb-2">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${action.color} mb-2`}>
                  <action.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base flex items-center gap-2">
                  {action.title}
                  <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                </CardTitle>
                <CardDescription className="text-sm">
                  {action.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Content Briefs</CardDescription>
              <CardTitle className="text-2xl">0</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Artikel</CardDescription>
              <CardTitle className="text-2xl">0</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Templates</CardDescription>
              <CardTitle className="text-2xl">0</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Projekt-Domain</CardDescription>
              <CardTitle className="text-sm font-mono truncate">
                {currentProject.domain || 'Nicht gesetzt'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Getting Started Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Erste Schritte</CardTitle>
            <CardDescription>
              So nutzt du die SEO Content Ops Suite optimal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  1
                </div>
                <div>
                  <p className="font-medium text-sm">Content Brief erstellen</p>
                  <p className="text-sm text-muted-foreground">
                    Definiere Keyword, Search Intent und Zielgruppe
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  2
                </div>
                <div>
                  <p className="font-medium text-sm">Artikel mit KI generieren</p>
                  <p className="text-sm text-muted-foreground">
                    Die KI erstellt SEO-optimierte Texte inkl. Meta-Tags
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  3
                </div>
                <div>
                  <p className="font-medium text-sm">Elementor JSON exportieren</p>
                  <p className="text-sm text-muted-foreground">
                    Template in WordPress importieren
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
