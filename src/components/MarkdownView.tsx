import { Fragment } from 'react';
import { View } from 'react-native';
import { useMarkdown } from 'react-native-marked';
import { useTheme } from '../lib/theme';

/** Renderiza Markdown com as cores e o tamanho de fonte do tema atual. */
export function MarkdownView({ value }: { value: string }) {
  const t = useTheme();
  const base = 15 * t.fontScale;
  const elements = useMarkdown(value || '_Vazio_', {
    colorScheme: t.dark ? 'dark' : 'light',
    theme: {
      colors: {
        text: t.text,
        link: t.accent,
        border: t.border,
        code: t.surfaceAlt,
      },
    },
    styles: {
      text: { color: t.text, fontSize: base, lineHeight: base * 1.55, fontFamily: t.editorFontFamily },
      h1: { color: t.text, fontSize: base * 1.7, fontWeight: '800', marginTop: 8 },
      h2: { color: t.text, fontSize: base * 1.4, fontWeight: '700', marginTop: 8 },
      h3: { color: t.text, fontSize: base * 1.2, fontWeight: '700' },
      codespan: { backgroundColor: t.surfaceAlt, color: t.text, fontSize: base * 0.9 },
      code: { backgroundColor: t.surfaceAlt, borderRadius: 8, padding: 12 },
      codeText: { color: t.text, fontSize: base * 0.9 },
      blockquote: { borderLeftColor: t.accent, borderLeftWidth: 4, paddingLeft: 12 },
      li: { color: t.text, fontSize: base, lineHeight: base * 1.5 },
      link: { color: t.accent },
    },
  });
  return (
    <View style={{ gap: 4 }}>
      {elements.map((el, i) => (
        <Fragment key={i}>{el}</Fragment>
      ))}
    </View>
  );
}
