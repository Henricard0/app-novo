import { Navigate, type RouteObject } from 'react-router'
import { ExigeLogin, SomenteVisitante } from '@/auth/guardas'
import { LayoutApp } from '@/components/layout/LayoutApp'
import { CriarConta } from '@/pages/auth/CriarConta'
import { Entrar } from '@/pages/auth/Entrar'
import { EsqueciSenha } from '@/pages/auth/EsqueciSenha'
import { NovaSenha } from '@/pages/auth/NovaSenha'
import { EmConstrucao } from '@/pages/EmConstrucao'
import { Inicio } from '@/pages/Inicio'
import { NaoEncontrada } from '@/pages/NaoEncontrada'

export const rotas: RouteObject[] = [
  { path: '/', element: <Navigate to="/inicio" replace /> },
  {
    element: <SomenteVisitante />,
    children: [
      { path: '/entrar', element: <Entrar /> },
      { path: '/criar-conta', element: <CriarConta /> },
      { path: '/esqueci-a-senha', element: <EsqueciSenha /> },
    ],
  },
  { path: '/nova-senha', element: <NovaSenha /> },
  {
    element: <ExigeLogin />,
    children: [
      {
        element: <LayoutApp />,
        children: [
          { path: '/inicio', element: <Inicio /> },
          {
            path: '/agenda',
            element: (
              <EmConstrucao
                titulo="Agenda"
                fase="Fase 1"
                descricao="Agenda simples com as sessões do dia e da semana, presenciais e online."
              />
            ),
          },
          {
            path: '/pacientes',
            element: (
              <EmConstrucao
                titulo="Pacientes"
                fase="Fase 1"
                descricao="Cadastro de pacientes e prontuário com histórico de versões. Nada é apagado de verdade: a guarda mínima é de 5 anos."
              />
            ),
          },
          {
            path: '/supervisao',
            element: (
              <EmConstrucao
                titulo="Supervisão"
                fase="Fase 2"
                descricao="Convide seu supervisor, leve casos anonimizados para a pauta, receba devolutivas e acumule horas de supervisão."
              />
            ),
          },
          {
            path: '/financeiro',
            element: (
              <EmConstrucao
                titulo="Financeiro"
                fase="Fase 5"
                descricao="Controle de pagamentos e emissão de recibos (Receita Saúde e NFS-e)."
              />
            ),
          },
          {
            path: '/documentos',
            element: (
              <EmConstrucao
                titulo="Documentos"
                fase="Fase 5"
                descricao="Declarações em PDF, como a de horas de supervisão, e documentos com assinatura digital."
              />
            ),
          },
        ],
      },
    ],
  },
  { path: '*', element: <NaoEncontrada /> },
]
