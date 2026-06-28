interface OutreachStatsProps {
  stats: {
    totalProspects: number;
    byStatus: Record<string, number>;
    byTier: Record<string, number>;
    wonGoals: number;
    openGoals: number;
  } | null;
}

export function OutreachStats({ stats }: OutreachStatsProps) {
  const totalProspects = stats?.totalProspects ?? 0;
  const tierA = stats?.byTier.A ?? 0;
  const tierB = stats?.byTier.B ?? 0;
  const replies = stats?.byStatus.replied ?? 0;
  const openGoals = stats?.openGoals ?? 0;
  const wonGoals = stats?.wonGoals ?? 0;

  const items = [
    { label: "Prospects", value: totalProspects },
    { label: "Tier A/B", value: `${tierA}/${tierB}` },
    { label: "Antworten", value: replies },
    { label: "Ziele offen", value: openGoals },
    { label: "Ziele gewonnen", value: wonGoals },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">{item.label}</p>
          <p className="text-2xl font-semibold">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
