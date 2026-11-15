// Cria os usuários de exemplo (fictícios) nos emuladores locais do Firebase.
// Uso: com `npm run emuladores` rodando, execute `npm run emuladores:semear`.
// Só funciona nos emuladores: o projeto "demo-triade" não existe na nuvem.

const PROJETO = 'demo-triade'
const AUTH = 'http://127.0.0.1:9099'
const FIRESTORE = 'http://127.0.0.1:8080'
const SENHA = 'senha-teste-123'

const USUARIOS = [
  { email: 'marina.costa@example.com', nome: 'Marina Costa', regiao: '08', numero: '12345' },
  { email: 'paulo.andrade@example.com', nome: 'Paulo Andrade', regiao: '08', numero: '4567' },
  { email: 'bianca.lima@example.com', nome: 'Bianca Lima', regiao: null, numero: null },
]

const ADMIN = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }

async function chamar(url, corpo, cabecalhos = { 'Content-Type': 'application/json' }) {
  const resposta = await fetch(url, { method: 'POST', headers: cabecalhos, body: JSON.stringify(corpo) })
  const dados = await resposta.json()
  if (!resposta.ok) throw new Error(`${url}: ${JSON.stringify(dados)}`)
  return dados
}

function valor(v) {
  return v === null ? { nullValue: null } : { stringValue: v }
}

for (const u of USUARIOS) {
  let uid
  try {
    const criado = await chamar(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
      email: u.email,
      password: SENHA,
    })
    uid = criado.localId
  } catch (erro) {
    if (!String(erro).includes('EMAIL_EXISTS')) throw erro
    const entrou = await chamar(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo`, {
      email: u.email,
      password: SENHA,
    })
    uid = entrou.localId
  }

  await chamar(
    `${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJETO}/accounts:update`,
    { localId: uid, emailVerified: true },
    ADMIN,
  )

  const agora = new Date().toISOString()
  const resposta = await fetch(`${FIRESTORE}/v1/projects/${PROJETO}/databases/(default)/documents/profiles/${uid}`, {
    method: 'PATCH',
    headers: ADMIN,
    body: JSON.stringify({
      fields: {
        full_name: valor(u.nome),
        crp_region: valor(u.regiao),
        crp_number: valor(u.numero),
        created_at: { timestampValue: agora },
        updated_at: { timestampValue: agora },
      },
    }),
  })
  if (!resposta.ok) throw new Error(`perfil de ${u.email}: ${await resposta.text()}`)
  console.log(`✔ ${u.email} (${u.nome})`)
}

console.log(`\nSenha de todos: ${SENHA}`)
