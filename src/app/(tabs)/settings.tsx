import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { Button, Card, Chip, Input, Row, Screen, SectionTitle, T } from '../../components/ui';
import { confirm, errorMessage, notify } from '../../lib/alert';
import { formatRelative } from '../../lib/dates';
import { exportBackup, importBackupFromFile } from '../../lib/export';
import { ensurePermission, reschedule } from '../../lib/notifications';
import { DEFAULT_SETTINGS, useStore } from '../../lib/store';
import { cloudConfigured, supabase } from '../../lib/supabase';
import { syncNow } from '../../lib/sync';
import { ACCENTS, useTheme } from '../../lib/theme';
import type { DashboardWidgets, Settings } from '../../lib/types';

const WIDGET_LABELS: Record<keyof DashboardWidgets, string> = {
  stats: 'Números (notas, revisões, tarefas)',
  review: 'Cartão "hora de revisar"',
  quickActions: 'Atalhos (nota, ditado, foto)',
  tasks: 'Próximas tarefas',
  recent: 'Notas recentes',
};

export default function SettingsScreen() {
  const t = useTheme();
  const s = useStore((st) => st.settings);
  const sync = useStore((st) => st.sync);
  const pending = useStore((st) => Object.keys(st.dirty).length);
  const set = (patch: Partial<Settings>) => useStore.getState().setSettings(patch);
  const [email, setEmail] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setEmail(session?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const runSync = async () => {
    setSyncing(true);
    try {
      const r = await syncNow();
      notify('Sincronizado', `${r.pushed} enviado(s), ${r.pulled} recebido(s).`);
    } catch (e) {
      notify('Sincronização', errorMessage(e));
    } finally {
      setSyncing(false);
    }
  };

  const toggleNotifications = async (on: boolean) => {
    if (on && !(await ensurePermission())) {
      notify('Permissão negada', 'Ative as notificações do app nos Ajustes do aparelho.');
      return;
    }
    set({ notificationsEnabled: on });
    void reschedule();
  };

  return (
    <Screen>
      <T size={28} weight="800" style={{ marginTop: 8 }}>
        Ajustes
      </T>

      <SectionTitle title="Conta e nuvem" />
      <Card style={{ gap: 12 }}>
        {!cloudConfigured ? (
          <T muted size={13}>
            A nuvem ainda não foi configurada neste app. Tudo funciona offline; para sincronizar entre aparelhos, fazer
            backup automático e usar a IA, configure o Supabase (veja o README do projeto).
          </T>
        ) : email ? (
          <>
            <T>
              Conectado como <T weight="700">{email}</T>
            </T>
            <T size={13} muted>
              {sync.lastSyncAt ? `Última sincronização ${formatRelative(sync.lastSyncAt)}` : 'Ainda não sincronizado'}
              {pending ? ` · ${pending} alteração(ões) pendente(s)` : ''}
            </T>
            {sync.lastError ? (
              <T size={12} color={t.danger}>
                {sync.lastError}
              </T>
            ) : null}
            <Row>
              <Button style={{ flex: 1 }} icon="sync" title="Sincronizar agora" loading={syncing} onPress={() => void runSync()} />
              <Button variant="soft" title="Conta" onPress={() => router.push('/auth')} />
            </Row>
            <Toggle label="Sincronizar automaticamente" value={s.autoSync} onChange={(autoSync) => set({ autoSync })} />
          </>
        ) : (
          <>
            <T muted size={13}>
              Entre para sincronizar iPhone, Android e web, ter backup automático na nuvem e usar a IA.
            </T>
            <Button icon="log-in-outline" title="Entrar ou criar conta" onPress={() => router.push('/auth')} />
          </>
        )}
      </Card>

      <SectionTitle title="Aparência" />
      <Card style={{ gap: 14 }}>
        <Input label="Seu nome (para a saudação)" value={s.userName} onChangeText={(userName) => set({ userName })} placeholder="Opcional" />
        <Field label="Tema">
          <Chip label="Automático" active={s.themeMode === 'system'} onPress={() => set({ themeMode: 'system' })} />
          <Chip label="☀️ Claro" active={s.themeMode === 'light'} onPress={() => set({ themeMode: 'light' })} />
          <Chip label="🌙 Escuro" active={s.themeMode === 'dark'} onPress={() => set({ themeMode: 'dark' })} />
        </Field>
        <Field label="Cor de destaque">
          {ACCENTS.map((c) => (
            <Pressable
              key={c}
              accessibilityLabel={`Cor ${c}`}
              onPress={() => set({ accent: c })}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: c,
                borderWidth: s.accent === c ? 3 : 0,
                borderColor: t.text,
              }}
            />
          ))}
        </Field>
        <Field label="Tamanho do texto">
          {(
            [
              [0.9, 'Pequeno'],
              [1, 'Médio'],
              [1.15, 'Grande'],
              [1.3, 'Enorme'],
            ] as const
          ).map(([v, label]) => (
            <Chip key={v} label={label} active={s.fontScale === v} onPress={() => set({ fontScale: v })} />
          ))}
        </Field>
        <Field label="Fonte do editor">
          <Chip label="Sem serifa" active={s.editorFont === 'sans'} onPress={() => set({ editorFont: 'sans' })} />
          <Chip label="Serifada" active={s.editorFont === 'serif'} onPress={() => set({ editorFont: 'serif' })} />
          <Chip label="Monoespaçada" active={s.editorFont === 'mono'} onPress={() => set({ editorFont: 'mono' })} />
        </Field>
        <Toggle
          label="Abrir notas no modo leitura"
          value={s.openNotesInPreview}
          onChange={(openNotesInPreview) => set({ openNotesInPreview })}
        />
      </Card>

      <SectionTitle title="Painel inicial" />
      <Card style={{ gap: 4 }}>
        {(Object.keys(WIDGET_LABELS) as (keyof DashboardWidgets)[]).map((k) => (
          <Toggle
            key={k}
            label={WIDGET_LABELS[k]}
            value={s.widgets[k]}
            onChange={(v) => set({ widgets: { ...s.widgets, [k]: v } })}
          />
        ))}
      </Card>

      <SectionTitle title="Voz e IA" />
      <Card style={{ gap: 14 }}>
        <Field label="Idioma do ditado">
          {[
            ['pt-BR', 'Português (BR)'],
            ['pt-PT', 'Português (PT)'],
            ['en-US', 'Inglês'],
            ['es-ES', 'Espanhol'],
          ].map(([v, label]) => (
            <Chip key={v} label={label} active={s.speechLang === v} onPress={() => set({ speechLang: v })} />
          ))}
        </Field>
        <Field label="Idioma dos resumos e flashcards">
          {['português do Brasil', 'inglês', 'espanhol', 'mesmo idioma da nota'].map((v) => (
            <Chip key={v} label={v} active={s.aiLanguage === v} onPress={() => set({ aiLanguage: v })} />
          ))}
        </Field>
      </Card>

      <SectionTitle title="Notificações" />
      <Card style={{ gap: 14 }}>
        <Toggle label="Lembretes inteligentes" value={s.notificationsEnabled} onChange={(v) => void toggleNotifications(v)} />
        <T size={12} muted>
          Avisos antes do prazo das tarefas e um lembrete diário só nos dias em que há revisões ou tarefas pendentes.
        </T>
        <Field label="Lembrete diário de estudo">
          {['07:30', '12:00', '18:00', '19:00', '21:00'].map((v) => (
            <Chip key={v} label={v} active={s.dailyReminderTime === v} onPress={() => set({ dailyReminderTime: v })} />
          ))}
        </Field>
        <Field label="Avisar tarefas com antecedência de">
          {[
            [0, 'Na hora'],
            [15, '15 min'],
            [30, '30 min'],
            [60, '1 h'],
            [1440, '1 dia'],
          ].map(([v, label]) => (
            <Chip
              key={v}
              label={String(label)}
              active={s.taskReminderOffsetMin === v}
              onPress={() => set({ taskReminderOffsetMin: Number(v) })}
            />
          ))}
        </Field>
      </Card>

      <SectionTitle title="Backup e exportação" />
      <Card style={{ gap: 10 }}>
        <T size={13} muted>
          {cloudConfigured
            ? 'Com a conta conectada, tudo (inclusive as fotos) já fica salvo na nuvem. Você também pode guardar uma cópia em arquivo.'
            : 'Guarde uma cópia de tudo em um arquivo (iCloud Drive, Google Drive, e-mail…).'}
        </T>
        <Button
          variant="soft"
          icon="download-outline"
          title="Exportar backup (JSON)"
          onPress={() => exportBackup().catch((e) => notify('Backup', errorMessage(e)))}
        />
        <Button
          variant="soft"
          icon="cloud-upload-outline"
          title="Restaurar backup"
          onPress={() =>
            importBackupFromFile()
              .then((n) => n !== null && notify('Backup restaurado', `${n} nota(s) importada(s).`))
              .catch((e) => notify('Backup', errorMessage(e)))
          }
        />
      </Card>

      <SectionTitle title="Avançado" />
      <Card style={{ gap: 10 }}>
        <Button variant="ghost" title="Restaurar ajustes padrão" onPress={() => set(DEFAULT_SETTINGS)} />
        <Button
          variant="ghost"
          title="Apagar dados deste aparelho"
          onPress={() =>
            confirm(
              'Apagar dados deste aparelho?',
              'Notas, flashcards e tarefas serão removidos deste aparelho. O que já está na nuvem continua lá e volta na próxima sincronização.',
              'Apagar',
              () => useStore.getState().resetAll(),
            )
          }
        />
      </Card>

      <T size={12} muted center>
        Lumen {Constants.expoConfig?.version ?? ''} · seus dados ficam primeiro no seu aparelho
      </T>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T size={13} weight="600" muted>
        {label}
      </T>
      <Row style={{ flexWrap: 'wrap' }}>{children}</Row>
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
      <T style={{ flex: 1 }}>{label}</T>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.accent, false: t.surfaceAlt }} />
    </Row>
  );
}
