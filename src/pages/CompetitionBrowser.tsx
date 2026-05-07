import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Card, CardBody, CardHeader, Badge } from "../components/ui";
import { Trophy, Globe, ArrowLeft, Loader2 } from "lucide-react";

interface CompetitionSummary {
  id: string;
  name: string;
  slug: string;
  region: string;
  tier: string;
  season: number;
  status: string;
  phase_count: number;
  is_active: boolean;
}

export default function CompetitionBrowser() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [competitions, setCompetitions] = useState<CompetitionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<CompetitionSummary[]>("list_competitions")
      .then(setCompetitions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const tierBadge = (tier: string) => {
    switch (tier) {
      case "Regional":
        return "primary";
      case "International":
        return "accent";
      case "Academy":
        return "success";
      default:
        return "default" as const;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "InProgress":
        return "success";
      case "NotStarted":
        return "default";
      case "Finished":
        return "accent";
      default:
        return "default" as const;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-navy-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-navy-700 transition-colors text-gray-500 dark:text-gray-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-heading font-bold text-xl text-gray-800 dark:text-gray-100">
              {t("competitions.title", "Competiciones")}
            </h1>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {t("competitions.subtitle", "Todas las ligas y torneos activos")}
            </p>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
          </div>
        )}

        {/* Competition list */}
        {!loading && competitions.length === 0 && (
          <Card>
            <CardBody>
              <p className="text-center text-gray-400 dark:text-gray-500 py-8">
                {t("competitions.noCompetitions", "No hay competiciones activas")}
              </p>
            </CardBody>
          </Card>
        )}

        {!loading && competitions.length > 0 && (
          <div className="grid gap-4">
            {competitions.map((comp) => (
              <Card key={comp.id}>
                <CardBody>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                        {comp.tier === "International" ? (
                          <Globe className="w-5 h-5 text-accent-500" />
                        ) : (
                          <Trophy className="w-5 h-5 text-primary-500" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-heading font-bold text-sm text-gray-800 dark:text-gray-100">
                          {comp.name}
                        </h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {comp.region} • {t("competitions.season", "Temp.")} {comp.season}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={tierBadge(comp.tier)} size="sm">
                        {comp.tier}
                      </Badge>
                      <Badge variant={statusBadge(comp.status)} size="sm">
                        {comp.status === "InProgress"
                          ? t("competitions.inProgress", "En curso")
                          : comp.status === "NotStarted"
                            ? t("competitions.notStarted", "Sin empezar")
                            : comp.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                    <span>
                      {comp.phase_count}{" "}
                      {comp.phase_count === 1
                        ? t("competitions.phase", "fase")
                        : t("competitions.phases", "fases")}
                    </span>
                    {comp.is_active && (
                      <Badge variant="success" size="sm">
                        {t("competitions.active", "Tu liga")}
                      </Badge>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
