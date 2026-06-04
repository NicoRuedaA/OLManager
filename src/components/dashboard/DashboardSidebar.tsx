import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import type { JSX, ReactNode } from "react";
import {
  Users,
  Calendar as CalendarIcon,
  Mail,
  Settings,
  Briefcase,
  Trophy,
  TrendingUp,
  Crosshair,
  Dumbbell,
  DollarSign,
  Eye,
  UsersRound,
  Building2,
  UserCog,
  Newspaper,
  MessageCircle,
  LogOut,
  GraduationCap,
  PanelLeftClose,
  User,
  Gamepad2,
  Globe,
  Swords,
  Store
} from "lucide-react";

interface DashboardSidebarProps {
  activeTab: string;
  collapsed: boolean;
  onNavClick: (tab: string) => void;
  onToggleCollapse: () => void;
  unreadMessagesCount: number;
  managerName: string | null;
  teamName: string | null;
  teamLogo: string | null;
  managerAvatar: string | null;
  onNavigateSettings: () => void;
  onExitClick: () => void;
  isUnemployed: boolean;
}

interface NavItemProps {
  active?: boolean;
  badge?: number;
  collapsed: boolean;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}

function NavItem({
  active,
  badge,
  collapsed,
  icon,
  label,
  onClick,
}: NavItemProps): JSX.Element {
  const buttonClassName = `relative flex w-full items-center justify-start rounded-lg p-3 gap-3 ${
    active
      ? "bg-linear-to-r from-primary-500 to-primary-600 text-white shadow-md shadow-primary-500/20"
      : "text-gray-400 hover:bg-white/5 hover:text-white"
  }`;

  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={buttonClassName}
    >
      <div className="[&>svg]:w-5 [&>svg]:h-5 shrink-0">{icon}</div>
      <span
        className={`min-w-0 min-h-0 overflow-hidden whitespace-nowrap ${
          collapsed
            ? "max-w-0 max-h-0 opacity-0"
            : "max-w-40 max-h-6 opacity-100"
        } font-heading font-semibold text-sm uppercase tracking-wider`}
      >
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span
          className={
            collapsed
              ? "absolute right-1.5 top-1.5 min-w-[1.1rem] rounded-full bg-primary-500 px-1.5 py-0.5 text-center text-2xs font-bold text-white"
              : "min-w-5 rounded-full bg-primary-500 px-2 py-0.5 text-center text-xs font-bold text-white"
          }
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export default function DashboardSidebar({
  activeTab,
  collapsed,
  onNavClick,
  onToggleCollapse,
  unreadMessagesCount,
  managerName,
  teamName,
  teamLogo,
  managerAvatar,
  onNavigateSettings,
  onExitClick,
  isUnemployed,
}: DashboardSidebarProps): JSX.Element {
  const { t } = useTranslation();
  invoke("debug_log", { message: `[sidebar] teamName=${teamName} | teamLogo=${teamLogo} | collapsed=${collapsed}` });

  const clubItems: Array<{ icon: JSX.Element; label: string; tab: string }> = [
    { icon: <Users />, label: t("dashboard.squad"), tab: "Squad" },
    { icon: <Crosshair />, label: t("dashboard.tactics"), tab: "Tactics" },
    { icon: <Dumbbell />, label: t("dashboard.training"), tab: "Training" },
    { icon: <Swords />, label: t("dashboard.scrims"), tab: "Scrims" },
    { icon: <Gamepad2 />, label: t("dashboard.meta"), tab: "Meta" },
    { icon: <UserCog />, label: t("dashboard.staff"), tab: "Staff" },
    { icon: <Eye />, label: t("dashboard.scouting"), tab: "Scouting" },
    {
      icon: <GraduationCap />,
      label: t("dashboard.youthAcademy"),
      tab: "Youth",
    },
    { icon: <DollarSign />, label: t("dashboard.finances"), tab: "Finances" },
    { icon: <TrendingUp />, label: t("dashboard.transfers"), tab: "Transfers" },
  ];
  const worldItems: Array<{ icon: JSX.Element; label: string; tab: string }> = [
    { icon: <UsersRound />, label: t("dashboard.players"), tab: "Players" },
    { icon: <Building2 />, label: t("dashboard.teams"), tab: "Teams" },
    {
      icon: <Trophy />,
      label: t("dashboard.tournaments"),
      tab: "Tournaments",
    },
    {
      icon: <Globe />,
      label: t("dashboard.competitions", "Competiciones"),
      tab: "Competitions",
    },
    { icon: <Gamepad2 />, label: t("dashboard.champions_world"), tab: "ChampionsWorld" },
    { icon: <Store />, label: t("dashboard.market"), tab: "Market" },
  ];
  const toggleSidebarLabel = collapsed
    ? t("dashboard.expandSidebar")
    : t("dashboard.collapseSidebar");

  return (
    <aside
      className={`bg-navy-800 dark:bg-navy-800 bg-panel-dark border-r border-navy-700 text-white flex h-screen sticky top-0 shrink-0 flex-col transition-[width] duration-200 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Brand */}
      <div className="border-b border-navy-700 p-5">
        {/* Always a row — no layout change between states */}
        <div className="flex items-start h-8 overflow-visible">
          <div
            className={`w-8 h-8 flex items-center justify-center shrink-0 ${collapsed ? "cursor-pointer" : ""}`}
            onClick={collapsed ? onToggleCollapse : undefined}
            role={collapsed ? "button" : undefined}
            tabIndex={collapsed ? 0 : undefined}
            onKeyDown={collapsed ? (e) => { if (e.key === "Enter" || e.key === " ") onToggleCollapse(); } : undefined}
            title={collapsed ? t("dashboard.expandSidebar") : undefined}
          >
            {teamLogo ? (
              <img
                src={teamLogo}
                alt={teamName ?? "Logo"}
                className="w-8 h-8 object-contain"
              />
            ) : (
              <img
                src="../../lec-logo.svg"
                alt="Logo"
                className="w-8 h-8"
              />
            )}
          </div>
          <div
            className={`min-w-0 min-h-0 overflow-hidden transition-all duration-200 ${
              collapsed
                ? "max-w-0 max-h-0 opacity-0 ml-0"
                : "max-w-40 max-h-12 opacity-100 ml-3 delay-150"
            }`}
          >
            <h1 className="text-sm font-heading font-semibold text-white uppercase tracking-wider whitespace-nowrap">
              Open League
            </h1>
            <h1 className="font-bold font-heading text-accent-400 uppercase tracking-wider whitespace-nowrap">
              Manager
            </h1>
          </div>
          <div className={`flex-1 min-w-0 min-h-0 transition-all duration-200 ${
            collapsed ? "opacity-0" : "opacity-100 delay-150"
          }`} />
          <div
            className={`min-w-0 min-h-0 overflow-hidden shrink-0 transition-all duration-200 ${
              collapsed
                ? "max-w-0 max-h-0 opacity-0"
                : "max-w-10 max-h-10 opacity-100 delay-150"
            }`}
          >
            <button
              type="button"
              onClick={onToggleCollapse}
              title={toggleSidebarLabel}
              aria-label={toggleSidebarLabel}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white cursor-pointer"
            >
              <PanelLeftClose className="h-5 w-5" />
            </button>
          </div>
        </div>
        <button
          onClick={() => onNavClick("Manager")}
          title={collapsed ? t("dashboard.manager") : undefined}
          aria-label={t("dashboard.manager")}
          className={`hover:bg-white/5 mt-3 w-full rounded-lg transition-colors hover:cursor-pointer h-[4.5rem] flex items-center gap-3 justify-start -mx-1 border-t border-navy-700 px-1 py-1 pt-3 ${
            collapsed ? "text-gray-300" : "text-left"
          }`}
        >
          {managerAvatar ? (
            <img
              src={managerAvatar}
              alt=""
              className="w-5 h-5 rounded-full object-cover shrink-0"
            />
          ) : (
            <User className="h-5 w-5 shrink-0" />
          )}
          <div
            className={`min-w-0 min-h-0 overflow-hidden transition-all duration-200 ${
              collapsed
                ? "max-w-0 max-h-0 opacity-0"
                : "max-w-60 max-h-24 opacity-100 delay-150"
            }`}
          >
            <p className="text-xs text-gray-400 uppercase tracking-wider">
              {t("dashboard.manager")}
            </p>
            <p className="text-sm font-semibold text-white mt-0.5">
              {managerName}
            </p>
          </div>
        </button>
      </div>

      {/* Navigation */}
      <nav
        className={`scrollbar-thin scrollbar-thumb-navy-600 scrollbar-track-transparent flex flex-1 flex-col gap-1 overflow-y-auto py-4 ${
          collapsed ? "px-2" : "px-3"
        }`}
      >
        <NavItem
          icon={<Briefcase />}
          label={t("dashboard.home")}
          badge={undefined}
          active={activeTab === "Home"}
          collapsed={collapsed}
          onClick={() => onNavClick("Home")}
        />
        <NavItem
          icon={<Mail />}
          label={t("dashboard.inbox")}
          badge={unreadMessagesCount > 0 ? unreadMessagesCount : undefined}
          active={activeTab === "Inbox"}
          collapsed={collapsed}
          onClick={() => onNavClick("Inbox")}
        />
        <NavItem
          icon={<Newspaper />}
          label={t("dashboard.news")}
          active={activeTab === "News"}
          collapsed={collapsed}
          onClick={() => onNavClick("News")}
        />
        <NavItem
          icon={<MessageCircle />}
          label={t("dashboard.social", { defaultValue: "Social" })}
          active={activeTab === "Social"}
          collapsed={collapsed}
          onClick={() => onNavClick("Social")}
        />
        <NavItem
          icon={<CalendarIcon />}
          label={t("dashboard.schedule")}
          active={activeTab === "Schedule"}
          collapsed={collapsed}
          onClick={() => onNavClick("Schedule")}
        />

        {!isUnemployed && (
          <>
            {collapsed ? null : (
              <p className="text-2xs text-gray-500 uppercase tracking-widest font-heading px-3 pt-3 pb-1">
                {t("dashboard.sectionClub")}
              </p>
            )}
            {clubItems.map((item) => (
              <NavItem
                key={item.tab}
                icon={item.icon}
                label={item.label}
                active={activeTab === item.tab}
                collapsed={collapsed}
                onClick={() => onNavClick(item.tab)}
              />
            ))}
          </>
        )}

        {collapsed ? null : (
          <p className="text-2xs text-gray-500 uppercase tracking-widest font-heading px-3 pt-3 pb-1">
            {t("dashboard.sectionWorld")}
          </p>
        )}
        {worldItems.map((item) => (
          <NavItem
            key={item.tab}
            icon={item.icon}
            label={item.label}
            active={activeTab === item.tab}
            collapsed={collapsed}
            onClick={() => onNavClick(item.tab)}
          />
        ))}
      </nav>

      {/* Settings & Exit */}
      <div
        className={`border-t border-navy-700 flex flex-col gap-1 ${
          collapsed ? "p-2" : "p-3"
        }`}
      >
        <button
          onClick={onNavigateSettings}
          title={collapsed ? t("dashboard.settings") : undefined}
          aria-label={t("dashboard.settings")}
          className={`w-full rounded-lg p-3 text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-300 ${
            collapsed
              ? "flex items-center justify-center"
              : "flex items-center gap-3"
          }`}
        >
          <Settings className="w-5 h-5" />
          {collapsed ? null : (
            <span className="font-heading text-sm uppercase tracking-wider">
              {t("dashboard.settings")}
            </span>
          )}
        </button>
        <button
          onClick={onExitClick}
          title={collapsed ? t("dashboard.exitToMenu") : undefined}
          aria-label={t("dashboard.exitToMenu")}
          className={`w-full rounded-lg p-3 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400 ${
            collapsed
              ? "flex items-center justify-center"
              : "flex items-center gap-3"
          }`}
        >
          <LogOut className="w-5 h-5" />
          {collapsed ? null : (
            <span className="font-heading text-sm uppercase tracking-wider">
              {t("dashboard.exitToMenu")}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
