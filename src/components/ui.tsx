import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Texto que respeita o tema e o tamanho de fonte escolhido nos Ajustes. */
export function T({
  children,
  size = 15,
  weight = '400',
  muted,
  color,
  style,
  numberOfLines,
  center,
}: {
  children: ReactNode;
  size?: number;
  weight?: TextStyle['fontWeight'];
  muted?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  center?: boolean;
}) {
  const t = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          color: color ?? (muted ? t.textMuted : t.text),
          fontSize: size * t.fontScale,
          fontWeight: weight,
          lineHeight: size * t.fontScale * 1.4,
          textAlign: center ? 'center' : undefined,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  edges = ['top'],
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: ('top' | 'bottom')[];
}) {
  const t = useTheme();
  const content = padded ? <View style={styles.padded}>{children}</View> : children;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.bg }}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 48 }}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor: t.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    padding: 16,
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, style, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  icon,
  variant = 'primary',
  loading,
  disabled,
  style,
  small,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'soft' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const t = useTheme();
  const bg =
    variant === 'primary' ? t.accent : variant === 'soft' ? t.accentSoft : variant === 'danger' ? t.danger : 'transparent';
  const fg = variant === 'primary' || variant === 'danger' ? t.onAccent : t.accent;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: 12,
          paddingVertical: small ? 8 : 12,
          paddingHorizontal: small ? 12 : 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : icon ? (
        <Ionicons name={icon} size={small ? 16 : 18} color={fg} />
      ) : null}
      <T color={fg} weight="600" size={small ? 13 : 15}>
        {title}
      </T>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  color,
  size = 22,
  label,
  active,
}: {
  icon: IconName;
  onPress: () => void;
  color?: string;
  size?: number;
  label: string;
  active?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        padding: 8,
        borderRadius: 10,
        backgroundColor: active ? t.accentSoft : 'transparent',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={size} color={color ?? (active ? t.accent : t.text)} />
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  onLongPress,
  color,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  color?: string;
}) {
  const t = useTheme();
  const c = color ?? t.accent;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: active ? c : t.surfaceAlt,
      }}
    >
      <T size={13} weight="600" color={active ? t.onAccent : t.textMuted}>
        {label}
      </T>
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const t = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <T size={13} muted weight="600">
          {label}
        </T>
      ) : null}
      <TextInput
        placeholderTextColor={t.textMuted}
        {...rest}
        style={[
          {
            backgroundColor: t.surfaceAlt,
            color: t.text,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15 * t.fontScale,
          },
          style,
        ]}
      />
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <T size={13} weight="700" muted style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {title}
      </T>
      {action}
    </View>
  );
}

export function Empty({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
      <Ionicons name={icon} size={40} color={t.textMuted} />
      <T weight="600">{title}</T>
      {hint ? (
        <T muted size={13} center>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

export interface SheetOption {
  label: string;
  icon?: IconName;
  onPress: () => void;
  destructive?: boolean;
  hint?: string;
}

/** Folha de opções que sobe da parte de baixo da tela. */
export function Sheet({
  visible,
  onClose,
  title,
  options,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  options?: SheetOption[];
  children?: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={{
          backgroundColor: t.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 16),
          paddingHorizontal: 16,
          maxHeight: '85%',
        }}
      >
        <View style={[styles.grabber, { backgroundColor: t.border }]} />
        {title ? (
          <T size={17} weight="700" style={{ marginVertical: 8 }}>
            {title}
          </T>
        ) : null}
        <ScrollView keyboardShouldPersistTaps="handled">
          {options?.map((o) => (
            <Pressable
              key={o.label}
              onPress={() => {
                onClose();
                o.onPress();
              }}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: t.surfaceAlt }]}
            >
              {o.icon ? <Ionicons name={o.icon} size={20} color={o.destructive ? t.danger : t.accent} /> : null}
              <View style={{ flex: 1 }}>
                <T color={o.destructive ? t.danger : undefined}>{o.label}</T>
                {o.hint ? (
                  <T size={12} muted>
                    {o.hint}
                  </T>
                ) : null}
              </View>
            </Pressable>
          ))}
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: 20, paddingTop: 12, gap: 16 },
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
});
