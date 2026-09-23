import type { ContractReport, SealRecord } from "@/types/report";

export function serializeReport(report: ContractReport): string {
  return JSON.stringify(report);
}

export async function sha256Hex(value: string): Promise<`0x${string}`> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `0x${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function hashReview(contractText: string, report: ContractReport) {
  return {
    contractHash: await sha256Hex(contractText),
    reportHash: await sha256Hex(serializeReport(report)),
  };
}

export async function verifySeal(contractText: string, report: ContractReport, seal: SealRecord): Promise<boolean> {
  const hashes = await hashReview(contractText, report);
  if (hashes.contractHash.toLowerCase() !== seal.contractHash.toLowerCase()) return false;
  if (hashes.reportHash.toLowerCase() !== seal.reportHash.toLowerCase()) return false;
  const response = await fetch(`/api/seal/verify?contractHash=${hashes.contractHash}&reportHash=${hashes.reportHash}`);
  if (!response.ok) return false;
  const data = (await response.json()) as { matches?: boolean };
  return data.matches === true;
}
