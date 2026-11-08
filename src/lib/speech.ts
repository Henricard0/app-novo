import { useCallback, useEffect, useRef, useState } from 'react';
import type * as SpeechModule from 'expo-speech-recognition';
import { useStore } from './store';

/**
 * Ditado por voz com o reconhecedor nativo do aparelho (Siri/Apple Speech no iPhone,
 * Google no Android). Funciona em modo contínuo: ideal para transcrever uma aula
 * ou ditar notas rápidas. Em alguns aparelhos funciona até sem internet.
 *
 * O módulo é nativo, então não existe no app Expo Go — nesse caso o botão
 * de microfone mostra uma explicação em vez de travar o app.
 */
let Speech: typeof SpeechModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Speech = require('expo-speech-recognition') as typeof SpeechModule;
} catch {
  Speech = null;
}

export const speechAvailable = Speech !== null;

const noopHook: typeof SpeechModule.useSpeechRecognitionEvent = () => {};
const useEvent = Speech?.useSpeechRecognitionEvent ?? noopHook;

export interface Dictation {
  available: boolean;
  listening: boolean;
  /** Texto parcial ainda sendo reconhecido. */
  interim: string;
  error: string | null;
  start(): Promise<void>;
  stop(): void;
}

/** `onText` recebe cada trecho final reconhecido (frase ou pausa). */
export function useDictation(onText: (text: string) => void): Dictation {
  const lang = useStore((s) => s.settings.speechLang);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const wanted = useRef(false);
  const interimRef = useRef('');
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const begin = useCallback(() => {
    Speech?.ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      continuous: true,
      addsPunctuation: true,
      maxAlternatives: 1,
      iosTaskHint: 'dictation',
    });
  }, [lang]);

  useEvent('start', () => setListening(true));
  useEvent('result', (ev) => {
    const text = ev.results[0]?.transcript ?? '';
    if (ev.isFinal) {
      interimRef.current = '';
      setInterim('');
      if (text.trim()) onTextRef.current(text.trim());
    } else {
      interimRef.current = text;
      setInterim(text);
    }
  });
  useEvent('error', (ev) => {
    // "no-speech" e "aborted" são normais em ditado longo: só reinicia.
    if (ev.error === 'no-speech' || ev.error === 'aborted') return;
    wanted.current = false;
    setError(ev.message || 'Erro no reconhecimento de voz.');
  });
  useEvent('end', () => {
    if (interimRef.current.trim()) {
      onTextRef.current(interimRef.current.trim());
      interimRef.current = '';
      setInterim('');
    }
    // Sessões longas são encerradas pelo sistema de tempos em tempos: reinicia sozinho.
    if (wanted.current) begin();
    else setListening(false);
  });

  useEffect(
    () => () => {
      wanted.current = false;
      Speech?.ExpoSpeechRecognitionModule.abort();
    },
    [],
  );

  const start = useCallback(async () => {
    setError(null);
    if (!Speech) {
      setError('O ditado precisa do app instalado (build de desenvolvimento ou loja), não do Expo Go.');
      return;
    }
    const perm = await Speech.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setError('Permita o uso do microfone e do reconhecimento de fala nos Ajustes.');
      return;
    }
    wanted.current = true;
    begin();
  }, [begin]);

  const stop = useCallback(() => {
    wanted.current = false;
    Speech?.ExpoSpeechRecognitionModule.stop();
  }, []);

  return { available: speechAvailable, listening, interim, error, start, stop };
}

/** Junta um trecho ditado ao texto existente, cuidando de espaços e maiúsculas. */
export function appendDictation(current: string, piece: string): string {
  if (!current.trim()) return capitalize(piece);
  const endsSentence = /[.!?:\n]\s*$/.test(current);
  const sep = current.endsWith('\n') ? '' : ' ';
  return current + sep + (endsSentence ? capitalize(piece) : piece);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
