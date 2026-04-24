import { useState, useMemo } from "react";
import { useAction, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  BarChart3,
  MousePointerClick,
  Eye,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspaceConvex } from "@/hooks/useWorkspaceConvex";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type Days = 7 | 28 | 90;

interface Totals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface DailyPoint {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface TopRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  clicksChange: number;
  impressionsChange: number;
  positionChange: number;
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat("de-DE").format(Math.round(n));
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

function fmtPos(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  return n.toFixed(1);
}

function diffPct(cur: number, prev: number): number | null {
  if (prev === 0) return cur > 0 ? null : 0;
  return (cur - prev) / prev;
}

function Delta({
  value,
  inverted = false,
}: {
  value: number | null;
  inverted?: boolean;
}) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> —
      </span>
    );
  }
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> 0%
      </span>
    );
  }
  const positive = inverted ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={
        "inline-flex items-center gap-1 text-xs font-medium " +
        (positive ? "text-emerald-600" : "text-red-600")
      }
    >
      <Icon className="h-3 w-3" />
      {(value * 100).toFixed(1)}%
    </span>
  );
}

function PositionDelta({ value }: { value: number }) {
  if (!Number.isFinite(value) || value === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> —
      </span>
    );
  }
  const improved = value > 0;
  const Icon = improved ? TrendingUp : TrendingDown;
  return (
    <span
      className={
        "inline-flex items-center gap-1 text-xs font-medium " +
        (improved ? "text-emerald-600" : "text-red-600")
      }
    >
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}
    </span>
  );
}

function NumberDelta({ value }: { value: number }) {
  if (!Number.isFinite(value) || value === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const positive = value > 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={
        "inline-flex items-center gap-1 text-xs font-medium " +
        (positive ? "text-emerald-600" : "text-red-600")
      }
    >
      <Icon className="h-3 w-3" />
      {positive ? "+" : ""}
      {fmtInt(value)}
    </span>
  );
}

function KpiCard({
  label,
  value,
  previous,
  icon: Icon,
  format,
  invertedDelta = false,
}: {
  label: string;
  value: number;
  previous: number;
  icon: React.ComponentType<{ className?: string }>;
  format: (n: number) => string;
  invertedDelta?: boolean;
}) {
  const d = diffPct(value, previous);
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="text-xs uppercase tracking-wide">
            {label}
          </CardDescription>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <CardTitle className="text-2xl">{format(value)}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 text-xs">
          <Delta value={d} inverted={invertedDelta} />
          <span className="text-muted-foreground">
            vs. {format(previous)} Vorperiode
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function PerformanceChart({ daily }: { daily: DailyPoint[] }) {
  const data = useMemo(
    () =>
      daily.map((d) => ({
        ...d,
        dateLabel: new Date(d.date).toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
        }),
      })),
    [daily]
  );
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11 }}
            width={48}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11 }}
            width={48}
          />
          <ReTooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--background))",
            }}
            formatter={(v: number, name: string) => {
              if (name === "Clicks") return [fmtInt(v), "Clicks"];
              if (name === "Impressions") return [fmtInt(v), "Impressions"];
              return [v, name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="clicks"
            name="Clicks"
            stroke="#003366"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="impressions"
            name="Impressions"
            stroke="#ff6600"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Analytics() {
  const navigate = useNavigate();
  const { currentProject, isLoading } = useWorkspaceConvex();
  const [days, setDays] = useState<Days>(28);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [perf, setPerf] = useState<{
    range: { startDate: string; endDate: string };
    previousRange: { startDate: string; endDate: string };
    totals: Totals;
    previousTotals: Totals;
    daily: DailyPoint[];
  } | null>(null);
  const [topQueries, setTopQueries] = useState<TopRow[]>([]);
  const [topPages, setTopPages] = useState<TopRow[]>([]);

  const connection = useQuery(
    api.tables.gscConnections.getByProject,
    currentProject?._id
      ? { projectId: currentProject._id as Id<"projects"> }
      : "skip"
  );

  const getPerformance = useAction(api.actions.gsc.getPerformance);
  const getTopQueries = useAction(api.actions.gsc.getTopQueries);
  const getTopPages = useAction(api.actions.gsc.getTopPages);

  const loadAll = async (n: Days) => {
    if (!currentProject?._id) return;
    setLoading(true);
    setError(null);
    try {
      const [p, q, pages] = await Promise.all([
        getPerformance({ projectId: currentProject._id, days: n }),
        getTopQueries({ projectId: currentProject._id, days: n, limit: 50 }),
        getTopPages({ projectId: currentProject._id, days: n, limit: 50 }),
      ]);
      if (!p.success) throw new Error(p.error ?? "Performance konnte nicht geladen werden");
      if (!q.success) throw new Error(q.error ?? "Top Queries konnten nicht geladen werden");
      if (!pages.success) throw new Error(pages.error ?? "Top Pages konnten nicht geladen werden");
      setPerf({
        range: p.range!,
        previousRange: p.previousRange!,
        totals: p.totals!,
        previousTotals: p.previousTotals!,
        daily: p.daily ?? [],
      });
      setTopQueries(q.rows ?? []);
      setTopPages(pages.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (v: string) => {
    if (!v) return;
    const n = Number(v) as Days;
    setDays(n);
    void loadAll(n);
  };

  if (!isLoading && !currentProject) {
    return (
      <AppLayout title="Analytics">
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Kein Projekt ausgewählt</h2>
          <Button onClick={() => navigate("/projects")}>Zu den Projekten</Button>
        </div>
      </AppLayout>
    );
  }

  if (!currentProject) {
    return <AppLayout title="Lade…"><div /></AppLayout>;
  }

  const prefix = `/projects/${currentProject._id}`;
  const hasConnection = Boolean(connection?.googleAccountId);

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Projekte", href: "/projects" },
        { label: currentProject.name, href: prefix },
        { label: "Analytics" },
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Analytics
            </h1>
            <p className="text-muted-foreground">
              Google Search Console – Clicks, Impressions, CTR und Positionen für{" "}
              <strong>{currentProject.name}</strong>
            </p>
          </div>
          {hasConnection && (
            <div className="flex items-center gap-2">
              <ToggleGroup
                type="single"
                value={String(days)}
                onValueChange={handlePeriodChange}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="7">7 Tage</ToggleGroupItem>
                <ToggleGroupItem value="28">28 Tage</ToggleGroupItem>
                <ToggleGroupItem value="90">90 Tage</ToggleGroupItem>
              </ToggleGroup>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadAll(days)}
                disabled={loading}
              >
                <RefreshCw
                  className={"h-4 w-4 " + (loading ? "animate-spin" : "")}
                />
              </Button>
            </div>
          )}
        </div>

        {!hasConnection && (
          <Card>
            <CardHeader>
              <CardTitle>Google Search Console verbinden</CardTitle>
              <CardDescription>
                Verbinde deine GSC-Property, um Performance-Daten für dieses
                Projekt zu sehen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate(`${prefix}/settings`)}>
                Zu den Projekt-Einstellungen
              </Button>
            </CardContent>
          </Card>
        )}

        {hasConnection && !perf && !loading && !error && (
          <Card>
            <CardHeader>
              <CardTitle>Bereit</CardTitle>
              <CardDescription>
                Property: <span className="font-mono">{connection?.gscProperty}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => void loadAll(days)}>
                Daten laden
              </Button>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Fehler beim Laden
              </CardTitle>
              <CardDescription className="text-destructive/80">
                {error}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => void loadAll(days)}>
                Erneut versuchen
              </Button>
            </CardContent>
          </Card>
        )}

        {loading && !perf && (
          <div className="grid gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs uppercase tracking-wide">
                    Lade…
                  </CardDescription>
                  <CardTitle className="text-2xl">…</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {perf && (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <KpiCard
                label="Clicks"
                value={perf.totals.clicks}
                previous={perf.previousTotals.clicks}
                icon={MousePointerClick}
                format={fmtInt}
              />
              <KpiCard
                label="Impressions"
                value={perf.totals.impressions}
                previous={perf.previousTotals.impressions}
                icon={Eye}
                format={fmtInt}
              />
              <KpiCard
                label="CTR"
                value={perf.totals.ctr}
                previous={perf.previousTotals.ctr}
                icon={TrendingUp}
                format={fmtPct}
              />
              <KpiCard
                label="Ø Position"
                value={perf.totals.position}
                previous={perf.previousTotals.position}
                icon={BarChart3}
                format={fmtPos}
                invertedDelta
              />
            </div>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList>
                <TabsTrigger value="overview">Überblick</TabsTrigger>
                <TabsTrigger value="queries">Top Keywords</TabsTrigger>
                <TabsTrigger value="pages">Top URLs</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Trend</CardTitle>
                    <CardDescription>
                      {perf.range.startDate} – {perf.range.endDate} ({perf.daily.length} Tage)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {perf.daily.length > 0 ? (
                      <PerformanceChart daily={perf.daily} />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Keine Tagesdaten im Zeitraum.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="queries" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Keywords</CardTitle>
                    <CardDescription>
                      Sortiert nach Clicks. Veränderung vs. Vorperiode{" "}
                      ({perf.previousRange.startDate} – {perf.previousRange.endDate}).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Keyword</TableHead>
                          <TableHead className="text-right">Clicks</TableHead>
                          <TableHead className="text-right">Δ Clicks</TableHead>
                          <TableHead className="text-right">Impressions</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">Ø Pos.</TableHead>
                          <TableHead className="text-right">Δ Pos.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topQueries.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={7}
                              className="text-center text-sm text-muted-foreground py-8"
                            >
                              Keine Daten im Zeitraum.
                            </TableCell>
                          </TableRow>
                        )}
                        {topQueries.map((r) => (
                          <TableRow key={r.key}>
                            <TableCell className="font-medium max-w-[360px] truncate">
                              {r.key}
                            </TableCell>
                            <TableCell className="text-right">
                              {fmtInt(r.clicks)}
                            </TableCell>
                            <TableCell className="text-right">
                              <NumberDelta value={r.clicksChange} />
                            </TableCell>
                            <TableCell className="text-right">
                              {fmtInt(r.impressions)}
                            </TableCell>
                            <TableCell className="text-right">
                              {fmtPct(r.ctr)}
                            </TableCell>
                            <TableCell className="text-right">
                              {fmtPos(r.position)}
                            </TableCell>
                            <TableCell className="text-right">
                              <PositionDelta value={r.positionChange} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pages" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Top URLs</CardTitle>
                    <CardDescription>
                      Sortiert nach Clicks. Veränderung vs. Vorperiode{" "}
                      ({perf.previousRange.startDate} – {perf.previousRange.endDate}).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>URL</TableHead>
                          <TableHead className="text-right">Clicks</TableHead>
                          <TableHead className="text-right">Δ Clicks</TableHead>
                          <TableHead className="text-right">Impressions</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">Ø Pos.</TableHead>
                          <TableHead className="text-right">Δ Pos.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topPages.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={7}
                              className="text-center text-sm text-muted-foreground py-8"
                            >
                              Keine Daten im Zeitraum.
                            </TableCell>
                          </TableRow>
                        )}
                        {topPages.map((r) => {
                          let shortUrl = r.key;
                          try {
                            const u = new URL(r.key);
                            shortUrl = u.pathname + u.search;
                          } catch {
                            // keep raw key
                          }
                          return (
                            <TableRow key={r.key}>
                              <TableCell className="font-medium max-w-[420px]">
                                <a
                                  href={r.key}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="flex items-center gap-1 hover:underline truncate"
                                  title={r.key}
                                >
                                  <span className="truncate">{shortUrl}</span>
                                  <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                                </a>
                              </TableCell>
                              <TableCell className="text-right">
                                {fmtInt(r.clicks)}
                              </TableCell>
                              <TableCell className="text-right">
                                <NumberDelta value={r.clicksChange} />
                              </TableCell>
                              <TableCell className="text-right">
                                {fmtInt(r.impressions)}
                              </TableCell>
                              <TableCell className="text-right">
                                {fmtPct(r.ctr)}
                              </TableCell>
                              <TableCell className="text-right">
                                {fmtPos(r.position)}
                              </TableCell>
                              <TableCell className="text-right">
                                <PositionDelta value={r.positionChange} />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  );
}
