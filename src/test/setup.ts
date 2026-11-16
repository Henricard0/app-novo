import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
})

// O jsdom ainda não implementa showModal/close do <dialog>.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}

// O aviso de guias e pendências do contador aparece no menu de todas as telas.
// Nos testes, começa sem avisos (testes do contador trocam por vi.mocked).
vi.mock('@/lib/contador/api', async (original) => {
  const real = await original<typeof import('@/lib/contador/api')>()
  return { ...real, contarAvisosDoContador: vi.fn().mockResolvedValue({ dados: 0, erro: null }) }
})
