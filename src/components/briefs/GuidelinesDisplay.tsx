import { useState, useMemo, memo } from "react";
import { ChevronDown, ChevronUp, ExternalLink, HelpCircle, BarChart3, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { NWGuidelines, NWTerm } from "@/lib/api/neuronwriter";

interface GuidelinesDisplayProps {
  guidelines: NWGuidelines;
}

function getTermColor(usage: number): string {
  if (usage >= 3) return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800";
  if (usage >= 2) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800";
  return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800";
}

function TermBadge({ term }: { term: NWTerm }) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge
          variant="outline"
          className={`${getTermColor(term.sugg_usage)} cursor-help`}
        >
          {term.term}
          <span className="ml-1 opacity-70">×{term.sugg_usage}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>Empfohlene Verwendung: {term.sugg_usage}x</p>
        {term.in_title && <p className="text-xs">✓ Im Titel empfohlen</p>}
        {term.in_h1 && <p className="text-xs">✓ In H1 empfohlen</p>}
      </TooltipContent>
    </Tooltip>
  );
}

export const GuidelinesDisplay = memo(function GuidelinesDisplay({ guidelines }: GuidelinesDisplayProps) {
  const [termsExpanded, setTermsExpanded] = useState(true);
  const [questionsExpanded, setQuestionsExpanded] = useState(true);
  const [competitorsExpanded, setCompetitorsExpanded] = useState(false);

  // Defensive checks: ensure all arrays are actually arrays
  const termsArray = Array.isArray(guidelines.terms) ? guidelines.terms : [];
  const questionsArray = Array.isArray(guidelines.questions) ? guidelines.questions : [];
  const ideasArray = Array.isArray(guidelines.ideas) ? guidelines.ideas : [];
  const competitorsArray = Array.isArray(guidelines.competitors) ? guidelines.competitors : [];

  // Optimize: Single-pass categorization instead of three filter passes
  const categorizedTerms = useMemo(() => {
    return termsArray.reduce(
      (acc, term) => {
        if (term.sugg_usage >= 3) {
          acc.high.push(term);
        } else if (term.sugg_usage === 2) {
          acc.medium.push(term);
        } else if (term.sugg_usage === 1) {
          acc.low.push(term);
        }
        return acc;
      },
      { high: [] as typeof termsArray, medium: [] as typeof termsArray, low: [] as typeof termsArray }
    );
  }, [termsArray]);

  const highPriorityTerms = categorizedTerms.high;
  const mediumPriorityTerms = categorizedTerms.medium;
  const lowPriorityTerms = categorizedTerms.low;

  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      {guidelines.metrics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ziel-Wortanzahl</CardDescription>
              <CardTitle className="text-2xl">
                {guidelines.metrics.words_min || 0} - {guidelines.metrics.words_max || 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Durchschnitt: {guidelines.metrics.words_avg || 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Überschriften</CardDescription>
              <CardTitle className="text-2xl">
                {guidelines.metrics.headings_avg || 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Durchschnitt der Top 10</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Absätze</CardDescription>
              <CardTitle className="text-2xl">
                {guidelines.metrics.paragraphs_avg || 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Durchschnitt der Top 10</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Bilder</CardDescription>
              <CardTitle className="text-2xl">
                {guidelines.metrics.images_avg || 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Durchschnitt der Top 10</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* NLP Terms */}
      <Collapsible open={termsExpanded} onOpenChange={setTermsExpanded}>
        <Card>
          <CardHeader>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <CardTitle>NLP Keywords</CardTitle>
                  <Badge variant="secondary">{guidelines.terms?.length || 0}</Badge>
                </div>
                {termsExpanded ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CardDescription>
              Semantisch wichtige Begriffe für SEO-Optimierung
            </CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* High Priority */}
              {highPriorityTerms.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      Hohe Priorität
                    </span>
                    <Badge variant="outline" className="text-xs">
                      3+ Verwendungen
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {highPriorityTerms.map((term, i) => (
                      <TermBadge key={i} term={term} />
                    ))}
                  </div>
                </div>
              )}

              {/* Medium Priority */}
              {mediumPriorityTerms.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                      Mittlere Priorität
                    </span>
                    <Badge variant="outline" className="text-xs">
                      2 Verwendungen
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mediumPriorityTerms.map((term, i) => (
                      <TermBadge key={i} term={term} />
                    ))}
                  </div>
                </div>
              )}

              {/* Low Priority */}
              {lowPriorityTerms.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      Erwähnen
                    </span>
                    <Badge variant="outline" className="text-xs">
                      1 Verwendung
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {lowPriorityTerms.slice(0, 30).map((term, i) => (
                      <TermBadge key={i} term={term} />
                    ))}
                    {lowPriorityTerms.length > 30 && (
                      <Badge variant="outline" className="text-muted-foreground">
                        +{lowPriorityTerms.length - 30} weitere
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Questions */}
      {questionsArray.length > 0 && (
        <Collapsible open={questionsExpanded} onOpenChange={setQuestionsExpanded}>
          <Card>
            <CardHeader>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-primary" />
                    <CardTitle>Content-Fragen</CardTitle>
                    <Badge variant="secondary">{questionsArray.length}</Badge>
                  </div>
                  {questionsExpanded ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CardDescription>
                Fragen die dein Content beantworten sollte
              </CardDescription>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <ul className="space-y-2">
                  {questionsArray.map((question, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-primary font-medium">•</span>
                      {question}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Ideas */}
      {ideasArray.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Content-Ideen</CardTitle>
              <Badge variant="secondary">{ideasArray.length}</Badge>
            </div>
            <CardDescription>
              Themen und Aspekte zum Abdecken
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {ideasArray.map((idea, i) => (
                <Badge key={i} variant="outline">
                  {idea}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Competitors */}
      {competitorsArray.length > 0 && (
        <Collapsible open={competitorsExpanded} onOpenChange={setCompetitorsExpanded}>
          <Card>
            <CardHeader>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <CardTitle>Konkurrenz-Analyse</CardTitle>
                    <Badge variant="secondary">{competitorsArray.length}</Badge>
                  </div>
                  {competitorsExpanded ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CardDescription>
                Top-rankende Seiten für dieses Keyword
              </CardDescription>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="space-y-3">
                  {competitorsArray.map((comp, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="shrink-0">
                            #{comp.position || i + 1}
                          </Badge>
                          <a
                            href={comp.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium truncate hover:underline flex items-center gap-1"
                          >
                            {comp.title || comp.url}
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {comp.url}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground ml-4">
                        {comp.words && <span>{comp.words} Wörter</span>}
                        {comp.score && (
                          <Badge variant="secondary">{comp.score}%</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
});
