import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
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
import {
  FileText,
  LayoutTemplate,
  PenTool,
  Plus,
  ArrowRight,
  Zap,
  Building2,
  AlertCircle,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export default function ProjectDashboard() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { currentProject, projects, isLoading } = useWorkspaceConvex();

  const briefs = useQuery(
    api.tables.contentBriefs.listByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  const articles = useQuery(
    api.tables.articles.listByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  const templates = useQuery(
    api.tables.elementorTemplates.listByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );
  const brandProfile = useQuery(
    api.tables.brandProfiles.getByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Project in URL doesn't match a project the user has access to
  if (!isLoading && !currentProject && projects.length > 0) {
    return (
      <AppLayout title="Projekt nicht gefunden">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Projekt nicht gefunden</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Das angefragte Projekt existiert nicht oder du hast keinen Zugriff.
          </p>
          <Button onClick={() => navigate("/projects")}>Zu den Projekten</Button>
        </div>
      </AppLayout>
    );
  }

  if (!currentProject) {
    return <AppLayout title="Lade Projekt…"><div /></AppLayout>;
  }

  const prefix = `/projects/${currentProject._id}`;

  const quickActions = [
    {
      title: "Neuer Content Brief",
      description: "Keyword, Intent und Zielgruppe definieren",
      icon: FileText,
      href: `${prefix}/briefs`,
      color: "bg-chart-1/10 text-chart-1",
    },
    {
      title: "Artikel generieren",
      description: "SEO-Text mit KI erstellen",
      icon: PenTool,
      href: `${prefix}/articles`,
      color: "bg-chart-2/10 text-chart-2",
    },
    {
      title: "Brand Intelligence",
      description: brandProfile?.crawlStatus === "completed"
        ? "Brand-Profil ist bereit"
        : "Brand analysieren",
      icon: Building2,
      href: `${prefix}/brand`,
      color: "bg-chart-3/10 text-chart-3",
    },
  ];

  return (
    <AppLayout
      title={currentProject.name}
      breadcrumbs={[
        { label: "Projekte", href: "/projects" },
        { label: currentProject.name },
      ]}
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
                <div
                  className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${action.color} mb-2`}
                >
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

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Content Briefs</CardDescription>
              <CardTitle className="text-2xl">
                {briefs === undefined ? "…" : briefs.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Artikel</CardDescription>
              <CardTitle className="text-2xl">
                {articles === undefined ? "…" : articles.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Templates</CardDescription>
              <CardTitle className="text-2xl">
                {templates === undefined ? "…" : templates.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Domain</CardDescription>
              <CardTitle className="text-sm font-mono truncate">
                {currentProject.domain || "—"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Getting Started */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">So funktioniert der Workflow</CardTitle>
            <CardDescription>
              Vom Keyword zum veröffentlichten Artikel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {[
                {
                  n: 1,
                  title: "Brand analysieren",
                  text: "Website crawlen, Profil extrahieren",
                },
                {
                  n: 2,
                  title: "Brief erstellen",
                  text: "Keyword, Intent, Zielgruppe festlegen",
                },
                {
                  n: 3,
                  title: "Artikel generieren",
                  text: "KI schreibt SEO-optimierten Text",
                },
                {
                  n: 4,
                  title: "Veröffentlichen",
                  text: "WordPress-Publish oder Template-Export",
                },
              ].map((step) => (
                <div key={step.n} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    {step.n}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{step.title}</p>
                    <p className="text-sm text-muted-foreground">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
