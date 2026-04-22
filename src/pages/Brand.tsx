import { AlertCircle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspaceConvex } from "@/hooks/useWorkspaceConvex";
import { BrandIntelligenceSetup } from "@/components/settings/BrandIntelligenceSetup";

export default function Brand() {
  const { currentProject } = useWorkspaceConvex();

  if (!currentProject) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Kein Projekt ausgewählt</h2>
          <p className="text-muted-foreground">
            Bitte wähle zuerst ein Projekt aus, um die Brand-Intelligence zu konfigurieren.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Brand Intelligence</h1>
          <p className="text-muted-foreground">
            Brand-Profil für <strong>{currentProject.name}</strong> — jedes Projekt hat sein eigenes Profil.
          </p>
        </div>

        <BrandIntelligenceSetup />
      </div>
    </AppLayout>
  );
}
