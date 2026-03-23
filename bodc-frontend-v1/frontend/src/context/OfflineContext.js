import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { openDB } from 'idb';
import { entriesAPI } from '../api/client';

const OfflineContext = createContext(null);

const DB_NAME    = 'bodc-offline';
const DB_VERSION = 1;
const STORE      = 'pending-entries';

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'client_id' });
      }
    },
  });
}

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // ── Online/offline detection ──────────────────────────────
  useEffect(() => {
    const goOnline  = () => { setIsOnline(true);  trySync(); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);

    // Listen for service worker sync success
    navigator.serviceWorker?.addEventListener('message', (e) => {
      if (e.data?.type === 'SYNC_SUCCESS') loadPendingCount();
    });

    loadPendingCount();
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []); // eslint-disable-line

  async function loadPendingCount() {
    try {
      const db = await getDB();
      const count = await db.count(STORE);
      setPendingCount(count);
    } catch {}
  }

  // ── Queue an entry for offline storage ───────────────────
  const queueEntry = useCallback(async (entry) => {
    const clientId = `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const record   = { ...entry, client_id: clientId, offline_created_at: new Date().toISOString() };
    const db = await getDB();
    await db.put(STORE, record);
    await loadPendingCount();
    return clientId;
  }, []);

  // ── Sync pending entries when back online ─────────────────
  const trySync = useCallback(async () => {
    if (syncing) return;
    try {
      setSyncing(true);
      const db      = await getDB();
      const pending = await db.getAll(STORE);
      if (!pending.length) return;

      const { data } = await entriesAPI.sync(pending);
      // Remove successfully synced entries
      for (const result of data.results) {
        if (result.status === 'created' || result.status === 'duplicate') {
          await db.delete(STORE, result.client_id);
        }
      }
      await loadPendingCount();
    } catch (err) {
      console.warn('Sync failed, will retry when online:', err.message);
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  // ── Create entry: online = direct API, offline = queue ───
  const createEntry = useCallback(async (entryData) => {
    if (isOnline) {
      try {
        const { data } = await entriesAPI.create(entryData);
        return { success: true, entry: data.entry, offline: false };
      } catch (err) {
        // Network error — fall through to offline queue
        if (!err.response) {
          const clientId = await queueEntry(entryData);
          return { success: true, clientId, offline: true };
        }
        throw err;
      }
    } else {
      const clientId = await queueEntry(entryData);
      return { success: true, clientId, offline: true };
    }
  }, [isOnline, queueEntry]);

  return (
    <OfflineContext.Provider value={{
      isOnline, pendingCount, syncing,
      queueEntry, trySync, createEntry, loadPendingCount,
    }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider');
  return ctx;
}
