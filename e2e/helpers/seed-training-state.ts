import type { Page } from "@playwright/test";

const epoch = "1970-01-01T00:00:00.000Z";

export function makeSeedWorkout(name: string, index: number, exerciseName = "Barbell Bench Press") {
  const completedAt = new Date(Date.UTC(2026, 10, 25, 12, 0, 0) - index * 60_000).toISOString();
  const exerciseId = `seed-exercise-${index}`;
  return {
    id: `seed-workout-${index}`,
    name,
    date: "2026-11-25",
    timezone: "UTC",
    createdAt: completedAt,
    startedAt: completedAt,
    completedAt,
    skippedAt: null,
    skipReason: "",
    status: "completed",
    exercises: [{
      id: exerciseId,
      name: exerciseName,
      restSec: 120,
      notes: "",
      coachNotes: "",
      sets: [{
        id: `seed-set-${index}`,
        plannedReps: "8",
        plannedWeight: null,
        plannedRpe: "",
        plannedRir: "",
        actualReps: "5",
        actualWeight: 100,
        loadType: "weighted",
        weightMode: "total",
        unit: "lb",
        rpe: "",
        rir: "",
        completed: true,
        completedAsPlanned: false,
        warmup: false,
        notes: "",
        updatedAt: completedAt,
      }],
      updatedAt: completedAt,
    }],
    cardio: [],
    blockOrder: [{ type: "exercise", id: exerciseId }],
    notes: "",
    sessionRpe: "",
    source: "manual",
    updatedAt: completedAt,
  };
}

export function makeSeedState(workouts: ReturnType<typeof makeSeedWorkout>[]) {
  return {
    version: 1,
    evidenceVersion: 2,
    pendingConflicts: [],
    resolvedConflictIds: [],
    workouts,
    bodyweightEntries: [],
    benchmarks: [],
    deletedWorkoutIds: [],
    activeWorkoutId: null,
    goals: [],
    goalsUpdatedAt: epoch,
    coachProfile: "",
    coachProfileUpdatedAt: epoch,
    exerciseAliases: {
      bench: "Barbell Bench Press",
      "bench press": "Barbell Bench Press",
      "bb bench": "Barbell Bench Press",
      deads: "Barbell Deadlift",
      deadlift: "Barbell Deadlift",
      pullups: "Pull-Up",
      "pull ups": "Pull-Up",
    },
    exerciseMuscleOverrides: {},
    scheduleContext: { events: [], phases: [] },
    settings: {
      bodyDiagram: "male",
      defaultUnit: "lb",
      defaultRestSec: 120,
      barWeightLb: 45,
      barWeightKg: 20,
      lastBackupAt: null,
      installedHintDismissed: false,
      coachCheckIn: { date: "", energy: "", sleep: "", soreness: "", restrictions: "", schedule: "" },
      lastCoachBriefAt: null,
    },
    settingsUpdatedAt: epoch,
  };
}

export async function seedTrainingState(page: Page, state: unknown) {
  await page.evaluate((payload) => new Promise<void>((resolve, reject) => {
    const path = location.pathname.replace(/index\.html$/, "").replace(/\/$/, "");
    const suffix = !path || path === "/CoachLoop" ? "" : ":" + path;
    const request = indexedDB.open("coach-loop" + suffix, 4);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("app")) db.createObjectStore("app");
      if (!db.objectStoreNames.contains("snapshots")) db.createObjectStore("snapshots", { keyPath: "id" });
      if (!db.objectStoreNames.contains("snapshot-meta")) db.createObjectStore("snapshot-meta", { keyPath: "id" });
      if (!db.objectStoreNames.contains("sync")) db.createObjectStore("sync");
      if (!db.objectStoreNames.contains("device")) db.createObjectStore("device");
    };
    request.onerror = () => reject(request.error ?? new Error("Could not open Coach Loop fixture database"));
    request.onblocked = () => reject(new Error("Coach Loop fixture database open was blocked"));
    request.onsuccess = () => {
      const db = request.result;
      const pollForInitialSave = () => {
        const readTransaction = db.transaction("app", "readonly");
        const get = readTransaction.objectStore("app").get("training-state");
        let initialized = false;
        get.onsuccess = () => { initialized = get.result !== undefined; };
        readTransaction.onerror = () => { db.close(); reject(readTransaction.error ?? new Error("Could not inspect Coach Loop fixture state")); };
        readTransaction.oncomplete = () => {
          if (!initialized) { setTimeout(pollForInitialSave, 50); return; }
          const writeTransaction = db.transaction("app", "readwrite");
          writeTransaction.objectStore("app").put(payload, "training-state");
          writeTransaction.oncomplete = () => { db.close(); resolve(); };
          writeTransaction.onerror = () => { db.close(); reject(writeTransaction.error ?? new Error("Could not seed Coach Loop fixture state")); };
          writeTransaction.onabort = () => { db.close(); reject(writeTransaction.error ?? new Error("Coach Loop fixture transaction aborted")); };
        };
      };
      pollForInitialSave();
    };
  }), state);
}
