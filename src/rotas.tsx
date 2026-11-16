import { Navigate, type RouteObject } from 'react-router'
import { ExigeContador, ExigeDuasEtapas, ExigeLogin, ExigePsicologo, SomenteVisitante } from '@/auth/guardas'
import { LayoutApp } from '@/components/layout/LayoutApp'
import { CriarConta } from '@/pages/auth/CriarConta'
import { CriarContaContador } from '@/pages/auth/CriarContaContador'
import { Entrar } from '@/pages/auth/Entrar'
import { EsqueciSenha } from '@/pages/auth/EsqueciSenha'
import { NovaSenha } from '@/pages/auth/NovaSenha'
import { Agenda } from '@/pages/agenda/Agenda'
import { FormSessao } from '@/pages/agenda/FormSessao'
import { ClienteContador } from '@/pages/contador/ClienteContador'
import { Clientes } from '@/pages/contador/Clientes'
import { DuasEtapas } from '@/pages/contador/DuasEtapas'
import { EncontrarContador } from '@/pages/contador/EncontrarContador'
import { MeuContador } from '@/pages/contador/MeuContador'
import { PerfilContador } from '@/pages/contador/PerfilContador'
import { PerfilContadorPublico } from '@/pages/contador/PerfilContadorPublico'
import { EmConstrucao } from '@/pages/EmConstrucao'
import { Financeiro } from '@/pages/financeiro/Financeiro'
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
      { path: '/contador/entrar', element: <Entrar area="contador" /> },
      { path: '/contador/cadastro', element: <CriarContaContador /> },
    ],
  },
  { path: '/nova-senha', element: <NovaSenha /> },
  {
    element: <ExigeLogin />,
    children: [
      {
        element: <ExigeContador />,
        children: [
          {
            element: <LayoutApp area="contador" />,
            children: [
              { path: '/contador/seguranca', element: <DuasEtapas /> },
              {
                element: <ExigeDuasEtapas />,
                children: [
                  { path: '/contador', element: <Clientes /> },
                  {
                    path: '/contador/clientes/:id',
                    element: <ClienteContador />,
                  },
                  { path: '/contador/perfil', element: <PerfilContador /> },
                ],
              },
            ],
          },
        ],
      },
      {
        element: <ExigePsicologo />,
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
              {
                path: '/pacientes/:id/registros/novo',
                element: <FormRegistro />,
              },
              {
                path: '/pacientes/:id/registros/:registroId/editar',
                element: <FormRegistro />,
              },
              {
                path: '/pacientes/:id/registros/:registroId/historico',
                element: <HistoricoRegistro />,
              },
              { path: '/supervisao', element: <MinhaSupervisao /> },
              {
                path: '/supervisao/encontrar',
                element: <EncontrarSupervisor />,
              },
              { path: '/supervisao/pauta', element: <Pauta /> },
              { path: '/supervisao/casos/:id', element: <CasoSupervisao /> },
              {
                path: '/pacientes/:id/supervisao/novo',
                element: <LevarCaso />,
              },
              {
                path: '/supervisao/supervisores/:id',
                element: <PerfilSupervisorPublico />,
              },
              { path: '/convite/:token', element: <AceitarConvite /> },
              { path: '/perfil', element: <MeuPerfil /> },
              { path: '/planos', element: <Planos /> },
              { path: '/financeiro', element: <Financeiro /> },
              { path: '/meu-contador', element: <MeuContador /> },
              {
                path: '/meu-contador/encontrar',
                element: <EncontrarContador />,
              },
              {
                path: '/meu-contador/contadores/:id',
                element: <PerfilContadorPublico />,
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
    ],
  },
  { path: '*', element: <NaoEncontrada /> },
]
