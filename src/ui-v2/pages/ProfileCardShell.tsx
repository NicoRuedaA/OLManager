import type { ReactNode } from "react";
import { Card, CardContent } from "@/ui-v2/components/ui/card";
import { cn } from "@/ui-v2/lib/utils";

interface ProfileCardShellProps {
  title: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export default function ProfileCardShell({ title, children, className, contentClassName }: ProfileCardShellProps) {
  return (
    <Card className={cn("pt-0 h-full", className)}>
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h3 className="font-heading text-lg font-bold uppercase tracking-wide text-foreground">{title}</h3>
      </div>
      <CardContent className={cn("", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
