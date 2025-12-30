import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useWorkspace, Project } from '@/hooks/useWorkspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, FolderKanban, Globe, CheckCircle2 } from 'lucide-react';

export default function Projects() {
  const { projects, currentProject, setCurrentProject, createProject, isLoading } = useWorkspace();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', domain: '', wpUrl: '' });
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!newProject.name.trim()) {
      toast({
        title: 'Name erforderlich',
        description: 'Bitte gib einen Projektnamen ein.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    const project = await createProject(
      newProject.name.trim(),
      newProject.domain.trim() || undefined,
      newProject.wpUrl.trim() || undefined
    );
    setIsCreating(false);

    if (project) {
      toast({
        title: 'Projekt erstellt',
        description: `"${project.name}" wurde erfolgreich erstellt.`,
      });
      setIsDialogOpen(false);
      setNewProject({ name: '', domain: '', wpUrl: '' });
    }
  };

  const handleSelectProject = (project: Project) => {
    setCurrentProject(project);
    toast({
      title: 'Projekt gewechselt',
      description: `Aktives Projekt: ${project.name}`,
    });
  };

  return (
    <AppLayout title="Projekte" breadcrumbs={[{ label: 'Projekte' }]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Verwalte deine Website-Projekte und deren Einstellungen
          </p>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Neues Projekt
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neues Projekt erstellen</DialogTitle>
                <DialogDescription>
                  Ein Projekt repräsentiert eine Website oder Brand.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Projektname *</Label>
                  <Input
                    id="name"
                    placeholder="Meine Website"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain (optional)</Label>
                  <Input
                    id="domain"
                    placeholder="beispiel.de"
                    value={newProject.domain}
                    onChange={(e) => setNewProject({ ...newProject, domain: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wpUrl">WordPress URL (optional)</Label>
                  <Input
                    id="wpUrl"
                    placeholder="https://beispiel.de/wp-json"
                    value={newProject.wpUrl}
                    onChange={(e) => setNewProject({ ...newProject, wpUrl: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleCreate} disabled={isCreating}>
                  {isCreating ? 'Erstelle...' : 'Erstellen'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium mb-1">Noch keine Projekte</h3>
              <p className="text-muted-foreground text-sm text-center max-w-sm mb-4">
                Erstelle dein erstes Projekt, um mit der Content-Erstellung zu beginnen.
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Projekt erstellen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card 
                key={project.id}
                className={`cursor-pointer transition-smooth hover:shadow-md ${
                  currentProject?.id === project.id ? 'border-primary ring-1 ring-primary' : ''
                }`}
                onClick={() => handleSelectProject(project)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    {currentProject?.id === project.id && (
                      <Badge variant="secondary" className="text-xs">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Aktiv
                      </Badge>
                    )}
                  </div>
                  {project.domain && (
                    <CardDescription className="flex items-center gap-1 text-xs">
                      <Globe className="h-3 w-3" />
                      {project.domain}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Erstellt am {new Date(project.created_at).toLocaleDateString('de-DE')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
