import { Shield } from "lucide-react";
import { getAttributeColorClass } from "@/lib/playerProfile/helpers";
import type { PlayerAttributeGroup } from "@/lib/playerProfile/attributes";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui-v2/components/ui/card";
import { cn } from "@/ui-v2/lib/utils";

interface PlayerProfileAttributesCardV2Props {
  attrGroups: PlayerAttributeGroup[];
  canViewAttributes: boolean;
  title: string;
  averageLabel: string;
  hiddenTitle: string;
  hiddenBody: string;
}

export default function PlayerProfileAttributesCardV2({
  attrGroups,
  canViewAttributes,
  title,
  averageLabel,
  hiddenTitle,
  hiddenBody,
}: PlayerProfileAttributesCardV2Props) {
  return (
    <Card>
      <CardHeader className="space-y-0">
        <CardTitle className="font-heading text-sm uppercase tracking-widest text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {canViewAttributes ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {attrGroups.map((group) => (
              <div key={group.label}>
                <h4 className="mb-2 border-b border-border/60 pb-1.5 font-heading text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h4>
                <div className="-mx-1.5 mb-1.5 flex items-center gap-2 rounded bg-muted/50 px-1.5">
                  <span className="w-20 font-heading text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
                    {averageLabel}
                  </span>
                  <div className="flex-1" />
                  <span className="w-7 text-right font-heading text-xs font-bold tabular-nums text-foreground">
                    {group.average ?? "??"}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {group.attrs.map((attr) => (
                    <div key={attr.name} className="flex items-center gap-2">
                      <span className="w-20 text-xs text-muted-foreground/70">{attr.name}</span>
                      {attr.value !== null ? (
                        <>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${attr.value}%` }} />
                          </div>
                          <span className={cn("w-7 text-right font-heading text-xs font-bold tabular-nums", getAttributeColorClass(attr.value))}>
                            {attr.value}
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full w-1/3 rounded-full bg-muted-foreground/20" />
                          </div>
                          <span className="w-7 text-right font-heading text-xs font-bold tabular-nums text-muted-foreground/70">??</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
              <Shield className="size-7 text-muted-foreground/70" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">{hiddenTitle}</p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground/70">{hiddenBody}</p>
            <div className="mt-6 grid grid-cols-1 gap-6 text-left md:grid-cols-3">
              {attrGroups.map((group) => (
                <div key={group.label}>
                  <h4 className="mb-2 font-heading text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
                    {group.label}
                  </h4>
                  {group.attrs.map((attr) => (
                    <div key={attr.name} className="mb-1.5 flex items-center gap-3">
                      <span className="w-24 text-xs text-muted-foreground/70">{attr.name}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full w-1/3 rounded-full bg-muted-foreground/20" />
                      </div>
                      <span className="w-6 text-right text-xs text-muted-foreground/70">??</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
