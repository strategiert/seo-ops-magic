import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useMutation } from "convex/react";
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
import { useWorkspaceConvex } from "@/hooks/useWorkspaceConvex";
import { api } from "../../../convex/_generated/api";

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (campaignId: string) => void;
}

function parseLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function CreateCampaignDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateCampaignDialogProps) {
  const { toast } = useToast();
  const { currentProject } = useWorkspaceConvex();
  const createCampaign = useMutation(api.tables.outreach.createCampaign);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    targetDomain: "",
    competitors: "",
    goalTargets: "",
  });

  const reset = () => {
    setFormData({
      name: "",
      targetDomain: "",
      competitors: "",
      goalTargets: "",
    });
  };

  const handleClose = () => {
    if (!isCreating) {
      reset();
      onOpenChange(false);
    }
  };

  const handleCreate = async () => {
    if (!currentProject?._id) {
      toast({
        title: "Kein Projekt ausgewaehlt",
        description: "Bitte waehle zuerst ein Projekt aus.",
        variant: "destructive",
      });
      return;
    }

    const name = formData.name.trim();
    if (!name) {
      toast({
        title: "Name erforderlich",
        description: "Bitte gib einen Kampagnennamen ein.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const goalText = formData.goalTargets.trim();
      const campaignId = await createCampaign({
        projectId: currentProject._id,
        name,
        campaignType: "linkbuilding",
        targetDomain: formData.targetDomain.trim() || undefined,
        competitors: parseLines(formData.competitors),
        goalTargetsJson: goalText ? { notes: goalText } : undefined,
      });

      toast({
        title: "Kampagne erstellt",
        description: `"${name}" wurde angelegt.`,
      });

      reset();
      onOpenChange(false);
      onCreated(campaignId);
    } catch (error) {
      console.error("Error creating outreach campaign:", error);
      toast({
        title: "Fehler",
        description: "Die Kampagne konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Outreach-Kampagne erstellen</DialogTitle>
          <DialogDescription>
            Lege die erste Linkbuilding-Kampagne fuer dieses Projekt an.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Name *</Label>
            <Input
              id="campaign-name"
              value={formData.name}
              onChange={(event) =>
                setFormData((current) => ({ ...current, name: event.target.value }))
              }
              disabled={isCreating}
              placeholder="z.B. Q3 Linkbuilding"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-domain">Ziel-Domain</Label>
            <Input
              id="target-domain"
              value={formData.targetDomain}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  targetDomain: event.target.value,
                }))
              }
              disabled={isCreating}
              placeholder="example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="competitors">Wettbewerber</Label>
            <Textarea
              id="competitors"
              value={formData.competitors}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  competitors: event.target.value,
                }))
              }
              disabled={isCreating}
              rows={4}
              placeholder={"competitor-a.de\ncompetitor-b.de"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-targets">Ziele</Label>
            <Textarea
              id="goal-targets"
              value={formData.goalTargets}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  goalTargets: event.target.value,
                }))
              }
              disabled={isCreating}
              rows={3}
              placeholder="10 neue relevante Referring Domains in 90 Tagen"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Abbrechen
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !formData.name.trim()}>
            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isCreating ? "Erstelle..." : "Erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
