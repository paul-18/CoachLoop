import { loadTrainingState, loadAllSnapshots, type TrainingSnapshot } from "./training-storage";

export interface RecoveryData {
  format: "coach-loop-recovery";
  version: 1;
  rawState: unknown;
  recoveryCopies: TrainingSnapshot[];
  errors: string[];
}

/** Reads are independent: damage to the main log must not hide good checkpoints. */
export async function readRecoveryData(readRaw: () => Promise<unknown> = loadTrainingState, readCopies: () => Promise<TrainingSnapshot[]> = loadAllSnapshots): Promise<RecoveryData> {
  const [raw, copies] = await Promise.allSettled([Promise.resolve().then(readRaw), Promise.resolve().then(readCopies)]);
  return {
    format: "coach-loop-recovery", version: 1,
    rawState: raw.status === "fulfilled" ? raw.value : null,
    recoveryCopies: copies.status === "fulfilled" ? copies.value : [],
    errors: [raw.status === "rejected" ? "Saved log could not be read" : "", copies.status === "rejected" ? "Recovery copies could not be read" : ""].filter(Boolean),
  };
}
