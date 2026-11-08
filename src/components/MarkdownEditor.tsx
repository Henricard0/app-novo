import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View, type TextInputSelectionChangeEvent } from 'react-native';
import { useTheme } from '../lib/theme';
import { IconButton, T, type IconName } from './ui';

type Sel = { start: number; end: number };

interface Tool {
  icon?: IconName;
  /** Letra exibida no lugar do ícone (ex.: B para negrito). */
  glyph?: string;
  label: string;
  apply: (text: string, sel: Sel) => { text: string; sel: Sel };
}

/** Envolve a seleção com marcadores (ex.: **negrito**). */
function wrap(marker: string, placeholder: string) {
  return (text: string, sel: Sel) => {
    const selected = text.slice(sel.start, sel.end) || placeholder;
    const next = text.slice(0, sel.start) + marker + selected + marker + text.slice(sel.end);
    const start = sel.start + marker.length;
    return { text: next, sel: { start, end: start + selected.length } };
  };
}

/** Adiciona um prefixo no começo da linha atual (ex.: "# ", "- "). */
function linePrefix(prefix: string) {
  return (text: string, sel: Sel) => {
    const lineStart = text.lastIndexOf('\n', sel.start - 1) + 1;
    const next = text.slice(0, lineStart) + prefix + text.slice(lineStart);
    const pos = sel.end + prefix.length;
    return { text: next, sel: { start: pos, end: pos } };
  };
}

function insert(snippet: string, cursorOffset = snippet.length) {
  return (text: string, sel: Sel) => {
    const next = text.slice(0, sel.start) + snippet + text.slice(sel.end);
    const pos = sel.start + cursorOffset;
    return { text: next, sel: { start: pos, end: pos } };
  };
}

const TOOLS: Tool[] = [
  { glyph: 'H', label: 'Título', apply: linePrefix('## ') },
  { glyph: 'B', label: 'Negrito', apply: wrap('**', 'negrito') },
  { glyph: 'I', label: 'Itálico', apply: wrap('_', 'itálico') },
  { glyph: 'S', label: 'Tachado', apply: wrap('~~', 'texto') },
  { icon: 'list', label: 'Lista', apply: linePrefix('- ') },
  { icon: 'checkbox-outline', label: 'Checklist', apply: linePrefix('- [ ] ') },
  { icon: 'chatbox-ellipses-outline', label: 'Citação', apply: linePrefix('> ') },
  { icon: 'code-slash', label: 'Código', apply: insert('\n```\n\n```\n', 5) },
  { icon: 'link', label: 'Link', apply: insert('[texto](https://)', 1) },
  { icon: 'remove', label: 'Separador', apply: insert('\n---\n') },
  { icon: 'grid-outline', label: 'Tabela', apply: insert('\n| Coluna 1 | Coluna 2 |\n| --- | --- |\n|  |  |\n') },
];

export interface MarkdownEditorHandle {
  /** Insere texto na posição do cursor (usado pelo ditado e pela leitura de fotos). */
  insertAtCursor(text: string): void;
}

interface Props {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(function MarkdownEditor(
  { value, onChange, placeholder },
  ref,
) {
  const t = useTheme();
  const [sel, setSel] = useState<Sel>({ start: value.length, end: value.length });
  const [controlledSel, setControlledSel] = useState<Sel | undefined>();
  const valueRef = useRef(value);
  valueRef.current = value;
  const selRef = useRef(sel);
  selRef.current = sel;

  const apply = (fn: Tool['apply']) => {
    const res = fn(valueRef.current, selRef.current);
    onChange(res.text);
    setSel(res.sel);
    setControlledSel(res.sel);
    // libera a seleção controlada depois de aplicada, para não "travar" o cursor
    setTimeout(() => setControlledSel(undefined), 50);
  };

  useImperativeHandle(ref, () => ({
    insertAtCursor(text: string) {
      apply((cur, s) => {
        const before = cur.slice(0, s.start);
        const sep = before && !/\s$/.test(before) ? ' ' : '';
        return insert(sep + text)(cur, s);
      });
    },
  }));

  const onSelectionChange = (e: TextInputSelectionChangeEvent) =>
    setSel(e.nativeEvent.selection);

  return (
    <View style={{ gap: 8 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{ gap: 2, paddingVertical: 2 }}
        style={{ backgroundColor: t.surfaceAlt, borderRadius: 12 }}
      >
        {TOOLS.map((tool) =>
          tool.icon ? (
            <IconButton key={tool.label} icon={tool.icon} label={tool.label} size={19} onPress={() => apply(tool.apply)} />
          ) : (
            <Pressable
              key={tool.label}
              accessibilityLabel={tool.label}
              onPress={() => apply(tool.apply)}
              style={({ pressed }) => ({ paddingHorizontal: 12, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
            >
              <T
                size={17}
                weight="800"
                style={{
                  fontStyle: tool.glyph === 'I' ? 'italic' : 'normal',
                  textDecorationLine: tool.glyph === 'S' ? 'line-through' : 'none',
                }}
              >
                {tool.glyph}
              </T>
            </Pressable>
          ),
        )}
      </ScrollView>
      <TextInput
        multiline
        value={value}
        onChangeText={onChange}
        onSelectionChange={onSelectionChange}
        selection={controlledSel}
        placeholder={placeholder}
        placeholderTextColor={t.textMuted}
        textAlignVertical="top"
        scrollEnabled={false}
        style={{
          minHeight: 260,
          color: t.text,
          fontSize: 16 * t.fontScale,
          lineHeight: 16 * t.fontScale * 1.5,
          fontFamily: t.editorFontFamily,
          paddingVertical: 4,
        }}
      />
    </View>
  );
});
