import { Shield } from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, PolarRadiusAxis } from "recharts";
import type { PlayerAttributeGroup } from "@/lib/playerProfile/attributes";
import ProfileCardShell from "@/ui-v2/pages/ProfileCardShell";

interface PlayerProfileAttributesCardV2Props {
  attrGroups: PlayerAttributeGroup[];
  canViewAttributes: boolean;
  title: string;
  averageLabel?: string;
  hiddenTitle: string;
  hiddenBody: string;
}

export default function PlayerProfileAttributesCardV2({
  attrGroups,
  canViewAttributes,
  title,
  hiddenTitle,
  hiddenBody,
}: PlayerProfileAttributesCardV2Props) {
  const radarData = canViewAttributes
    ? attrGroups
        .flatMap((g) => g.attrs)
        .filter((a) => a.value !== null && a.value > 0)
        .map((a) => ({
          stat: a.name,
          value: a.value,
          fullMark: 100,
        }))
    : [];

  const tickCount = 5;

  return (
    <ProfileCardShell title={title} contentClassName="p-0">
      {canViewAttributes ? (
        radarData.length > 0 ? (
          <div className="flex items-center justify-center p-2">
            <RadarChart
              width={380}
              height={320}
              data={radarData}
              cx="50%"
              cy="50%"
              outerRadius="68%"
            >
              <PolarGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <PolarAngleAxis
                dataKey="stat"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
              />
              <PolarRadiusAxis
                domain={[0, 100]}
                tick={false}
                axisLine={false}
                tickCount={tickCount}
              />
              <Radar
                name="Attributes"
                dataKey="value"
                stroke="#F97316"
                fill="#F97316"
                fillOpacity={0.15}
                strokeWidth={2}
                dot={{ r: 3, fill: "#F97316", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#F97316", stroke: "#fff", strokeWidth: 2 }}
              />
            </RadarChart>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-xs text-muted-foreground/70">
            No attribute data available
          </div>
        )
      ) : (
        <div className="py-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
            <Shield className="size-7 text-muted-foreground/70" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">{hiddenTitle}</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground/70">{hiddenBody}</p>
        </div>
      )}
    </ProfileCardShell>
  );
}
