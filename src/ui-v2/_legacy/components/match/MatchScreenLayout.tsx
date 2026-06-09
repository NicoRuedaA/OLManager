import type { ReactNode } from "react";

import { ThemeToggle } from "@/ui-v2/_legacy/components/ui";

interface MatchScreenLayoutProps {
  children: ReactNode;
  contentClassName?: string;
  footer?: ReactNode;
  header?: ReactNode;
  headerClassName?: string;
  headerContentClassName?: string;
  showThemeToggle?: boolean;
  themeToggleClassName?: string;
}

function joinClasses(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export default function MatchScreenLayout({
  children,
  contentClassName,
  footer,
  header,
  headerClassName,
  headerContentClassName,
  showThemeToggle = true,
  themeToggleClassName,
}: MatchScreenLayoutProps) {
  return (
    <div className="min-h-0 flex-1 bg-background text-foreground flex flex-col">
      {header && (
        <header
          className={joinClasses(
            "border-b border-border",
            headerClassName,
          )}
        >
          <div
            className={joinClasses(
              "relative mx-auto w-full px-6",
              headerContentClassName,
            )}
          >
{header}
          </div>
        </header>
      )}

      <div className={joinClasses("flex-1", contentClassName)}>{children}</div>

      {showThemeToggle && (
        <div className="flex justify-center py-4">
          <ThemeToggle className={themeToggleClassName} />
        </div>
      )}

      {footer}
    </div>
  );
}
