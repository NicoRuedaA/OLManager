import { countryName } from "@/lib/common/countries";
import {
  calcAge,
  formatVal,
} from "@/lib/common/helpers";
import { calculateLolOvr } from "@/lib/players/lolPlayerStats";
import type { PlayerData } from "@/store/gameStore";
import { Card, CardBody, CardHeader, CountryFlag, ProgressBar } from "@/ui-v2/_legacy/components/ui";
import { getLolRoleForPlayer, type LolRole } from "@/ui-v2/_legacy/components/squad/SquadTab.helpers";
import type { TeamProfileTranslate } from "@/ui-v2/_legacy/components/teamProfile/TeamProfile.types";
import { resolvePlayerPhoto } from "@/lib/players/playerPhotos";

interface TeamProfileRosterCardProps {
  roster: PlayerData[];
  currentDate: string;
  isOwnTeam: boolean;
  locale: string;
  t: TeamProfileTranslate;
  onSelectPlayer?: (id: string) => void;
}

export default function TeamProfileRosterCard({
  roster,
  currentDate,
  isOwnTeam,
  locale,
  t,
  onSelectPlayer,
}: TeamProfileRosterCardProps) {
  const LOL_ROLE_ICON_URLS: Record<LolRole, string> = {
    TOP: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-top.png",
    JUNGLE: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-jungle.png",
    MID: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-middle.png",
    ADC: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png",
    SUPPORT: "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-utility.png",
  };

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        {t("teams.squad")} ({roster.length})
      </CardHeader>
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border text-xs">
                <th className="py-3 px-5 w-14"></th>
                <th className="py-3 px-5 font-heading font-bold uppercase tracking-wider text-muted-foreground">
                  {t("common.position")}
                </th>
                <th className="py-3 px-5 font-heading font-bold uppercase tracking-wider text-muted-foreground">
                  {t("common.name")}
                </th>
                <th className="py-3 px-5 font-heading font-bold uppercase tracking-wider text-muted-foreground">
                  {t("common.age")}
                </th>
                <th className="py-3 px-5 font-heading font-bold uppercase tracking-wider text-muted-foreground">
                  {t("common.nationality")}
                </th>
                <th className="py-3 px-5 font-heading font-bold uppercase tracking-wider text-muted-foreground">
                  {t("common.value")}
                </th>
                {isOwnTeam && (
                  <th className="py-3 px-5 font-heading font-bold uppercase tracking-wider text-muted-foreground">
                    {t("common.condition")}
                  </th>
                )}
                <th className="py-3 px-5 font-heading font-bold uppercase tracking-wider text-muted-foreground">
                  {t("common.ovr")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {roster.map((player) => {
                const ovr = calculateLolOvr(player);
                const age = calcAge(player.date_of_birth, currentDate);
                const lolRole = getLolRoleForPlayer(player);
                const photoUrl = resolvePlayerPhoto(player.id, player.match_name, player.profile_image_url);

                return (
                  <tr
                    key={player.id}
                    onClick={() => onSelectPlayer?.(player.id)}
                    className="hover:bg-muted/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-5">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={player.match_name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-heading font-bold text-muted-foreground">
                          {player.match_name?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-5">
                      <img
                        src={LOL_ROLE_ICON_URLS[lolRole]}
                        alt={lolRole}
                        className="w-5 h-5 object-contain"
                        title={lolRole}
                      />
                    </td>
                    <td className="py-3 px-5">
                      <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                        {player.match_name || player.full_name}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-sm text-muted-foreground/80 tabular-nums">
                      {age}
                    </td>
                    <td className="py-3 px-5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <CountryFlag
                          code={player.nationality}
                          locale={locale}
                          className="text-lg leading-none"
                        />
                        <span>{countryName(player.nationality, locale)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-sm text-muted-foreground/80">
                      {formatVal(player.market_value)}
                    </td>
                    {isOwnTeam && (
                      <td className="py-3 px-5">
                        <ProgressBar
                          value={player.condition}
                          variant="auto"
                          size="sm"
                          showLabel
                          className="max-w-[100px]"
                        />
                      </td>
                    )}
                    <td className="py-3 px-5">
                      <span
                        className={`font-heading font-bold text-lg tabular-nums ${
                          ovr >= 55 ? "text-primary" : "text-gray-400"
                        }`}
                      >
                        {ovr}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}


