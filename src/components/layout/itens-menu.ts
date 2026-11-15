export type ItemMenu = { rotulo: string; para: string }

export const ITENS_CONSULTORIO: ReadonlyArray<ItemMenu> = [
  { rotulo: 'Início', para: '/inicio' },
  { rotulo: 'Agenda', para: '/agenda' },
  { rotulo: 'Pacientes', para: '/pacientes' },
  { rotulo: 'Supervisão', para: '/supervisao' },
  { rotulo: 'Financeiro', para: '/financeiro' },
  { rotulo: 'Documentos', para: '/documentos' },
]
