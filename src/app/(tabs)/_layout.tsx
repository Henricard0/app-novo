import { Ionicons } from '@expo/vector-icons';
import Tabs from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import { alive, useStore } from '../../lib/store';
import { isDue } from '../../lib/srs';
import { useTheme } from '../../lib/theme';
import type { IconName } from '../../components/ui';

function icon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;
}

export default function TabsLayout() {
  const t = useTheme();
  const dueCount = useStore((s) => alive(s.flashcards).filter((c) => isDue(c)).length);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.textMuted,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="notes" options={{ title: 'Notas', tabBarIcon: icon('document-text-outline') }} />
      <Tabs.Screen
        name="flashcards"
        options={{
          title: 'Flashcards',
          tabBarIcon: icon('albums-outline'),
          tabBarBadge: dueCount ? dueCount : undefined,
          tabBarBadgeStyle: { backgroundColor: t.accent },
        }}
      />
      <Tabs.Screen name="tasks" options={{ title: 'Tarefas', tabBarIcon: icon('checkmark-circle-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarIcon: icon('options-outline') }} />
    </Tabs>
  );
}
