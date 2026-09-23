import type { Metadata } from "next";
import { AnalyzeWorkbench } from "./AnalyzeWorkbench";

export const metadata: Metadata = { title: "Analyze a contract" };

export default function AnalyzePage() {
  return <AnalyzeWorkbench />;
}
