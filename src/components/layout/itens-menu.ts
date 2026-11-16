export type ItemMenu = { rotulo: string; para: string }

export const ITENS_CONSULTORIO: ReadonlyArray<ItemMenu> = [
  { rotulo: 'Início', para: '/inicio' },
  { rotulo: 'Agenda', para: '/agenda' },
  { rotulo: 'Pacientes', para: '/pacientes' },
  { rotulo: 'Supervisão', para: '/supervisao' },
  { rotulo: 'Financeiro', para: '/financeiro' },
  { rotulo: 'Contador', para: '/meu-contador' },
  { rotulo: 'Documentos', para: '/documentos' },
]

export const ITENS_CONTADOR: ReadonlyArray<ItemMenu> = [
  { rotulo: 'Clientes', para: '/contador' },
  { rotulo: 'Meu perfil', para: '/contador/perfil' },
  { rotulo: 'Segurança', para: '/contador/seguranca' },
]
