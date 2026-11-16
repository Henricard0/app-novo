import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { nomeParaExibir, useAuth } from '@/auth/contexto'
import { Logo } from '@/components/ui/Logo'
import { useConsulta } from '@/lib/consultorio/useConsulta'
import { formatarCrp } from '@/lib/crp'
import { contarSolicitacoesRecebidas } from '@/lib/supervisao/api'
import { iniciais } from '@/lib/texto'
import { ITENS_CONSULTORIO } from './itens-menu'

const CLASSE_ITEM =
  'flex min-h-11 items-center rounded-control px-3 text-[15px] no-underline transition-colors'
const ITEM_ATIVO = 'bg-pine-soft font-semibold text-pine hover:text-pine'
const ITEM_INATIVO = 'text-ink-2 hover:bg-bg hover:text-ink'

/** Moldura do app logado: menu lateral (no celular, no topo) e área de conteúdo. */
export function LayoutApp() {
  const auth = useAuth()
  const location = useLocation()
  const [menuAberto, setMenuAberto] = useState(false)
  const [rotaAtual, setRotaAtual] = useState(location.pathname)
  const conteudo = useRef<HTMLElement>(null)
  const rotaComFoco = useRef(location.pathname)

  const idUsuario = auth.user?.id ?? ''
  // Pedidos de supervisão esperando resposta. Atualiza a cada troca de página.
  const pendentes = useConsulta(`pedidos-recebidos:${idUsuario}:${location.pathname}`, () =>
    contarSolicitacoesRecebidas(idUsuario),
  )
  const totalPendentes = pendentes.dados ?? 0

  const nome = nomeParaExibir(auth)
  const crp = formatarCrp(auth.perfil?.crp_region, auth.perfil?.crp_number)

  // Ao trocar de página, fecha o menu do celular.
  if (rotaAtual !== location.pathname) {
    setRotaAtual(location.pathname)
    setMenuAberto(false)
  }

  // Ao trocar de página (não no primeiro carregamento), leva o foco para o
  // conteúdo: leitores de tela anunciam a nova página. A rolagem fica com o
  // <ScrollRestoration />.
  useEffect(() => {
    if (rotaComFoco.current === location.pathname) return
    rotaComFoco.current = location.pathname
    conteudo.current?.focus({ preventScroll: true })
  }, [location.pathname])

  useEffect(() => {
    if (!menuAberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAberto(false)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [menuAberto])

  return (
    <div className="min-h-dvh bg-bg md:flex">
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-control bg-pine px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:text-white"
      >
        Pular para o conteúdo
      </a>

      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-surface px-4 md:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setMenuAberto((v) => !v)}
          aria-expanded={menuAberto}
          aria-controls="menu-lateral"
          className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border-strong bg-surface px-4 text-sm font-semibold text-ink"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            {menuAberto ? (
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
          {menuAberto ? 'Fechar' : 'Menu'}
        </button>
      </header>

      <aside
        id="menu-lateral"
        className={`${menuAberto ? 'flex' : 'hidden'} flex-col gap-6 border-b border-border bg-surface px-4 py-5 md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:shrink-0 md:border-b-0 md:border-r md:py-6`}
      >
        <div className="hidden px-2 md:block">
          <Logo />
        </div>

        <nav aria-label="Menu principal" className="flex flex-col gap-1">
          <span className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-muted">Consultório</span>
          <ul className="flex flex-col gap-1">
            {ITENS_CONSULTORIO.map((item) => (
              <li key={item.para}>
                <NavLink
                  to={item.para}
                  className={({ isActive }) => `${CLASSE_ITEM} ${isActive ? ITEM_ATIVO : ITEM_INATIVO}`}
                >
                  {item.rotulo}
                  {item.para === '/supervisao' && totalPendentes > 0 ? (
                    <span className="ml-auto rounded-full bg-ocre px-2 py-0.5 text-xs font-bold text-white">
                      {totalPendentes}
                      <span className="sr-only"> {totalPendentes === 1 ? 'pedido novo' : 'pedidos novos'}</span>
                    </span>
                  ) : null}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-3 border-t border-border px-2 pt-4 md:mt-auto">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pine text-[13px] font-semibold text-white"
            >
              {iniciais(nome)}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">{nome}</span>
              <span className="truncate text-xs text-muted">{crp ?? 'Sem CRP cadastrado'}</span>
            </div>
          </div>
          <Link
            to="/perfil"
            className="flex min-h-11 items-center rounded-control px-1 text-[13px] font-semibold text-pine hover:text-pine-dark"
          >
            Meu perfil
          </Link>
          <Link
            to="/planos"
            className="flex min-h-11 items-center rounded-control px-1 text-[13px] font-semibold text-pine hover:text-pine-dark"
          >
            Planos
          </Link>
          <button
            type="button"
            onClick={() => void auth.sair()}
            className="flex min-h-11 items-center rounded-control px-1 text-left text-[13px] font-semibold text-pine hover:text-pine-dark"
          >
            Sair
          </button>
        </div>
      </aside>

      <main
        id="conteudo"
        ref={conteudo}
        tabIndex={-1}
        className="min-w-0 flex-1 px-4 pb-12 pt-6 outline-none sm:px-6 md:px-10 md:pt-8"
      >
        <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
          <Outlet />
        </div>
      </main>
      <ScrollRestoration />
    </div>
  )
}
