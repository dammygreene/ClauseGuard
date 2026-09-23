import type { ContractReport, SealRecord } from "@/types/report";

export const HISTORY_STORAGE_KEY = "clauseguard.review-history";

export interface ReviewHistoryEntry {
  report: ContractReport;
  contractText: string;
  meta: {
    provider: string;
    model: string;
    droppedUnverifiable: number;
    droppedDuplicates: number;
    cached: boolean;
  };
  sealed?: SealRecord;
}

export function readReviewHistory(): ReviewHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function writeReviewHistory(entries: ReviewHistoryEntry[]) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, 20)));
}

export function saveReviewHistory(entry: ReviewHistoryEntry) {
  const entries = readReviewHistory().filter((item) => item.report.id !== entry.report.id);
  writeReviewHistory([entry, ...entries]);
}
