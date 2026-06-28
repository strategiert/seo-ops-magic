import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useMutation } from "convex/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type SequenceStep = {
  dayOffset: number;
  subject: string;
  body: string;
};

type SequenceRecord = {
  _id: Id<"outreachSequences">;
  name: string;
  steps: unknown[];
  variants?: unknown;
  approvalStatus: string;
};

interface SequenceEditorProps {
  campaignId: Id<"outreachCampaigns">;
  sequence?: SequenceRecord | null;
}

const defaultStep: SequenceStep = {
  dayOffset: 0,
  subject: "Kurzer Hinweis zu {{siteName}}",
  body:
    "Hallo {{firstName}},\n\nich bin auf {{siteName}} gestoßen und dachte, unsere Ressource zu {{topic}} könnte für Ihre Leser hilfreich sein.\n\nViele Grüße\n{{senderName}}",
};

const followUpStep: SequenceStep = {
  dayOffset: 4,
  subject: "Re: Kurzer Hinweis zu {{siteName}}",
  body:
    "Hallo {{firstName}},\n\nich wollte kurz nachhaken, ob die Ressource zu {{topic}} für Ihre Seite interessant sein könnte.\n\nViele Grüße\n{{senderName}}",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSteps(steps: unknown[] | undefined): SequenceStep[] {
  if (!steps || steps.length === 0) return [defaultStep];

  return steps.filter(isRecord).map((step) => ({
    dayOffset: typeof step.dayOffset === "number" ? step.dayOffset : 0,
    subject: typeof step.subject === "string" ? step.subject : defaultStep.subject,
    body: typeof step.body === "string" ? step.body : defaultStep.body,
  }));
}

export function SequenceEditor({ campaignId, sequence }: SequenceEditorProps) {
  const { toast } = useToast();
  const upsertSequence = useMutation(api.tables.outreach.upsertSequence);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(sequence?.name || "Linkbuilding Outreach");
  const [steps, setSteps] = useState<SequenceStep[]>(normalizeSteps(sequence?.steps));
  const [approved, setApproved] = useState(sequence?.approvalStatus === "approved");

  useEffect(() => {
    setName(sequence?.name || "Linkbuilding Outreach");
    setSteps(normalizeSteps(sequence?.steps));
    setApproved(sequence?.approvalStatus === "approved");
  }, [sequence]);

  const updateStep = (index: number, updates: Partial<SequenceStep>) => {
    setSteps((current) =>
      current.map((step, currentIndex) =>
        currentIndex === index ? { ...step, ...updates } : step
      )
    );
  };

  const addStep = () => {
    setSteps((current) => [
      ...current,
      current.length === 0 ? defaultStep : { ...followUpStep, dayOffset: current.length * 4 },
    ]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await upsertSequence({
        campaignId,
        sequenceId: sequence?._id,
        name: name.trim() || "Linkbuilding Outreach",
        steps,
        variants: sequence?.variants,
        approvalStatus: approved ? "approved" : "draft",
      });

      toast({
        title: "Sequenz gespeichert",
        description: "Die Outreach-Sequenz wurde aktualisiert.",
      });
    } catch (error) {
      console.error("Error saving sequence:", error);
      toast({
        title: "Speichern fehlgeschlagen",
        description: "Die Sequenz konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2 flex-1">
          <Label htmlFor="sequence-name">Sequenzname</Label>
          <Input
            id="sequence-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className="flex items-center gap-3 border rounded-lg px-3 py-2">
          <Switch
            id="sequence-approved"
            checked={approved}
            onCheckedChange={setApproved}
            disabled={isSaving}
          />
          <Label htmlFor="sequence-approved" className="cursor-pointer">
            Freigegeben
          </Label>
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={index} className="border rounded-lg p-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-[140px_1fr]">
              <div className="space-y-2">
                <Label htmlFor={`step-day-${index}`}>Tag</Label>
                <Input
                  id={`step-day-${index}`}
                  type="number"
                  min={0}
                  value={step.dayOffset}
                  onChange={(event) =>
                    updateStep(index, { dayOffset: Number(event.target.value) })
                  }
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`step-subject-${index}`}>Betreff</Label>
                <Input
                  id={`step-subject-${index}`}
                  value={step.subject}
                  onChange={(event) => updateStep(index, { subject: event.target.value })}
                  disabled={isSaving}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`step-body-${index}`}>Nachricht</Label>
              <Textarea
                id={`step-body-${index}`}
                value={step.body}
                onChange={(event) => updateStep(index, { body: event.target.value })}
                disabled={isSaving}
                rows={7}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={addStep} disabled={isSaving}>
          <Plus className="h-4 w-4 mr-2" />
          Schritt hinzufügen
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isSaving ? "Speichert..." : "Speichern"}
        </Button>
      </div>
    </div>
  );
}
