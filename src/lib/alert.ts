import { Alert, Platform } from 'react-native';

/** Alertas que funcionam também na versão web. */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') globalThis.alert?.([title, message].filter(Boolean).join('\n\n'));
  else Alert.alert(title, message);
}

export function confirm(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
