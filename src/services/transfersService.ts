import { invoke } from "@tauri-apps/api/core";

import type { GameStateData } from "../store/gameStore";

export type TransferDestinationData = "main" | "academy";

export interface TransferNegotiationFeedbackData {
  mood: "calm" | "firm" | "tense" | "positive" | "guarded";
  headline_key: string;
  detail_key?: string | null;
  tension: number;
  patience: number;
  round: number;
  params?: Record<string, string>;
}

export interface TransferNegotiationResponseData {
  decision: "accepted" | "rejected" | "counter_offer";
  suggested_fee: number | null;
  is_terminal: boolean;
  feedback: TransferNegotiationFeedbackData;
  game: GameStateData;
}

export interface WageNegotiationResponseData {
  decision: "accepted" | "rejected" | "counter_offer";
  suggested_wage: number | null;
  suggested_years: number | null;
  is_terminal: boolean;
  feedback: TransferNegotiationFeedbackData;
  game: GameStateData;
}

export interface TransferBidProjectionData {
  projection: {
    transfer_budget_before: number;
    transfer_budget_after: number;
    finance_before: number;
    finance_after: number;
    annual_wage_bill_before: number;
    annual_wage_bill_after: number;
    annual_wage_budget: number;
    projected_wage_budget_usage_pct: number;
    exceeds_transfer_budget: boolean;
    exceeds_finance: boolean;
  };
}

export async function makeTransferBid(
  playerId: string,
  fee: number,
  destination: TransferDestinationData = "main",
  includedPlayerIds: string[] = [],
): Promise<TransferNegotiationResponseData> {
  return invoke<TransferNegotiationResponseData>("make_transfer_bid", {
    playerId,
    fee,
    destination,
    includedPlayerIds,
  });
}

export async function respondToOffer(
  playerId: string,
  offerId: string,
  accept: boolean,
): Promise<GameStateData> {
  return invoke<GameStateData>("respond_to_offer", {
    playerId,
    offerId,
    accept,
  });
}

export async function counterOffer(
  playerId: string,
  offerId: string,
  requestedFee: number,
  includedPlayerIds: string[] = [],
): Promise<TransferNegotiationResponseData> {
  return invoke<TransferNegotiationResponseData>("counter_offer", {
    playerId,
    offerId,
    requestedFee,
    includedPlayerIds,
  });
}

export async function previewTransferBidFinancialImpact(
  playerId: string,
  fee: number,
  destination: TransferDestinationData = "main",
): Promise<TransferBidProjectionData> {
  return invoke<TransferBidProjectionData>(
    "preview_transfer_bid_financial_impact",
    {
      playerId,
      fee,
      destination,
    },
  );
}

export async function releasePlayerContract(
  playerId: string,
): Promise<GameStateData> {
  return invoke<GameStateData>("release_player_contract", {
    playerId,
  });
}

export async function negotiatePlayerWage(
  playerId: string,
  offerId: string,
  annualWage: number,
  contractYears: number,
): Promise<WageNegotiationResponseData> {
  return invoke<WageNegotiationResponseData>("negotiate_player_wage", {
    playerId,
    offerId,
    annualWage,
    contractYears,
  });
}

export interface TransferHistoryEntryData {
  id: string;
  player_id: string;
  player_name: string;
  player_ovr: number;
  player_position: string;
  from_team_id: string;
  from_team_name: string;
  to_team_id: string;
  to_team_name: string;
  fee: number;
  annual_wage: number;
  contract_years: number;
  date: string;
  is_user_involved: boolean;
  is_user_buying: boolean;
  was_negotiated: boolean;
  initial_offer_fee: number | null;
  negotiation_rounds: number;
}

export async function getTransferHistory(): Promise<TransferHistoryEntryData[]> {
  return invoke<TransferHistoryEntryData[]>("get_transfer_history_cmd");
}
