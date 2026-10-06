import { uid, type TrainingState } from "../domain/training-types";

import { assertValidatedState, validateSyncedState, type ValidatedState } from "./training-validation";
import { localScopeSuffix } from "./local-scope";
const DB_NAME = `coach-loop${localScopeSuffix()}`;
const DB_VERSION = 4;
const STATE_STORE = "app";
const SNAPSHOT_STORE = "snapshots";
const SNAPSHOT_META_STORE = "snapshot-meta";
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
      if (!database.objectStoreNames.contains(SNAPSHOT_META_STORE)) {
        const metadata = database.createObjectStore(SNAPSHOT_META_STORE, { keyPath: "id" });
        // Upgrade in the same transaction: retain every old payload and backfill
        // small metadata records one at a time, never load all logs into memory.
        const cursor = request.transaction!.objectStore(SNAPSHOT_STORE).openCursor();
        cursor.onsuccess = () => {
          const row = cursor.result;
          if (!row) return;
          const snapshot = row.value as TrainingSnapshot;
          metadata.put({ id: snapshot.id, createdAt: snapshot.createdAt, reason: snapshot.reason });
          row.continue();
        };
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
      try {
        while (queuedState) {
          const snapshot = queuedState;
          queuedState = null;
          await transact(STATE_STORE, "readwrite", store => store.put(snapshot, STATE_KEY));
        }
      } catch (error) {
        // All callers of this drain see failure. Never later write a Finish
        // candidate whose caller was already told it failed. The hook retries
        // its current editable state through a NEW save request.
        queuedState = null;
        throw error;
      } finally {
        // Release ownership in the same continuation as the final queue check;
        // a later enqueue must obtain a new promise, not an already-done drain.
        draining = null;
      }
    });
    pendingSave = draining;
  }
  return draining;
};

export const saveSnapshot = async (state: TrainingState, reason: string) => {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    let transaction: IDBTransaction | undefined;
    try {
      transaction = database.transaction([SNAPSHOT_STORE, SNAPSHOT_META_STORE], "readwrite");
      const store = transaction.objectStore(SNAPSHOT_STORE);
      const metadata = transaction.objectStore(SNAPSHOT_META_STORE);
      const info: SnapshotMetadata = { id: uid("snapshot"), createdAt: new Date().toISOString(), reason };
      store.add({ ...info, state }); // IndexedDB clones once inside its transaction.
      metadata.add(info);
      const allRequest = metadata.getAll();
      allRequest.onsuccess = () => {
        const snapshots = (allRequest.result as SnapshotMetadata[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || (a.id === info.id ? -1 : b.id === info.id ? 1 : 0));
        const checkpoints = snapshots.filter((item) => item.reason === "before-restore" || item.reason === "before-evidence-migration");
        const routine = snapshots.filter((item) => !checkpoints.includes(item));
        for (const item of [...checkpoints.slice(2), ...routine.slice(5)]) { store.delete(item.id); metadata.delete(item.id); }
      };
      transaction.oncomplete = () => { database.close(); resolve(); };
      const fail = () => { database.close(); reject(transaction?.error ?? new Error("Snapshot write failed")); };
      transaction.onerror = fail;
      transaction.onabort = fail;
    } catch (error) {
      try { transaction?.abort(); } catch { /* Already inactive. */ }
      database.close(); reject(error);
    }
  });
};

export interface SnapshotMetadata { id: string; createdAt: string; reason: string; }
export interface TrainingSnapshot extends SnapshotMetadata { state: TrainingState; }
export const listSnapshots = async (): Promise<SnapshotMetadata[]> =>
  (await transact<SnapshotMetadata[]>(SNAPSHOT_META_STORE, "readonly", (store) => store.getAll()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
/** Diagnostic bundle export deliberately reads full payloads; ordinary listings do not. */
export const loadAllSnapshots = async (): Promise<TrainingSnapshot[]> =>
  (await transact<TrainingSnapshot[]>(SNAPSHOT_STORE, "readonly", store => store.getAll())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export const loadSnapshot = (id: string): Promise<TrainingSnapshot | undefined> =>
  transact<TrainingSnapshot | undefined>(SNAPSHOT_STORE, "readonly", (store) => store.get(id));

export const resetTrainingData = (nextState: TrainingState, meta?: SyncMeta): Promise<void> => {
  const snapshot = structuredClone(nextState);
  const reset = pendingSave.catch(() => undefined).then(async () => {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      let transaction: IDBTransaction | undefined;
      try {
        transaction = database.transaction([STATE_STORE, SNAPSHOT_STORE, SNAPSHOT_META_STORE, SYNC_STORE, DEVICE_STORE], "readwrite");
        transaction.objectStore(STATE_STORE).clear();
        transaction.objectStore(STATE_STORE).put(snapshot, STATE_KEY);
        transaction.objectStore(SNAPSHOT_STORE).clear();
        transaction.objectStore(SNAPSHOT_META_STORE).clear();
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
