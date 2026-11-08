import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Card, Input, Screen, T } from '../components/ui';
import { confirm, errorMessage, notify } from '../lib/alert';
import { useStore } from '../lib/store';
import { cloudConfigured, supabase } from '../lib/supabase';
import { syncNow } from '../lib/sync';
import { useTheme } from '../lib/theme';

/** Login com e-mail e senha (Supabase Auth). A conta liga sincronização, backup e IA. */
export default function AuthScreen() {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const pending = useStore((s) => Object.keys(s.dirty).length);

  useEffect(() => {
    void supabase?.auth.getSession().then(({ data }) => setUserEmail(data.session?.user.email ?? null));
  }, []);

  if (!cloudConfigured || !supabase) {
    return (
      <Screen edges={['bottom']}>
        <Card style={{ gap: 8 }}>
          <T weight="700">Nuvem não configurada</T>
          <T muted size={14}>
            Para ativar conta, sincronização, backup e IA, crie um projeto gratuito no Supabase e preencha
            EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env (passo a passo no README).
          </T>
        </Card>
      </Screen>
    );
  }

  const submit = async () => {
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase!.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) {
          notify('Confirme seu e-mail', 'Enviamos um link de confirmação. Depois de confirmar, entre com seu e-mail e senha.');
          setMode('signin');
          return;
        }
      } else {
        const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      await syncNow().catch(() => undefined);
      router.back();
    } catch (e) {
      notify('Não foi possível entrar', translate(errorMessage(e)));
    } finally {
      setLoading(false);
    }
  };

  if (userEmail) {
    return (
      <Screen edges={['bottom']}>
        <Card style={{ gap: 12 }}>
          <T>
            Conectado como <T weight="700">{userEmail}</T>
          </T>
          <T muted size={13}>
            Seus dados são salvos neste aparelho e sincronizados com a nuvem sempre que houver internet.
          </T>
          <Button
            variant="soft"
            title="Sair da conta"
            onPress={() =>
              confirm(
                'Sair da conta?',
                pending
                  ? `Há ${pending} alteração(ões) ainda não enviadas. Elas continuam neste aparelho e serão enviadas quando você entrar de novo.`
                  : 'Seus dados continuam neste aparelho.',
                'Sair',
                () => {
                  void supabase!.auth.signOut().then(() => {
                    setUserEmail(null);
                    // permite baixar tudo de novo se entrar com outra conta
                    useStore.getState().setSyncMeta({ lastPulledAt: null, lastSyncAt: null });
                  });
                },
              )
            }
          />
        </Card>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']}>
        <T size={22} weight="800">
          {mode === 'signin' ? 'Entrar' : 'Criar conta'}
        </T>
        <T muted size={14}>
          Sincronize entre iPhone, Android e web, tenha backup automático e use a IA para resumos, flashcards e leitura de
          fotos.
        </T>
        <Input
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <Input
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          textContentType={mode === 'signin' ? 'password' : 'newPassword'}
        />
        <Button
          title={mode === 'signin' ? 'Entrar' : 'Criar conta'}
          loading={loading}
          disabled={!email.includes('@') || password.length < 6}
          onPress={() => void submit()}
        />
        <Button
          variant="ghost"
          title={mode === 'signin' ? 'Não tem conta? Criar agora' : 'Já tem conta? Entrar'}
          onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        />
        {mode === 'signup' ? (
          <T size={12} muted>
            A senha precisa ter pelo menos 6 caracteres.
          </T>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function translate(msg: string) {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/already registered/i.test(msg)) return 'Este e-mail já tem conta. Use "Entrar".';
  if (/network|fetch/i.test(msg)) return 'Sem conexão com a internet.';
  return msg;
}
