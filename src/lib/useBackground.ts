import NetInfo from '@react-native-community/netinfo';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { processAiQueue } from './ai';
import { initNotifications, rescheduleSoon } from './notifications';
import { useHydrated, useStore } from './store';
import { supabase } from './supabase';
import { syncNow } from './sync';

const SYNC_DEBOUNCE = 4000;

/**
 * Tarefas em segundo plano enquanto o app está aberto:
 *  - sincroniza ao abrir, ao voltar para o app, ao reconectar e logo após alterações;
 *  - executa os pedidos de IA que ficaram na fila offline;
 *  - recalcula as notificações quando tarefas/cartões/ajustes mudam;
 *  - abre a tela certa ao tocar numa notificação.
 */
export function useBackgroundServices() {
  const hydrated = useHydrated();

  useEffect(() => {
    if (!hydrated) return;
    initNotifications();
    rescheduleSoon();

    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    const trySync = () => {
      const { settings } = useStore.getState();
      if (!supabase || !settings.autoSync) return;
      void syncNow()
        .then(() => processAiQueue())
        .catch(() => {
          // offline ou sem login: tenta de novo depois
        });
    };
    const scheduleSync = () => {
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(trySync, SYNC_DEBOUNCE);
    };

    trySync();

    const unsubStore = useStore.subscribe((s, prev) => {
      if (s.tasks !== prev.tasks || s.flashcards !== prev.flashcards || s.settings !== prev.settings) {
        rescheduleSoon();
      }
      if (s.dirty !== prev.dirty && Object.keys(s.dirty).length) scheduleSync();
    });

    let wasOnline = true;
    const unsubNet = NetInfo.addEventListener((st) => {
      const online = Boolean(st.isConnected && st.isInternetReachable !== false);
      if (online && !wasOnline) {
        trySync();
        void processAiQueue();
      }
      wasOnline = online;
    });

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase?.auth.startAutoRefresh();
        trySync();
        rescheduleSoon();
      } else {
        supabase?.auth.stopAutoRefresh();
      }
    });
    supabase?.auth.startAutoRefresh();

    const authSub = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') trySync();
    });

    let notifSub: { remove(): void } | null = null;
    if (Platform.OS !== 'web') {
      notifSub = Notifications.addNotificationResponseReceivedListener((res) => {
        const url = res.notification.request.content.data?.url;
        if (typeof url === 'string') router.push(url as never);
      });
    }

    return () => {
      if (syncTimer) clearTimeout(syncTimer);
      unsubStore();
      unsubNet();
      appSub.remove();
      authSub?.data.subscription.unsubscribe();
      notifSub?.remove();
    };
  }, [hydrated]);
}
