"use client";
import { createContext, useContext } from "react";
import type { RunView, WorkbenchState } from "@manifest/db";
import type { PlanSpec, RecordOutcome } from "@manifest/core";
import type { Plan, RunSummary, Stage } from "./lifecycle";

export type Workbench = {
  state: WorkbenchState;
  view: string;
  /** The plan version in focus: the selected one on /plans, the approved one on /target, else the latest. */
  plan: Plan | undefined;
  run: RunView | null;
  runError: string;
  actor: string;
  busy: string;
  runningSession: boolean;
  stages: Stage[];
  execution: RunSummary | undefined;
  reconciliation: WorkbenchState["reconciliations"][number] | undefined;
  dryForApproval: RunSummary | undefined;
  openQuestions: number;
  canApprove: boolean;
  landedKeys: Set<string>;
  answers: Record<string, string>;
  setAnswers: (
    fn: (a: Record<string, string>) => Record<string, string>,
  ) => void;
  fault: boolean;
  setFault: (on: boolean) => void;
  choosePlan: (id: string) => void;
  draft: () => void;
  startTest: () => void;
  dry: () => void;
  execute: () => void;
  retry: (planId: string) => void;
  reconcile: () => void;
  savePlan: (spec: PlanSpec, summary: string) => void;
  openApprove: () => void;
  openRollback: () => void;
  openEvidence: (outcome: RecordOutcome) => void;
  navigate: (href: string) => void;
  fail: (message: string) => void;
};

export const WorkbenchContext = createContext<Workbench | null>(null);

export function useWorkbench(): Workbench {
  const value = useContext(WorkbenchContext);
  if (!value) throw new Error("useWorkbench must be used inside the workbench");
  return value;
}
