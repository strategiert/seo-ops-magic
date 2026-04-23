import { useUser } from "@clerk/clerk-react";
import { Wrench, RotateCcw, User } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useTour, useUserOnboarding } from "@/components/onboarding";

/**
 * Global user settings (not project-scoped).
 * Project-specific integrations and defaults live in ProjectSettings.tsx.
 */
export default function Settings() {
  const { toast } = useToast();
  const { user } = useUser();
  const { resetOnboarding } = useUserOnboarding();
  const { startTour } = useTour();

  const handleRestartTour = () => {
    resetOnboarding();
    startTour();
    toast({
      title: "Tour gestartet",
      description: "Die Einführungstour wurde neu gestartet.",
    });
  };

  return (
    <AppLayout breadcrumbs={[{ label: "Einstellungen" }]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Einstellungen</h1>
          <p className="text-muted-foreground">
            Globale Konfiguration für dich und deinen Account. Projektspezifische
            Einstellungen findest du im jeweiligen Projekt.
          </p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList>
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Profil
            </TabsTrigger>
            <TabsTrigger value="system">
              <Wrench className="h-4 w-4 mr-2" />
              System
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription>Dein Login und Account-Infos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground min-w-28">Name:</span>
                  <span className="font-medium">
                    {user?.fullName || "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground min-w-28">E-Mail:</span>
                  <span className="font-mono text-xs">
                    {user?.primaryEmailAddress?.emailAddress || "—"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  Profil-Details werden über Clerk verwaltet. Profilbild und
                  Passwort änderst du im Clerk-User-Menü (oben rechts).
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Einführungstour</CardTitle>
                <CardDescription>
                  Starte die geführte Tour erneut, um alle Funktionen kennenzulernen.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={handleRestartTour}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Tour neu starten
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
