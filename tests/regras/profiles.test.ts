// Testes de acesso a profiles/{uid} por papel, contra o emulador do Firestore.
// Na Fase 0 ainda não existem vínculos de supervisão nem de estágio, então
// psicólogo, supervisor, estagiário e usuário sem vínculo têm o mesmo acesso:
// só ao próprio perfil. Quando os vínculos chegarem (Fases 2 e 4), este
// arquivo ganha os casos de leitura entre supervisor e supervisionando.
//
// Rodar: npm run test:regras

import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const PSICOLOGA = 'psicologa-teste'
const SUPERVISOR = 'supervisor-teste'
const ESTAGIARIA = 'estagiaria-teste'
const SEM_VINCULO = 'sem-vinculo-teste'

let ambiente: RulesTestEnvironment

beforeAll(async () => {
  const [host, porta] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':')
  ambiente = await initializeTestEnvironment({
    projectId: 'demo-triade',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(porta) },
  })
})

afterAll(async () => {
  await ambiente?.cleanup()
})

beforeEach(async () => {
  await ambiente.clearFirestore()
  await ambiente.withSecurityRulesDisabled(async (contexto) => {
    const db = contexto.firestore()
    const agora = Timestamp.now()
    await setDoc(doc(db, 'profiles', PSICOLOGA), {
      full_name: 'Psicóloga Teste',
      crp_region: '08',
      crp_number: '12345',
      created_at: agora,
      updated_at: agora,
    })
    await setDoc(doc(db, 'profiles', SUPERVISOR), {
      full_name: 'Supervisor Teste',
      crp_region: '06',
      crp_number: '54321',
      created_at: agora,
      updated_at: agora,
    })
    await setDoc(doc(db, 'profiles', ESTAGIARIA), {
      full_name: 'Estagiária Teste',
      crp_region: null,
      crp_number: null,
      created_at: agora,
      updated_at: agora,
    })
  })
})

/** Firestore de quem está logado com e-mail confirmado. */
function como(uid: string) {
  return ambiente.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }).firestore()
}

function perfilNovo(extra: Record<string, unknown> = {}) {
  return {
    full_name: 'Pessoa Nova',
    crp_region: '08',
    crp_number: '777',
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    ...extra,
  }
}

describe('usuário não logado', () => {
  it('não lê perfis', async () => {
    const db = ambiente.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'profiles', PSICOLOGA)))
    await assertFails(getDocs(collection(db, 'profiles')))
  })

  it('não cria nem edita perfis', async () => {
    const db = ambiente.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(db, 'profiles', 'invasor'), perfilNovo()))
    await assertFails(updateDoc(doc(db, 'profiles', PSICOLOGA), { full_name: 'Invasor', updated_at: serverTimestamp() }))
  })
})

describe('psicóloga', () => {
  it('lê o próprio perfil', async () => {
    await assertSucceeds(getDoc(doc(como(PSICOLOGA), 'profiles', PSICOLOGA)))
  })

  it('não lê o perfil do supervisor nem lista perfis', async () => {
    await assertFails(getDoc(doc(como(PSICOLOGA), 'profiles', SUPERVISOR)))
    await assertFails(getDocs(collection(como(PSICOLOGA), 'profiles')))
  })

  it('edita o próprio nome e CRP', async () => {
    await assertSucceeds(
      updateDoc(doc(como(PSICOLOGA), 'profiles', PSICOLOGA), {
        full_name: 'Psicóloga Renomeada',
        crp_region: '07',
        crp_number: '1',
        updated_at: serverTimestamp(),
      }),
    )
  })

  it('não edita o perfil de outra pessoa', async () => {
    await assertFails(
      updateDoc(doc(como(PSICOLOGA), 'profiles', SUPERVISOR), {
        full_name: 'Alterado por outra pessoa',
        updated_at: serverTimestamp(),
      }),
    )
  })

  it('não altera created_at nem deixa de atualizar updated_at', async () => {
    const meu = doc(como(PSICOLOGA), 'profiles', PSICOLOGA)
    await assertFails(updateDoc(meu, { created_at: Timestamp.fromDate(new Date('2020-01-01')), updated_at: serverTimestamp() }))
    await assertFails(updateDoc(meu, { full_name: 'Sem updated_at' }))
    await assertFails(updateDoc(meu, { full_name: 'Data forjada', updated_at: Timestamp.fromDate(new Date('2020-01-01')) }))
  })

  it('não acrescenta campos fora do modelo', async () => {
    await assertFails(
      updateDoc(doc(como(PSICOLOGA), 'profiles', PSICOLOGA), { plano: 'pro', updated_at: serverTimestamp() }),
    )
  })

  it('recusa CRP pela metade, CRP fora do formato e nome vazio', async () => {
    const meu = doc(como(PSICOLOGA), 'profiles', PSICOLOGA)
    await assertFails(updateDoc(meu, { crp_number: null, updated_at: serverTimestamp() }))
    await assertFails(updateDoc(meu, { crp_region: '8', updated_at: serverTimestamp() }))
    await assertFails(updateDoc(meu, { crp_number: '12a', updated_at: serverTimestamp() }))
    await assertFails(updateDoc(meu, { crp_number: '1234567', updated_at: serverTimestamp() }))
    await assertFails(updateDoc(meu, { full_name: '   ', updated_at: serverTimestamp() }))
    await assertFails(updateDoc(meu, { full_name: 'x'.repeat(201), updated_at: serverTimestamp() }))
  })

  it('não apaga perfis', async () => {
    await assertFails(deleteDoc(doc(como(PSICOLOGA), 'profiles', PSICOLOGA)))
  })
})

describe('cadastro (criação do perfil)', () => {
  it('quem acabou de criar a conta grava o próprio perfil, mesmo antes de confirmar o e-mail', async () => {
    const db = ambiente.authenticatedContext(SEM_VINCULO, { email_verified: false }).firestore()
    await assertSucceeds(setDoc(doc(db, 'profiles', SEM_VINCULO), perfilNovo()))
  })

  it('estagiária pode se cadastrar sem CRP', async () => {
    await assertSucceeds(setDoc(doc(como(SEM_VINCULO), 'profiles', SEM_VINCULO), perfilNovo({ crp_region: null, crp_number: null })))
  })

  it('não cria perfil em nome de outra pessoa', async () => {
    await assertFails(setDoc(doc(como(SEM_VINCULO), 'profiles', 'outra-pessoa'), perfilNovo()))
  })

  it('não sobrescreve um perfil existente por criação', async () => {
    await assertFails(setDoc(doc(como(SUPERVISOR), 'profiles', PSICOLOGA), perfilNovo()))
  })

  it('recusa datas forjadas, campos faltando ou a mais', async () => {
    const meu = doc(como(SEM_VINCULO), 'profiles', SEM_VINCULO)
    await assertFails(setDoc(meu, perfilNovo({ created_at: Timestamp.fromDate(new Date('2020-01-01')) })))
    await assertFails(setDoc(meu, { full_name: 'Sem CRP declarado', created_at: serverTimestamp(), updated_at: serverTimestamp() }))
    await assertFails(setDoc(meu, perfilNovo({ plano: 'pro' })))
  })
})

describe('supervisor', () => {
  it('vê só o próprio perfil (sem vínculos na Fase 0)', async () => {
    await assertSucceeds(getDoc(doc(como(SUPERVISOR), 'profiles', SUPERVISOR)))
    await assertFails(getDoc(doc(como(SUPERVISOR), 'profiles', PSICOLOGA)))
  })
})

describe('estagiária', () => {
  it('vê só o próprio perfil e não edita o do supervisor', async () => {
    await assertSucceeds(getDoc(doc(como(ESTAGIARIA), 'profiles', ESTAGIARIA)))
    await assertFails(getDoc(doc(como(ESTAGIARIA), 'profiles', SUPERVISOR)))
    await assertFails(
      updateDoc(doc(como(ESTAGIARIA), 'profiles', SUPERVISOR), {
        crp_region: '08',
        crp_number: '99999',
        updated_at: serverTimestamp(),
      }),
    )
  })
})

describe('usuário sem vínculo', () => {
  it('não vê nenhum perfil além do próprio', async () => {
    await assertFails(getDoc(doc(como(SEM_VINCULO), 'profiles', PSICOLOGA)))
    await assertFails(getDoc(doc(como(SEM_VINCULO), 'profiles', SUPERVISOR)))
    await assertFails(getDoc(doc(como(SEM_VINCULO), 'profiles', ESTAGIARIA)))
  })
})

describe('qualquer outra coleção', () => {
  it('é negada para todos os papéis, inclusive coleções clínicas futuras', async () => {
    for (const uid of [PSICOLOGA, SUPERVISOR, ESTAGIARIA, SEM_VINCULO]) {
      const db = como(uid)
      await assertFails(getDocs(collection(db, 'patients')))
      await assertFails(setDoc(doc(db, 'patients', 'p1'), { nome: 'Paciente Fictício' }))
      await assertFails(getDocs(collection(db, 'clinical_records')))
      await assertFails(getDocs(collection(db, 'supervision_case_sources')))
    }
  })
})
