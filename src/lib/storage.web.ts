import type { StateStorage } from 'zustand/middleware';

/** Na versão web (usada para pré-visualização), o localStorage basta. */
export const kvStorage: StateStorage = {
  getItem: (key) => {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // modo privado ou armazenamento cheio: segue só em memória
    }
  },
  removeItem: (key) => {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // ignorado
    }
  },
};
