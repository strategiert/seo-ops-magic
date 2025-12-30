import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileText, Search, Filter, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

interface ContentBrief {
  id: string;
  title: string;
  primary_keyword: string;
  search_intent: string | null;
  status: string | null;
  priority_score: number | null;
  target_length: number | null;
  created_at: string;
  nw_guidelines: unknown | null;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const intentLabels: Record<string, string> = {
  informational: "Informational",
  transactional: "Transaktional",
  navigational: "Navigational",
  commercial: "Commercial Investigation",
};

export default function Briefs() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentProject } = useWorkspace();
  
  const [briefs, setBriefs] = useState<ContentBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // New brief form state
  const [newBrief, setNewBrief] = useState({
    title: "",
    primary_keyword: "",
    search_intent: "informational",
    target_audience: "",
    tonality: "",
    target_length: 1500,
    notes: "",
  });

  useEffect(() => {
    if (currentProject?.id) {
      loadBriefs();
    }
  }, [currentProject?.id]);

  const loadBriefs = async () => {
    if (!currentProject?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("content_briefs")
        .select("*")
        .eq("project_id", currentProject.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBriefs(data || []);
    } catch (error) {
      console.error("Error loading briefs:", error);
      toast({
        title: "Fehler beim Laden",
        description: "Content Briefs konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createBrief = async () => {
    if (!currentProject?.id || !newBrief.title || !newBrief.primary_keyword) {
      toast({
        title: "Pflichtfelder fehlen",
        description: "Titel und Primary Keyword sind erforderlich.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("content_briefs")
        .insert({
          project_id: currentProject.id,
          title: newBrief.title,
          primary_keyword: newBrief.primary_keyword,
          search_intent: newBrief.search_intent,
          target_audience: newBrief.target_audience || null,
          tonality: newBrief.tonality || null,
          target_length: newBrief.target_length || null,
          notes: newBrief.notes || null,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Brief erstellt",
        description: "Neuer Content Brief wurde angelegt.",
      });
      
      setCreateDialogOpen(false);
      setNewBrief({
        title: "",
        primary_keyword: "",
        search_intent: "informational",
        target_audience: "",
        tonality: "",
        target_length: 1500,
        notes: "",
      });
      
      // Navigate to the new brief
      navigate(`/briefs/${data.id}`);
    } catch (error) {
      console.error("Error creating brief:", error);
      toast({
        title: "Fehler",
        description: "Brief konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const filteredBriefs = briefs.filter(
    (brief) =>
      brief.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      brief.primary_keyword.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!currentProject) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Kein Projekt ausgewählt</h2>
          <p className="text-muted-foreground mt-2">
            Wähle zuerst ein Projekt aus, um Content Briefs zu verwalten.
          </p>
          <Button className="mt-4" onClick={() => navigate("/projects")}>
            Zu den Projekten
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Content Briefs</h1>
            <p className="text-muted-foreground">
              SEO-optimierte Briefings für {currentProject.name}
            </p>
          </div>
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Neues Brief
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Neues Content Brief</DialogTitle>
                <DialogDescription>
                  Erstelle ein neues SEO Content Brief für deinen Artikel.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titel *</Label>
                  <Input
                    id="title"
                    placeholder="z.B. Ultimativer Guide zu..."
                    value={newBrief.title}
                    onChange={(e) => setNewBrief({ ...newBrief, title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="keyword">Primary Keyword *</Label>
                  <Input
                    id="keyword"
                    placeholder="z.B. beste seo tools"
                    value={newBrief.primary_keyword}
                    onChange={(e) => setNewBrief({ ...newBrief, primary_keyword: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="intent">Search Intent</Label>
                  <Select
                    value={newBrief.search_intent}
                    onValueChange={(value) => setNewBrief({ ...newBrief, search_intent: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="informational">Informational</SelectItem>
                      <SelectItem value="transactional">Transaktional</SelectItem>
                      <SelectItem value="navigational">Navigational</SelectItem>
                      <SelectItem value="commercial">Commercial Investigation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="audience">Zielgruppe</Label>
                    <Input
                      id="audience"
                      placeholder="z.B. SEO Anfänger"
                      value={newBrief.target_audience}
                      onChange={(e) => setNewBrief({ ...newBrief, target_audience: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="length">Ziel-Wortanzahl</Label>
                    <Input
                      id="length"
                      type="number"
                      value={newBrief.target_length}
                      onChange={(e) => setNewBrief({ ...newBrief, target_length: parseInt(e.target.value) || 1500 })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tonality">Tonalität</Label>
                  <Input
                    id="tonality"
                    placeholder="z.B. professionell, freundlich, locker"
                    value={newBrief.tonality}
                    onChange={(e) => setNewBrief({ ...newBrief, tonality: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notizen</Label>
                  <Textarea
                    id="notes"
                    placeholder="Zusätzliche Anweisungen oder Kontext..."
                    value={newBrief.notes}
                    onChange={(e) => setNewBrief({ ...newBrief, notes: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={createBrief} disabled={creating}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Brief erstellen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Briefs durchsuchen..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Briefs List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredBriefs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">
                {searchQuery ? "Keine Treffer" : "Noch keine Briefs"}
              </h3>
              <p className="text-muted-foreground text-center mt-1">
                {searchQuery
                  ? "Versuche einen anderen Suchbegriff."
                  : "Erstelle dein erstes Content Brief, um loszulegen."}
              </p>
              {!searchQuery && (
                <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Erstes Brief erstellen
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredBriefs.map((brief) => (
              <Card
                key={brief.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/briefs/${brief.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base line-clamp-2">{brief.title}</CardTitle>
                    <Badge className={statusColors[brief.status || "draft"]} variant="secondary">
                      {brief.status || "draft"}
                    </Badge>
                  </div>
                  <CardDescription className="font-mono text-xs">
                    {brief.primary_keyword}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {brief.search_intent && (
                      <Badge variant="outline" className="text-xs">
                        {intentLabels[brief.search_intent] || brief.search_intent}
                      </Badge>
                    )}
                    {brief.target_length && (
                      <span>{brief.target_length} Wörter</span>
                    )}
                    {brief.nw_guidelines && (
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        NW
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
