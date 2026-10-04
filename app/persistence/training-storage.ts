import { uid, type TrainingState } from "../domain/training-types";

import { assertValidatedState, validateSyncedState, type ValidatedState } from "./training-validation";
import { localScopeSuffix } from "./local-scope";
const DB_NAME = `coach-loop${localScopeSuffix()}`;
const DB_VERSION = 3;
const STATE_STORE = "app";
const SNAPSHOT_STORE = "snapshots";
const SYNC_STORE = "sync";
const DEVICE_STORE = "device";
const STATE_KEY = "training-state";

export interface SyncMeta {
  revision: number;
  lastSyncedHash: string | null;
  lastSyncedAt: string | null;
  baseline?: TrainingState | null;
  generation?: string | null;
}

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STATE_STORE)) {
        database.createObjectStore(STATE_STORE);
      }
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
        database.createObjectStore(SNAPSHOT_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(SYNC_STORE)) {
        database.createObjectStore(SYNC_STORE);
      }
      if (!database.objectStoreNames.contains(DEVICE_STORE)) {
        database.createObjectStore(DEVICE_STORE);
      }
    };
    let rejected = false;
    request.onblocked = () => { rejected = true; reject(new Error("Database upgrade blocked. Close other Coach Loop windows.")); };
    request.onerror = () => { rejected = true; reject(request.error ?? new Error("Database open failed")); };
    request.onsuccess = () => {
      const database = request.result;
      if (rejected) { database.close(); return; }
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });

const transact = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction | undefined;
    const fail = (error: unknown) => { database.close(); reject(error ?? new Error("Local transaction failed")); };
    try {
      transaction = database.transaction(storeName, mode);
      const request = action(transaction.objectStore(storeName));
      transaction.oncomplete = () => { database.close(); resolve(request.result); };
      transaction.onerror = () => fail(transaction?.error ?? request.error);
      transaction.onabort = () => fail(transaction?.error ?? new Error("Local transaction aborted"));
    } catch (error) {
      try { transaction?.abort(); } catch { /* Transaction may be inactive. */ }
      fail(error);
    }
  });
};

export const loadTrainingState = async (): Promise<TrainingState | null> => {
  return (await transact<TrainingState | undefined>(
      STATE_STORE,
      "readonly",
      (store) => store.get(STATE_KEY),
  )) ?? null;
};

let pendingSave: Promise<unknown> = Promise.resolve();
let queuedState: TrainingState | null = null;
let draining: Promise<void> | null = null;
export const saveTrainingState = (state: TrainingState): Promise<void> => {
  return enqueueState(structuredClone(validateSyncedState(state)));
};
/** Internal immutable candidates need neither a second parse nor a pre-queue
 * clone. IndexedDB still performs its own structured clone at store.put. */
export const saveValidatedState = (state: ValidatedState): Promise<void> => {
  assertValidatedState(state);
  return enqueueState(state);
};
const enqueueState = (snapshot: TrainingState): Promise<void> => {
  queuedState = snapshot;
  if (!draining) {
    draining = pendingSave.catch(() => undefined).then(async () => {
      while (queuedState) {
        const snapshot = queuedState;
        queuedState = null;
        await transact(STATE_STORE, "readwrite", store => store.put(snapshot, STATE_KEY));
      }
    }).finally(() => { draining = null; });
    pendingSave = draining;
  }
  return draining;
};

export const saveSnapshot = async (state: TrainingState, reason: string) => {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    try {
      const transaction = database.transaction(SNAPSHOT_STORE, "readwrite");
      const store = transaction.objectStore(SNAPSHOT_STORE);
      store.add({ id: uid("snapshot"), createdAt: new Date().toISOString(), reason, state: structuredClone(state) });
      const allRequest = store.getAll();
      allRequest.onsuccess = () => {
        const snapshots = (allRequest.result as TrainingSnapshot[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const checkpoints = snapshots.filter((item) => item.reason === "before-restore" || item.reason === "before-evidence-migration");
        const routine = snapshots.filter((item) => !checkpoints.includes(item));
        for (const item of [...checkpoints.slice(2), ...routine.slice(5)]) store.delete(item.id);
      };
      transaction.oncomplete = () => { database.close(); resolve(); };
      const fail = () => { database.close(); reject(transaction.error ?? new Error("Snapshot write failed")); };
      transaction.onerror = fail;
      transaction.onabort = fail;
    } catch (error) { database.close(); reject(error); }
  });
};

export interface TrainingSnapshot { id: string; createdAt: string; reason: string; state: TrainingState; }
export const listSnapshots = async (): Promise<TrainingSnapshot[]> =>
  (await transact<TrainingSnapshot[]>(SNAPSHOT_STORE, "readonly", (store) => store.getAll()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export const loadSnapshot = (id: string): Promise<TrainingSnapshot | undefined> =>
  transact<TrainingSnapshot | undefined>(SNAPSHOT_STORE, "readonly", (store) => store.get(id));

export const resetTrainingData = (nextState: TrainingState, meta?: SyncMeta): Promise<void> => {
  const snapshot = structuredClone(nextState);
  const reset = pendingSave.catch(() => undefined).then(async () => {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      let transaction: IDBTransaction | undefined;
      try {
        transaction = database.transaction([STATE_STORE, SNAPSHOT_STORE, SYNC_STORE, DEVICE_STORE], "readwrite");
        transaction.objectStore(STATE_STORE).clear();
        transaction.objectStore(STATE_STORE).put(snapshot, STATE_KEY);
        transaction.objectStore(SNAPSHOT_STORE).clear();
        transaction.objectStore(SYNC_STORE).clear();
        if (meta) transaction.objectStore(SYNC_STORE).put(structuredClone(meta), "cloud-sync");
        transaction.objectStore(DEVICE_STORE).delete("conflict-overrides");
        transaction.oncomplete = () => { database.close(); resolve(); };
        const fail = () => { database.close(); reject(transaction?.error ?? new Error("Local reset failed")); };
        transaction.onerror = fail;
        transaction.onabort = fail;
      } catch (error) {
        try { transaction?.abort(); } catch { /* Already inactive. */ }
        database.close(); reject(error);
      }
    });
  });
  pendingSave = reset;
  return reset;
};
