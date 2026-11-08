import { useColorScheme } from 'react-native';
import { useStore } from './store';
import type { EditorFont } from './types';

export interface Theme {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  danger: string;
  success: string;
  warning: string;
  fontScale: number;
  editorFontFamily: string | undefined;
}

export const ACCENTS = [
  '#6366F1', // índigo
  '#0EA5E9', // azul
  '#14B8A6', // turquesa
  '#22C55E', // verde
  '#F59E0B', // âmbar
  '#F43F5E', // rosa
  '#A855F7', // roxo
  '#64748B', // grafite
];

const FONT: Record<EditorFont, string | undefined> = {
  sans: undefined,
  serif: 'Georgia',
  mono: 'Menlo',
};

/** Acrescenta transparência a uma cor hexadecimal (#RRGGBB). */
export function alpha(hex: string, a: number): string {
  const v = Math.round(Math.min(1, Math.max(0, a)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 7)}${v}`;
}

export function useTheme(): Theme {
  const system = useColorScheme();
  const { themeMode, accent, fontScale, editorFont } = useStore((s) => s.settings);
  const dark = themeMode === 'system' ? system === 'dark' : themeMode === 'dark';

  return {
    dark,
    bg: dark ? '#0B0C10' : '#F7F7F8',
    surface: dark ? '#15171C' : '#FFFFFF',
    surfaceAlt: dark ? '#1D2027' : '#F0F1F3',
    border: dark ? '#262A33' : '#E4E5E9',
    text: dark ? '#ECEDEF' : '#14161A',
    textMuted: dark ? '#9097A3' : '#6B7280',
    accent,
    accentSoft: alpha(accent, dark ? 0.22 : 0.12),
    onAccent: '#FFFFFF',
    danger: dark ? '#F87171' : '#DC2626',
    success: dark ? '#4ADE80' : '#16A34A',
    warning: dark ? '#FBBF24' : '#D97706',
    fontScale,
    editorFontFamily: FONT[editorFont],
  };
}
