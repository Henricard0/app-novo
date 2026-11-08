import Storage from 'expo-sqlite/kv-store';
import type { StateStorage } from 'zustand/middleware';

/**
 * Armazenamento persistente local. Usa SQLite (sem o limite de ~6 MB do
 * AsyncStorage no Android), então o app funciona 100% offline.
 */
export const kvStorage: StateStorage = {
  getItem: (key) => Storage.getItem(key),
  setItem: (key, value) => Storage.setItem(key, value),
  removeItem: async (key) => {
    await Storage.removeItem(key);
  },
};
