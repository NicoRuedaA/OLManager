import { useTranslation } from "react-i18next";
import {
  Briefcase,
  Mail,
  Newspaper,
  MessageCircle,
  Calendar as CalendarIcon,
  Users,
  Crosshair,
  Dumbbell,
  Swords,
  Gamepad2,
  UserCog,
  Eye,
  GraduationCap,
  DollarSign,
  TrendingUp,
  UsersRound,
  Building2,
  Globe,
  Store,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/ui-v2/lib/utils";
import { Separator } from "@/ui-v2/components/ui/separator";
import { Badge } from "@/ui-v2/components/ui/badge";

type Item = { tab: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number };

interface Props {
  activeTab: string;
  onNavClick: (tab: string) => void;
  unreadMessagesCount: number;
  managerName: string | null;
  managerFullName?: string | null;
  managerAvatar?: string | null;
  teamName: string | null;
  teamLogo: string | null;
  isUnemployed: boolean;
  onNavigateSettings: () => void;
  onExitClick: () => void;
  playerCount?: number;
  teamCount?: number;
  staffCount?: number;
}

export function DashboardSidebarV2({
  activeTab,
  onNavClick,
  unreadMessagesCount,
  managerName,
  managerFullName,
  managerAvatar,
  teamName,
  teamLogo,
  isUnemployed,
  onNavigateSettings,
  onExitClick,
  playerCount = 0,
  teamCount = 0,
  staffCount = 0,
}: Props) {
  const { t } = useTranslation();

  const top: Item[] = [
    { tab: "Home", label: t("dashboard.home"), icon: Briefcase },
    { tab: "Inbox", label: t("dashboard.inbox"), icon: Mail, badge: unreadMessagesCount },
    { tab: "News", label: t("dashboard.news"), icon: Newspaper },
    { tab: "Social", label: t("dashboard.social", { defaultValue: "Social" }), icon: MessageCircle },
    { tab: "Schedule", label: t("dashboard.schedule"), icon: CalendarIcon },
  ];

  const club: Item[] = [
    { tab: "Squad", label: t("dashboard.squad"), icon: Users },
    { tab: "Tactics", label: t("dashboard.tactics"), icon: Crosshair },
    { tab: "Training", label: t("dashboard.training"), icon: Dumbbell },
    { tab: "Scrims", label: t("dashboard.scrims"), icon: Swords },
    { tab: "Meta", label: t("dashboard.meta"), icon: Gamepad2 },
    { tab: "Staff", label: t("dashboard.staff"), icon: UserCog },
    { tab: "Scouting", label: t("dashboard.scouting"), icon: Eye },
    { tab: "Youth", label: t("dashboard.youthAcademy"), icon: GraduationCap },
    { tab: "Finances", label: t("dashboard.finances"), icon: DollarSign },
    { tab: "Transfers", label: t("dashboard.transfers"), icon: TrendingUp },
  ];

  const world: Item[] = [
    { tab: "Competitions", label: t("dashboard.competitions", { defaultValue: "Competiciones" }), icon: Globe },
    { tab: "Players", label: t("dashboard.players"), icon: UsersRound, badge: playerCount },
    { tab: "Teams", label: t("dashboard.teams"), icon: Building2, badge: teamCount },
    { tab: "WorldStaff", label: t("dashboard.worldStaff", { defaultValue: "Staffs" }), icon: UserCog, badge: staffCount },
    { tab: "ChampionsWorld", label: t("dashboard.champions_world"), icon: Gamepad2 },
    { tab: "Market", label: t("dashboard.market"), icon: Store },
  ];

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 p-4">
        {teamLogo ? (
          <img src={teamLogo} alt={teamName ?? ""} className="size-9 rounded-md object-contain" />
        ) : (
          <div className="size-9 rounded-md bg-muted" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs uppercase tracking-widest text-muted-foreground">
            Open League
          </div>
          <div className="truncate font-heading text-base font-bold text-primary">Manager</div>
        </div>
      </div>

      <Separator />

      <button
        onClick={() => onNavClick("Manager")}
        className={cn(
          "flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sidebar-accent",
          activeTab === "Manager" && "bg-sidebar-accent",
        )}
      >
        {managerAvatar ? (
          <img src={managerAvatar} alt={managerName ?? ""} className="size-9 rounded-full object-cover ring-2 ring-primary/60" />
        ) : (
          <div className="size-9 rounded-full bg-muted ring-2 ring-primary/60" />
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{managerName ?? "—"}</div>
          {managerFullName && <div className="truncate text-xs text-muted-foreground">{managerFullName}</div>}
        </div>
      </button>

      <Separator />

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3 text-sm scrollbar-v2">
        <Group items={top} activeTab={activeTab} onNavClick={onNavClick} />

        {!isUnemployed && (
          <>
            <SectionLabel>{t("dashboard.sectionClub")}</SectionLabel>
            <Group items={club} activeTab={activeTab} onNavClick={onNavClick} />
          </>
        )}

        <SectionLabel>{t("dashboard.sectionWorld")}</SectionLabel>
        <Group items={world} activeTab={activeTab} onNavClick={onNavClick} />
      </nav>

      <Separator />

      <div className="shrink-0 p-2 text-sm">
        <FooterButton icon={Settings} label={t("dashboard.settings")} onClick={onNavigateSettings} />
        <FooterButton
          icon={LogOut}
          label={t("dashboard.exitToMenu")}
          onClick={onExitClick}
          danger
        />
      </div>
    </aside>
  );
}

function Group({
  items,
  activeTab,
  onNavClick,
}: {
  items: Item[];
  activeTab: string;
  onNavClick: (tab: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      {items.map((it) => {
        const Icon = it.icon;
        const active = activeTab === it.tab;
        return (
          <button
            key={it.tab}
            onClick={() => onNavClick(it.tab)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors",
              active
                ? "bg-sidebar-accent text-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1 truncate font-heading text-xs font-semibold uppercase tracking-wider">
              {it.label}
            </span>
            {it.badge !== undefined && it.badge > 0 && (
              <Badge className="h-5 px-1.5 text-[10px]">{it.badge}</Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-4 pb-1 font-heading text-[10px] uppercase tracking-widest text-muted-foreground/70">
      {children}
    </div>
  );
}

function FooterButton({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors",
        danger
          ? "text-destructive hover:bg-destructive/10"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      <span className="font-heading text-xs font-semibold uppercase tracking-wider">{label}</span>
    </button>
  );
}
