// CSV no formato que o Excel brasileiro abre direto: ponto e vírgula, vírgula decimal e BOM.

type Celula = string | number | null | undefined

function celula(valor: Celula): string {
  if (valor === null || valor === undefined) return ''
  const texto = typeof valor === 'number' ? valor.toFixed(2).replace('.', ',') : String(valor)
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

export function montarCsv(cabecalho: string[], linhas: Celula[][]): string {
  return '﻿' + [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n')
}

export function baixarCsv(nomeArquivo: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
