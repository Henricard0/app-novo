import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useHydrated } from '../lib/store';
import { useTheme } from '../lib/theme';
import { useBackgroundServices } from '../lib/useBackground';

export default function RootLayout() {
  const hydrated = useHydrated();
  const t = useTheme();
  useBackgroundServices();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(t.bg);
  }, [t.bg]);

  const navTheme = {
    ...(t.dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(t.dark ? DarkTheme : DefaultTheme).colors,
      primary: t.accent,
      background: t.bg,
      card: t.surface,
      text: t.text,
      border: t.border,
    },
  };

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <StatusBar style={t.dark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShadowVisible: false, headerTintColor: t.accent, headerBackTitle: 'Voltar' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="note/[id]" options={{ title: '' }} />
          <Stack.Screen name="review" options={{ title: 'Revisão', presentation: 'fullScreenModal' }} />
          <Stack.Screen name="auth" options={{ title: 'Conta e nuvem', presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
