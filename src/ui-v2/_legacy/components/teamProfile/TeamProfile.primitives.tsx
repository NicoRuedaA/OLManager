import type { ReactNode } from "react";

export function QuickStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-card p-3 text-center">
      <p className="text-xs text-muted-foreground/70 font-heading uppercase tracking-wider">
        {label}
      </p>
      <p className={`font-heading font-bold text-lg mt-0.5 ${color}`}>
        {value}
      </p>
    </div>
  );
}

export function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
      <div className="text-muted-foreground/70">{icon}</div>
      <span className="text-sm text-muted-foreground flex-1">
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}

export function StatBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-2.5 rounded-lg ${highlight ? "bg-primary/10" : "bg-muted"}`}
    >
      <p
        className={`font-heading font-bold text-lg tabular-nums ${highlight ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground/70 font-heading uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}

