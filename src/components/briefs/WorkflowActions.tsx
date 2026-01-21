import { useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, FileText, FileJson, Download, Loader2, CheckCircle2 } from "lucide-react";
import { useAction } from "convex/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface WorkflowActionsProps {
  briefId: string;
  hasGuidelines: boolean;
  articleId: string | null;
  templateId: string | null;
  onOpenImport: () => void;
  onArticleGenerated?: (articleId: string) => void;
}

export const WorkflowActions = memo(function WorkflowActions({
  briefId,
  hasGuidelines,
  articleId,
  templateId,
  onOpenImport,
  onArticleGenerated,
}: WorkflowActionsProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [generatingArticle, setGeneratingArticle] = useState(false);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);

  // Convex actions
  const generateArticle = useAction(api.actions.articleGeneration.generate);

  const handleGenerateArticle = async () => {
    setGeneratingArticle(true);
    try {
      const result = await generateArticle({
        briefId: briefId as Id<"contentBriefs">,
      });

      if (!result.success) {
        throw new Error(result.error || "Artikel konnte nicht generiert werden.");
      }

      toast({
        title: "Artikel generiert",
        description: `"${result.title}" wurde erstellt.`,
      });

      if (result.articleId) {
        onArticleGenerated?.(result.articleId);
        navigate(`/articles/${result.articleId}`);
      }
    } catch (error) {
      console.error("Error generating article:", error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Artikel konnte nicht generiert werden.",
        variant: "destructive",
      });
    } finally {
      setGeneratingArticle(false);
    }
  };

  const handleGenerateTemplate = async () => {
    if (!articleId) return;

    setGeneratingTemplate(true);
    try {
      // For now, just show a message - Elementor template generation needs Convex action
      toast({
        title: "Elementor Templates",
        description: "Diese Funktion wird bald verfügbar sein.",
      });
    } catch (error) {
      console.error("Error generating template:", error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Template konnte nicht generiert werden.",
        variant: "destructive",
      });
    } finally {
      setGeneratingTemplate(false);
    }
  };

  const steps = [
    {
      id: "guidelines",
      label: "NeuronWriter Guidelines",
      icon: Sparkles,
      completed: hasGuidelines,
      action: onOpenImport,
      actionLabel: hasGuidelines ? "Aktualisieren" : "Importieren",
      disabled: false,
    },
    {
      id: "article",
      label: "Artikel generieren",
      icon: FileText,
      completed: !!articleId,
      action: handleGenerateArticle,
      actionLabel: articleId ? "Regenerieren" : "Generieren",
      disabled: !hasGuidelines,
      loading: generatingArticle,
      secondaryAction: articleId ? () => navigate(`/articles/${articleId}`) : undefined,
      secondaryLabel: articleId ? "Bearbeiten" : undefined,
    },
    {
      id: "template",
      label: "Elementor Template",
      icon: FileJson,
      completed: !!templateId,
      action: templateId ? () => navigate(`/templates/${templateId}`) : handleGenerateTemplate,
      actionLabel: templateId ? "Ansehen" : "Generieren",
      disabled: !articleId,
      loading: generatingTemplate,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Content Workflow
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isLoading = step.loading;

            return (
              <div
                key={step.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  step.completed
                    ? "bg-green-500/10 border-green-500/30"
                    : step.disabled
                    ? "bg-muted/30 border-muted"
                    : "bg-card border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      step.completed
                        ? "bg-green-500/20 text-green-600"
                        : step.disabled
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {step.completed ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className={`font-medium ${step.disabled ? "text-muted-foreground" : ""}`}>
                      {step.label}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Schritt {index + 1} von {steps.length}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {step.secondaryAction && step.secondaryLabel && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={step.secondaryAction}
                    >
                      {step.secondaryLabel}
                    </Button>
                  )}
                  <Button
                    variant={step.completed && !step.secondaryAction ? "outline" : "default"}
                    size="sm"
                    onClick={step.action}
                    disabled={step.disabled || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generiere...
                      </>
                    ) : (
                      step.actionLabel
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});
