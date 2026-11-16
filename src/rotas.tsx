import { Navigate, type RouteObject } from 'react-router'
import { ExigeLogin, SomenteVisitante } from '@/auth/guardas'
import { LayoutApp } from '@/components/layout/LayoutApp'
import { CriarConta } from '@/pages/auth/CriarConta'
import { Entrar } from '@/pages/auth/Entrar'
import { EsqueciSenha } from '@/pages/auth/EsqueciSenha'
import { NovaSenha } from '@/pages/auth/NovaSenha'
import { Agenda } from '@/pages/agenda/Agenda'
import { FormSessao } from '@/pages/agenda/FormSessao'
import { EmConstrucao } from '@/pages/EmConstrucao'
import { Inicio } from '@/pages/Inicio'
import { NaoEncontrada } from '@/pages/NaoEncontrada'
import { FichaPaciente } from '@/pages/pacientes/FichaPaciente'
import { FormPaciente } from '@/pages/pacientes/FormPaciente'
import { ListaPacientes } from '@/pages/pacientes/ListaPacientes'
import { FormRegistro } from '@/pages/prontuario/FormRegistro'
import { HistoricoRegistro } from '@/pages/prontuario/HistoricoRegistro'
import { MeuPerfil } from '@/pages/perfil/MeuPerfil'
import { Planos } from '@/pages/planos/Planos'
import { AceitarConvite } from '@/pages/supervisao/AceitarConvite'
import { CasoSupervisao } from '@/pages/supervisao/CasoSupervisao'
import { LevarCaso } from '@/pages/supervisao/LevarCaso'
import { Pauta } from '@/pages/supervisao/Pauta'
import { EncontrarSupervisor } from '@/pages/supervisao/EncontrarSupervisor'
import { MinhaSupervisao } from '@/pages/supervisao/MinhaSupervisao'
import { PerfilSupervisorPublico } from '@/pages/supervisao/PerfilSupervisorPublico'

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
          { path: '/agenda', element: <Agenda /> },
          { path: '/agenda/nova', element: <FormSessao /> },
          { path: '/agenda/:id/editar', element: <FormSessao /> },
          { path: '/pacientes', element: <ListaPacientes /> },
          { path: '/pacientes/novo', element: <FormPaciente /> },
          { path: '/pacientes/:id', element: <FichaPaciente /> },
          { path: '/pacientes/:id/editar', element: <FormPaciente /> },
          { path: '/pacientes/:id/registros/novo', element: <FormRegistro /> },
          { path: '/pacientes/:id/registros/:registroId/editar', element: <FormRegistro /> },
          { path: '/pacientes/:id/registros/:registroId/historico', element: <HistoricoRegistro /> },
          { path: '/supervisao', element: <MinhaSupervisao /> },
          { path: '/supervisao/encontrar', element: <EncontrarSupervisor /> },
          { path: '/supervisao/pauta', element: <Pauta /> },
          { path: '/supervisao/casos/:id', element: <CasoSupervisao /> },
          { path: '/pacientes/:id/supervisao/novo', element: <LevarCaso /> },
          { path: '/supervisao/supervisores/:id', element: <PerfilSupervisorPublico /> },
          { path: '/convite/:token', element: <AceitarConvite /> },
          { path: '/perfil', element: <MeuPerfil /> },
          { path: '/planos', element: <Planos /> },
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
