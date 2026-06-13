import { Briefcase, Calendar } from "lucide-react";
import { formatDate, getContractRiskBadgeVariant, getContractYearsRemaining } from "@/lib/common/helpers";
import { Badge, Button, Card, CardBody, CardHeader } from "@/ui-v2/_legacy/components/ui";

type TranslateFn = (
    key: string,
    options?: Record<string, string | number>,
) => string;

interface PlayerProfileContractCardProps {
    dateOfBirth: string;
    contractEnd: string | null;
    currentDate: string;
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
        <Card className="flex flex-col h-full">
            <CardHeader>{t("playerProfile.contractInfo")}</CardHeader>
            <CardBody className="min-h-0 flex-1">
                <div className="flex flex-col gap-3">
                    <InfoRow
                        icon={<Calendar className="w-3.5 h-3.5" />}
                        label={t("playerProfile.dateOfBirth")}
                        value={formatDate(dateOfBirth, language)}
                    />
                    <InfoRow
                        icon={<Briefcase className="w-3.5 h-3.5" />}
                        label={t("common.contract")}
                        value={
                            contractEnd
                                ? t("finances.contractExpiresOn", { date: contractEnd })
                                : t("playerProfile.noContract")
                        }
                    />
                    <InfoRow
                        icon={<Calendar className="w-3.5 h-3.5" />}
                        label={t("playerProfile.yearsRemaining")}
                        value={getContractYearsRemaining(contractEnd, currentDate)}
                    />
                    <InfoRow
                        icon={<Briefcase className="w-3.5 h-3.5" />}
                        label={t("playerProfile.contractRisk")}
                        value={
                            <Badge variant={getContractRiskBadgeVariant(contractRiskLevel)} className="text-[10px]">
                                {contractRiskLabel}
                            </Badge>
                        }
                    />
                </div>
                {isOwnClub ? (
                    <div className="pt-3 flex flex-wrap gap-2 justify-center">
<Button size="sm" variant="outline" onClick={onOpenRenewal} className="text-[10px]">
                                {t("common.renewContract")}
                            </Button>
                            {isTransferWindowOpen ? (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={onReleaseContract}
                                    disabled={transferActionSubmitting}
                                    className="text-[10px]"
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
                            className="text-[10px]"
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
        <div className="flex items-center gap-3 py-2 border-b border-border/60 last:border-0">
            <div className="text-muted-foreground/70">{icon}</div>
            <span className="text-xs text-muted-foreground flex-1">
                {label}
            </span>
            <span className="text-xs font-semibold text-foreground">
                {value}
            </span>
        </div>
    );
}




