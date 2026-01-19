import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

interface CreateArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (articleId: string) => void;
}

export function CreateArticleDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateArticleDialogProps) {
  const { toast } = useToast();
  const { currentProject } = useWorkspace();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    primaryKeyword: "",
    content: "",
  });

  const handleCreate = async () => {
    if (!currentProject?.id) {
      toast({
        title: "Kein Projekt ausgewählt",
        description: "Bitte wähle zuerst ein Projekt aus.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.title.trim()) {
      toast({
        title: "Titel erforderlich",
        description: "Bitte gib einen Titel für den Artikel ein.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from("articles")
        .insert({
          project_id: currentProject.id,
          title: formData.title.trim(),
          primary_keyword: formData.primaryKeyword.trim() || null,
          content_markdown: formData.content.trim() || null,
          status: "draft",
          version: 1,
        })
        .select("id")
        .single();

      if (error) throw error;

      toast({
        title: "Artikel erstellt",
        description: `"${formData.title}" wurde erfolgreich erstellt.`,
      });

      // Reset form
      setFormData({ title: "", primaryKeyword: "", content: "" });
      onOpenChange(false);
      onCreated(data.id);
    } catch (error) {
      console.error("Error creating article:", error);
      toast({
        title: "Fehler",
        description: "Der Artikel konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setFormData({ title: "", primaryKeyword: "", content: "" });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Artikel ohne Brief erstellen</DialogTitle>
          <DialogDescription>
            Erstelle einen Artikel direkt ohne Content Brief. Du kannst den
            Inhalt später bearbeiten.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titel *</Label>
            <Input
              id="title"
              placeholder="Artikeltitel eingeben..."
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              disabled={isCreating}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="keyword">Primary Keyword (optional)</Label>
            <Input
              id="keyword"
              placeholder="z.B. seo optimierung"
              value={formData.primaryKeyword}
              onChange={(e) =>
                setFormData({ ...formData, primaryKeyword: e.target.value })
              }
              disabled={isCreating}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">Inhalt (optional)</Label>
            <Textarea
              id="content"
              placeholder="Markdown-Inhalt hier eingeben..."
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              disabled={isCreating}
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Markdown wird unterstützt
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Abbrechen
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isCreating ? "Erstelle..." : "Erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
