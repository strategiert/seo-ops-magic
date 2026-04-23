import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspaceConvex } from "@/hooks/useWorkspaceConvex";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderKanban, Plus, ArrowRight, Globe, Zap } from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user } = useUser();
  const { projects, isLoading: workspaceLoading } = useWorkspaceConvex();

  useEffect(() => {
    if (authLoaded && !isSignedIn) {
      navigate("/auth");
    }
  }, [isSignedIn, authLoaded, navigate]);

  const firstName = user?.firstName ?? user?.fullName?.split(" ")[0];

  if (!authLoaded || workspaceLoading) {
    return (
      <AppLayout title="Dashboard">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </AppLayout>
    );
  }

  // Empty-state: no projects yet
  if (projects.length === 0) {
    return (
      <AppLayout title="Willkommen">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
            <Zap className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold mb-2">
            {firstName ? `Hallo ${firstName} — ` : ""}willkommen in der SEO Content Ops Suite
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Ein Projekt repräsentiert eine Website oder Brand. Erstelle dein erstes Projekt, um loszulegen.
          </p>
          <Button onClick={() => navigate("/projects")}>
            <Plus className="mr-2 h-4 w-4" />
            Projekt erstellen
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={firstName ? `Hallo ${firstName}` : "Dashboard"}
      breadcrumbs={[{ label: "Dashboard" }]}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Deine Projekte</h2>
            <p className="text-sm text-muted-foreground">
              {projects.length} {projects.length === 1 ? "Projekt" : "Projekte"} in diesem Workspace
            </p>
          </div>
          <Button onClick={() => navigate("/projects")} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Neues Projekt
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card
              key={project._id}
              className="group cursor-pointer transition-smooth hover:shadow-md hover:border-primary/20"
              onClick={() => navigate(`/projects/${project._id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary mb-2">
                    <FolderKanban className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                </div>
                <CardTitle className="text-base">{project.name}</CardTitle>
                <CardDescription className="flex items-center gap-1 text-xs">
                  {project.domain ? (
                    <>
                      <Globe className="h-3 w-3" />
                      <span className="font-mono truncate">{project.domain}</span>
                    </>
                  ) : (
                    <span className="italic text-muted-foreground">Keine Domain gesetzt</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    Lang:{" "}
                    <span className="font-medium">
                      {project.defaultLanguage?.toUpperCase() ?? "DE"}
                    </span>
                  </span>
                  <span>
                    Land:{" "}
                    <span className="font-medium">
                      {project.defaultCountry ?? "DE"}
                    </span>
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
