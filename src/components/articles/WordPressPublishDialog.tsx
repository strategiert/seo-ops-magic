import { useState, useEffect } from "react";
import { Loader2, Globe, CheckCircle2, ExternalLink, RefreshCw, Palette } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useWordPress, type TaxonomyItem } from "@/hooks/useWordPress";

interface WordPressPublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleId: string;
  articleTitle: string;
  onPublished?: (wpUrl: string) => void;
}

export function WordPressPublishDialog({
  open,
  onOpenChange,
  articleId,
  articleTitle,
  onPublished,
}: WordPressPublishDialogProps) {
  const { toast } = useToast();
  const {
    taxonomies,
    loadingTaxonomies,
    taxonomiesError,
    fetchTaxonomies,
    publishArticle,
    publishingArticleId,
  } = useWordPress();

  const [status, setStatus] = useState<"publish" | "draft">("draft");
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [useStyledHtml, setUseStyledHtml] = useState(true);

  const isPublishing = publishingArticleId === articleId;

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPublishedUrl(null);
      setSelectedCategories([]);
      setSelectedTags([]);
      setStatus("draft");
      setUseStyledHtml(true);
    }
  }, [open]);

  const handleCategoryToggle = (categoryId: number) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleTagToggle = (tagId: number) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handlePublish = async () => {
    const result = await publishArticle(articleId, {
      status,
      categoryIds: selectedCategories,
      tagIds: selectedTags,
      useStyledHtml,
    });

    if (result.success && result.wpUrl) {
      setPublishedUrl(result.wpUrl);
      toast({
        title: status === "publish" ? "Veröffentlicht!" : "Als Entwurf gespeichert",
        description: `Artikel wurde zu WordPress übertragen.`,
      });
      onPublished?.(result.wpUrl);
    } else {
      toast({
        title: "Fehler",
        description: result.error || "Artikel konnte nicht veröffentlicht werden.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Zu WordPress publishen
          </DialogTitle>
          <DialogDescription>
            "{articleTitle}"
          </DialogDescription>
        </DialogHeader>

        {publishedUrl ? (
          // Success state
          <div className="py-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <div>
              <p className="font-medium text-lg">Erfolgreich übertragen!</p>
              <a
                href={publishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1 mt-2"
              >
                In WordPress öffnen
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        ) : (
          // Form state
          <div className="space-y-6 py-4">
            {/* Status Selection */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "publish" | "draft")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Entwurf (Draft)</SelectItem>
                  <SelectItem value="publish">Sofort veröffentlichen</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Styled HTML Toggle */}
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <Palette className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="styled-html" className="cursor-pointer">Design verwenden</Label>
                  <p className="text-xs text-muted-foreground">
                    AI generiert gestyltes HTML mit Brand-Design
                  </p>
                </div>
              </div>
              <Switch
                id="styled-html"
                checked={useStyledHtml}
                onCheckedChange={setUseStyledHtml}
              />
            </div>

            {/* Categories */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Kategorien</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchTaxonomies}
                  disabled={loadingTaxonomies}
                >
                  <RefreshCw className={`h-3 w-3 ${loadingTaxonomies ? "animate-spin" : ""}`} />
                </Button>
              </div>
              {loadingTaxonomies ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Lade Kategorien...
                </div>
              ) : taxonomiesError ? (
                <p className="text-sm text-destructive">{taxonomiesError}</p>
              ) : taxonomies?.categories && taxonomies.categories.length > 0 ? (
                <div className="flex flex-wrap gap-2 max-h-32 overflow-auto p-2 border rounded-md">
                  {taxonomies.categories.map((cat) => (
                    <label
                      key={cat.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedCategories.includes(cat.id)}
                        onCheckedChange={() => handleCategoryToggle(cat.id)}
                      />
                      <span className="text-sm">{cat.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {cat.count}
                      </Badge>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Keine Kategorien gefunden</p>
              )}
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              {loadingTaxonomies ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Lade Tags...
                </div>
              ) : taxonomies?.tags && taxonomies.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2 max-h-32 overflow-auto p-2 border rounded-md">
                  {taxonomies.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => handleTagToggle(tag.id)}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Keine Tags gefunden</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {publishedUrl ? (
            <Button onClick={() => onOpenChange(false)}>Schließen</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button onClick={handlePublish} disabled={isPublishing}>
                {isPublishing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {status === "publish" ? "Veröffentlichen" : "Als Entwurf speichern"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
