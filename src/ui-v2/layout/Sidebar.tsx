import { NavLink } from "react-router-dom";
import {
  ChevronLeft,
  Trophy,
  Radio,
  History,
  Newspaper,
  Users,
  CircleDollarSign,
  Settings,
  LogOut,
  Tv,
} from "lucide-react";
import { cn } from "@/ui-v2/lib/utils";
import { Button } from "@/ui-v2/components/ui/button";
import { Separator } from "@/ui-v2/components/ui/separator";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { to: string; label: string }[];
};

const NAV: NavItem[] = [
  {
    to: "/v2/live",
    label: "Live Matches",
    icon: Radio,
    children: [
      { to: "/v2/live/serie-a", label: "Serie A" },
      { to: "/v2/live/premier", label: "Premier League" },
      { to: "/v2/live/ligue-1", label: "Ligue 1" },
      { to: "/v2/live/bundesliga", label: "Bundesliga" },
    ],
  },
  { to: "/v2/history", label: "Matches History", icon: History },
  { to: "/v2/insider", label: "Leagues Insider", icon: Newspaper },
  { to: "/v2/players", label: "Players Database", icon: Users },
  { to: "/v2/betting", label: "Betting", icon: CircleDollarSign },
];

const FOOTER: NavItem[] = [
  { to: "/v2/settings/transmission", label: "Live Transmission Settings", icon: Tv },
  { to: "/v2/settings/account", label: "Account Settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="p-3">
        <Button className="w-full justify-start gap-2" size="lg">
          <ChevronLeft className="size-4" />
          Back to AC Milan
        </Button>
      </div>

      <div className="px-4 pb-4 pt-2 flex flex-col items-center text-center">
        <div className="size-14 rounded-full bg-muted ring-2 ring-primary" />
        <div className="mt-2 text-sm font-medium">ScudettoMan</div>
        <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Trophy className="size-3 text-primary" /> 32
        </div>
      </div>

      <Separator />

      <nav className="flex-1 overflow-y-auto px-2 py-3 text-sm">
        {NAV.map((item) => (
          <NavSection key={item.to} item={item} />
        ))}
      </nav>

      <Separator />

      <div className="px-2 py-3 text-sm">
        {FOOTER.map((item) => (
          <NavSection key={item.to} item={item} />
        ))}
        <button className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
          <LogOut className="size-4" />
          Log Out
        </button>
      </div>
    </aside>
  );
}

function NavSection({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <div>
      <NavLink
        to={item.to}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-2 rounded-md px-3 py-2 transition-colors",
            isActive
              ? "bg-sidebar-accent text-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
          )
        }
      >
        <Icon className="size-4" />
        <span className="flex-1 truncate">{item.label}</span>
      </NavLink>
      {item.children && (
        <div className="ml-7 mt-0.5 space-y-0.5 border-l border-border pl-3">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) =>
                cn(
                  "block rounded-md px-2 py-1 text-xs transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
