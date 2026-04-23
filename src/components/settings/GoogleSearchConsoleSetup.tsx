import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  Loader2,
  Plug,
  Unplug,
  Globe,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceConvex } from "@/hooks/useWorkspaceConvex";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface GscProperty {
  siteUrl: string;
  permissionLevel: string;
}

export function GoogleSearchConsoleSetup() {
  const { toast } = useToast();
  const { currentProject } = useWorkspaceConvex();

  const accounts = useQuery(api.tables.googleAccounts.listMine);
  const connection = useQuery(
    api.tables.gscConnections.getByProject,
    currentProject ? { projectId: currentProject._id } : "skip"
  );

  const getAuthUrl = useAction(api.actions.googleAuth.getAuthUrl);
  const exchangeCode = useAction(api.actions.googleAuth.exchangeCode);
  const listProperties = useAction(
    api.actions.googleAuth.listPropertiesForAccount
  );
  const deleteAccount = useMutation(api.tables.googleAccounts.deleteMine);
  const upsertConnection = useMutation(api.tables.gscConnections.upsert);
  const disconnect = useMutation(api.tables.gscConnections.disconnect);

  const [connecting, setConnecting] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<Id<"googleAccounts"> | "">("");
  const [properties, setProperties] = useState<GscProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [saving, setSaving] = useState(false);

  // Track the current OAuth state to match postMessage responses
  const oauthStateRef = useRef<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  // When existing connection loads, pre-select it
  useEffect(() => {
    if (connection) {
      setSelectedAccountId(connection.googleAccountId);
      setSelectedProperty(connection.gscProperty);
    }
  }, [connection]);

  // Auto-load properties when an account is picked
  useEffect(() => {
    if (!selectedAccountId) {
      setProperties([]);
      return;
    }
    let cancelled = false;
    setLoadingProperties(true);
    listProperties({ googleAccountId: selectedAccountId })
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.properties) {
          setProperties(res.properties);
        } else {
          setProperties([]);
          if (res.error) {
            toast({
              title: "GSC-Properties konnten nicht geladen werden",
              description: res.error,
              variant: "destructive",
            });
          }
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Load properties error:", err);
        setProperties([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingProperties(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId, listProperties, toast]);

  // Popup postMessage listener for OAuth flow
  useEffect(() => {
    async function onMessage(evt: MessageEvent) {
      if (!evt.data || evt.data.type !== "google-oauth") return;
      if (!oauthStateRef.current || evt.data.state !== oauthStateRef.current) return;

      oauthStateRef.current = null;

      if (evt.data.error) {
        setConnecting(false);
        toast({
          title: "Google-Verbindung abgebrochen",
          description: evt.data.errorDescription || evt.data.error,
          variant: "destructive",
        });
        return;
      }
      if (!evt.data.code) {
        setConnecting(false);
        return;
      }

      try {
        const res = await exchangeCode({ code: evt.data.code });
        if (res.success) {
          toast({
            title: "Google-Konto verbunden",
            description: res.email
              ? `${res.email} ist jetzt verfügbar.`
              : "Verbindung erfolgreich.",
          });
          if (res.accountId) {
            setSelectedAccountId(res.accountId as Id<"googleAccounts">);
          }
        } else {
          toast({
            title: "Verbindung fehlgeschlagen",
            description: res.error || "Unbekannter Fehler",
            variant: "destructive",
          });
        }
      } catch (err) {
        toast({
          title: "Verbindung fehlgeschlagen",
          description: err instanceof Error ? err.message : "Unbekannter Fehler",
          variant: "destructive",
        });
      } finally {
        setConnecting(false);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [exchangeCode, toast]);

  const handleSignInWithGoogle = async () => {
    setConnecting(true);
    try {
      const state = crypto.randomUUID();
      oauthStateRef.current = state;
      const url = await getAuthUrl({ state });
      const width = 520;
      const height = 640;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      popupRef.current = window.open(
        url,
        "google-oauth",
        `width=${width},height=${height},left=${left},top=${top}`
      );
      if (!popupRef.current) {
        setConnecting(false);
        toast({
          title: "Popup blockiert",
          description:
            "Bitte erlaube Popups für diese Seite und versuche es erneut.",
          variant: "destructive",
        });
      }
    } catch (err) {
      setConnecting(false);
      toast({
        title: "Google-Anmeldung fehlgeschlagen",
        description: err instanceof Error ? err.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    }
  };

  const handleSaveConnection = async () => {
    if (!currentProject || !selectedAccountId || !selectedProperty) return;
    setSaving(true);
    const prop = properties.find((p) => p.siteUrl === selectedProperty);
    try {
      await upsertConnection({
        projectId: currentProject._id,
        googleAccountId: selectedAccountId as Id<"googleAccounts">,
        gscProperty: selectedProperty,
        propertyPermissionLevel: prop?.permissionLevel,
      });
      toast({
        title: "GSC verknüpft",
        description: `${selectedProperty} für Projekt ${currentProject.name} aktiv.`,
      });
    } catch (err) {
      toast({
        title: "Speichern fehlgeschlagen",
        description: err instanceof Error ? err.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnectProject = async () => {
    if (!currentProject) return;
    await disconnect({ projectId: currentProject._id });
    setSelectedAccountId("");
    setSelectedProperty("");
    toast({ title: "Verbindung getrennt" });
  };

  const handleDeleteAccount = async (id: Id<"googleAccounts">) => {
    if (
      !confirm(
        "Google-Konto wirklich entfernen? Damit wird die Verknüpfung auf allen Projekten gelöscht."
      )
    ) {
      return;
    }
    await deleteAccount({ id });
    if (selectedAccountId === id) setSelectedAccountId("");
  };

  if (!currentProject) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground">
            Google Search Console
          </CardTitle>
          <CardDescription>Bitte wähle zuerst ein Projekt aus.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isConnected = !!connection;
  const accountsLoaded = accounts !== undefined;
  const myAccounts = accounts ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Google Search Console
              {isConnected && (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
            </CardTitle>
            <CardDescription>
              Performance-Daten und Keyword-Rankings pro Projekt
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && connection && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              ✓ Verbunden
            </p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <strong>Google-Konto:</strong>{" "}
                {connection.googleAccountEmail ?? "—"}
              </p>
              <p>
                <strong>Property:</strong>{" "}
                <span className="font-mono">{connection.gscProperty}</span>
              </p>
              {connection.propertyPermissionLevel && (
                <p>
                  <strong>Zugriff:</strong> {connection.propertyPermissionLevel}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnectProject}
            >
              <Unplug className="h-4 w-4 mr-2" />
              Verbindung für dieses Projekt trennen
            </Button>
          </div>
        )}

        <div className="space-y-3">
          <Label>Google-Konto</Label>
          {!accountsLoaded ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade verbundene Konten…
            </div>
          ) : myAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch kein Google-Konto verbunden.
            </p>
          ) : (
            <div className="space-y-2">
              <Select
                value={selectedAccountId}
                onValueChange={(v) =>
                  setSelectedAccountId(v as Id<"googleAccounts">)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Google-Konto wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {myAccounts.map((a) => (
                    <SelectItem key={a._id} value={a._id}>
                      {a.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAccountId && (
                <button
                  type="button"
                  onClick={() =>
                    handleDeleteAccount(
                      selectedAccountId as Id<"googleAccounts">
                    )
                  }
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Dieses Google-Konto ganz entfernen
                </button>
              )}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignInWithGoogle}
            disabled={connecting}
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plug className="h-4 w-4 mr-2" />
            )}
            {myAccounts.length > 0
              ? "Weiteres Google-Konto verbinden"
              : "Mit Google anmelden"}
          </Button>
        </div>

        {selectedAccountId && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>GSC-Property</Label>
              <Button
                variant="ghost"
                size="sm"
                disabled={loadingProperties}
                onClick={() =>
                  listProperties({
                    googleAccountId: selectedAccountId as Id<"googleAccounts">,
                  }).then((res) => {
                    if (res.success && res.properties)
                      setProperties(res.properties);
                  })
                }
              >
                <RefreshCw
                  className={`h-4 w-4 ${loadingProperties ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
            {loadingProperties ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Lade Properties…
              </div>
            ) : properties.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Properties für dieses Konto verfügbar. Stelle sicher,
                dass das Google-Konto Zugriff auf Search Console hat.
              </p>
            ) : (
              <Select
                value={selectedProperty}
                onValueChange={setSelectedProperty}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Property wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.siteUrl} value={p.siteUrl}>
                      <span className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono text-xs">{p.siteUrl}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {selectedAccountId && selectedProperty && (
          <Button
            onClick={handleSaveConnection}
            disabled={saving || !currentProject}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Verbindung für Projekt speichern
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
