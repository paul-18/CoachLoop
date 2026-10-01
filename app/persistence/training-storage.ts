import { uid, type TrainingState } from "../domain/training-types";

const DB_NAME = "coach-loop";
const DB_VERSION = 3;
const STATE_STORE = "app";
const SNAPSHOT_STORE = "snapshots";
const SYNC_STORE = "sync";
const DEVICE_STORE = "device";
const STATE_KEY = "training-state";
const SYNC_KEY = "cloud-sync";

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
export const saveTrainingState = (state: TrainingState) => {
  const snapshot = structuredClone(state);
  // Keep rapid edits in order, and do not report success before the transaction commits.
  const saved = pendingSave.catch(() => undefined).then(() =>
    transact(STATE_STORE, "readwrite", (store) => store.put(snapshot, STATE_KEY)),
  );
  pendingSave = saved;
  return saved;
};

export const loadSyncMeta = async (): Promise<SyncMeta> => {
  try {
    return (await transact<SyncMeta | undefined>(SYNC_STORE, "readonly", (store) =>
      store.get(SYNC_KEY),
    )) ?? { revision: 0, lastSyncedHash: null, lastSyncedAt: null };
  } catch {
    return { revision: 0, lastSyncedHash: null, lastSyncedAt: null };
  }
};

export const saveSyncMeta = async (meta: SyncMeta) => {
  await transact(SYNC_STORE, "readwrite", (store) =>
    store.put(structuredClone(meta), SYNC_KEY),
  );
};

/** State and its acknowledged cloud revision become visible in one transaction. */
export const saveStateAndSyncMeta = (state: TrainingState, meta: SyncMeta): Promise<void> => {
  const snapshot = structuredClone(state);
  const metadata = structuredClone(meta);
  const saved = pendingSave.catch(() => undefined).then(async () => {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      try {
        const transaction = database.transaction([STATE_STORE, SYNC_STORE], "readwrite");
        transaction.objectStore(STATE_STORE).put(snapshot, STATE_KEY);
        transaction.objectStore(SYNC_STORE).put(metadata, SYNC_KEY);
        transaction.oncomplete = () => { database.close(); resolve(); };
        const fail = () => { database.close(); reject(transaction.error ?? new Error("Sync checkpoint aborted")); };
        transaction.onerror = fail;
        transaction.onabort = fail;
      } catch (error) { database.close(); reject(error); }
    });
  });
  pendingSave = saved;
  return saved;
};

export const getDeviceId = async (): Promise<string> => {
  const existing = await transact<string | undefined>(DEVICE_STORE, "readonly", (store) => store.get("id"));
  if (existing) return existing;
  const id = uid("device");
  await transact(DEVICE_STORE, "readwrite", (store) => store.put(id, "id"));
  return id;
};

export const loadConflictOverrides = async (): Promise<Record<string, unknown>> =>
  (await transact<Record<string, unknown> | undefined>(DEVICE_STORE, "readonly", (store) => store.get("conflict-overrides"))) ?? {};

export const saveConflictOverrides = async (overrides: Record<string, unknown>): Promise<void> => {
  await transact(DEVICE_STORE, "readwrite", (store) => store.put(structuredClone(overrides), "conflict-overrides"));
};

export const reconcileConflictOverrides = async (pendingIds: string[]): Promise<Record<string, unknown>> => {
  const previous = await loadConflictOverrides();
  const allowed = new Set(pendingIds);
  const next = Object.fromEntries(Object.entries(previous).filter(([id]) => allowed.has(id)));
  if (Object.keys(next).length !== Object.keys(previous).length) await saveConflictOverrides(next);
  return next;
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
      try {
        const transaction = database.transaction([STATE_STORE, SNAPSHOT_STORE, SYNC_STORE, DEVICE_STORE], "readwrite");
        transaction.objectStore(STATE_STORE).clear();
        transaction.objectStore(STATE_STORE).put(snapshot, STATE_KEY);
        transaction.objectStore(SNAPSHOT_STORE).clear();
        transaction.objectStore(SYNC_STORE).clear();
        if (meta) transaction.objectStore(SYNC_STORE).put(structuredClone(meta), SYNC_KEY);
        transaction.objectStore(DEVICE_STORE).delete("conflict-overrides");
        transaction.oncomplete = () => { database.close(); resolve(); };
        const fail = () => { database.close(); reject(transaction.error ?? new Error("Local reset failed")); };
        transaction.onerror = fail;
        transaction.onabort = fail;
      } catch (error) { database.close(); reject(error); }
    });
  });
  pendingSave = reset;
  return reset;
};
