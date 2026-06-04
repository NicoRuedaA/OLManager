import {
    Activity,
    Briefcase,
    Calendar,
    DollarSign,
    Heart,
    TrendingUp,
} from "lucide-react";
import {
    formatDate,
    getContractRiskBadgeVariant,
    getContractYearsRemaining,
} from "../../lib/helpers";
import { formatPlayerMarketValue, formatPlayerWage } from "./PlayerProfile.helpers";
import { Badge, Button, Card, CardBody, CardHeader } from "../ui";

type TranslateFn = (
    key: string,
    options?: Record<string, string | number>,
) => string;

interface PlayerProfileContractCardProps {
    dateOfBirth: string;
    contractEnd: string | null;
    currentDate: string;
    condition: number;
    fitness: number;
    morale: number;
    marketValue: number;
    wage: number;
    annualSuffix: string;
    language: string;
    contractRiskLevel: "critical" | "warning" | "stable";
    contractRiskLabel: string;
    isOwnClub: boolean;
    isTransferWindowOpen: boolean;
    transferActionSubmitting: boolean;
    onOpenRenewal: () => void;
    onReleaseContract: () => void;
    onOpenTransferBid: () => void;
    t: TranslateFn;
}

export default function PlayerProfileContractCard({
    dateOfBirth,
    contractEnd,
    currentDate,
    condition,
    fitness,
    morale,
    marketValue,
    wage,
    annualSuffix,
    language,
    contractRiskLevel,
    contractRiskLabel,
    isOwnClub,
    isTransferWindowOpen,
    transferActionSubmitting,
    onOpenRenewal,
    onReleaseContract,
    onOpenTransferBid,
    t,
}: PlayerProfileContractCardProps) {
    return (
        <Card>
            <CardHeader>{t("playerProfile.contractInfo")}</CardHeader>
            <CardBody>
                <div className="flex flex-col gap-3">
                    <InfoRow
                        icon={<Calendar className="w-4 h-4" />}
                        label={t("playerProfile.dateOfBirth")}
                        value={formatDate(dateOfBirth, language)}
                    />
                    <InfoRow
                        icon={<Briefcase className="w-4 h-4" />}
                        label={t("common.contract")}
                        value={
                            contractEnd
                                ? t("finances.contractExpiresOn", { date: contractEnd })
                                : t("playerProfile.noContract")
                        }
                    />
                    <InfoRow
                        icon={<Calendar className="w-4 h-4" />}
                        label={t("playerProfile.yearsRemaining")}
                        value={getContractYearsRemaining(contractEnd, currentDate)}
                    />
                    <InfoRow
                        icon={<Briefcase className="w-4 h-4" />}
                        label={t("playerProfile.contractRisk")}
                        value={
                            <Badge variant={getContractRiskBadgeVariant(contractRiskLevel)}>
                                {contractRiskLabel}
                            </Badge>
                        }
                    />
                    <InfoRow
                        icon={<DollarSign className="w-4 h-4" />}
                        label={t("finances.marketValue")}
                        value={formatPlayerMarketValue(marketValue)}
                    />
                    <InfoRow
                        icon={<TrendingUp className="w-4 h-4" />}
                        label={t("playerProfile.annualWage")}
                        value={formatPlayerWage(wage, annualSuffix)}
                    />
                    <InfoRow
                        icon={<Heart className="w-4 h-4" />}
                        label={t("common.condition")}
                        value={
                            <div className="flex items-center gap-1.5">
                                <div className="w-12 h-1.5 rounded-full bg-gray-200 dark:bg-navy-600 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${condition >= 70 ? "bg-success-400" : condition >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                                        style={{ width: `${condition}%` }}
                                    />
                                </div>
                                <span>{condition}%</span>
                            </div>
                        }
                    />
                    <InfoRow
                        icon={<Activity className="w-4 h-4" />}
                        label={t("common.fitness")}
                        value={
                            <div className="flex items-center gap-1.5">
                                <div className="w-12 h-1.5 rounded-full bg-gray-200 dark:bg-navy-600 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${fitness >= 70 ? "bg-success-400" : fitness >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                                        style={{ width: `${fitness}%` }}
                                    />
                                </div>
                                <span>{fitness}%</span>
                            </div>
                        }
                    />
                    <InfoRow
                        icon={<Activity className="w-4 h-4" />}
                        label={t("common.morale")}
                        value={
                            <div className="flex items-center gap-1.5">
                                <div className="w-12 h-1.5 rounded-full bg-gray-200 dark:bg-navy-600 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${morale >= 70 ? "bg-success-400" : morale >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                                        style={{ width: `${morale}%` }}
                                    />
                                </div>
                                <span>{morale}%</span>
                            </div>
                        }
                    />
                </div>
                {isOwnClub ? (
                    <div className="pt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={onOpenRenewal}>
                            {t("common.renewContract")}
                        </Button>
                        {isTransferWindowOpen ? (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={onReleaseContract}
                                disabled={transferActionSubmitting}
                            >
                                {t("playerProfile.releaseContract")}
                            </Button>
                        ) : null}
                    </div>
                ) : isTransferWindowOpen ? (
                    <div className="pt-3">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onOpenTransferBid}
                            disabled={transferActionSubmitting}
                        >
                            {t("playerProfile.makeTransferOffer")}
                        </Button>
                    </div>
                ) : null}
            </CardBody>
        </Card>
    );
}

function InfoRow({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-navy-600 last:border-0">
            <div className="text-gray-400 dark:text-gray-500">{icon}</div>
            <span className="text-sm text-gray-500 dark:text-gray-400 flex-1">
                {label}
            </span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {value}
            </span>
        </div>
    );
}
