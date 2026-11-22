import { useEffect, useState } from 'react'
import { useStore } from '../store/StoreContext'
import { Icon, StatusBadge, ProdutoThumb, Botao, Modal, Campo, inputCls, Escolha } from './ui'
import { formatBRL, plural, regraDaMarca } from '../lib/utils'

// Troca com fornecedor ou perda (descarte) de um produto vencido ou perto de vencer.
// `pedido` = { produto, tipo } abre o modal; null fecha. Usado em Produtos e Relatórios.
export default function ModalBaixa({ pedido, onClose }) {
  const { config, darBaixaProduto, toast } = useStore()
  const [baixa, setBaixa] = useState(null)

  useEffect(() => {
    if (!pedido) { setBaixa(null); return }
    const sugestao = regraDaMarca(config, pedido.produto.marca)
    setBaixa({
      produto: pedido.produto,
      tipo: pedido.tipo || sugestao || 'perda',
      quantidade: Math.max(1, Number(pedido.produto.estoque) || 1),
      motivo: '',
    })
  }, [pedido, config])

  const sugestao = baixa ? regraDaMarca(config, baixa.produto.marca) : null
  const confirmar = () => {
    const qtd = Math.round(Number(baixa.quantidade) || 0)
    if (qtd < 1) return toast('Informe quantas unidades saem.', 'erro')
    darBaixaProduto(baixa.produto.id, { tipo: baixa.tipo, quantidade: qtd, motivo: baixa.motivo })
    toast(baixa.tipo === 'troca'
      ? `Troca registrada: ${plural(qtd, 'unidade', 'unidades')} de ${baixa.produto.nome}.`
      : `Perda registrada: ${plural(qtd, 'unidade', 'unidades')} de ${baixa.produto.nome}. Já conta nos relatórios.`)
    onClose()
  }

  return (
    <Modal
      open={!!baixa}
      onClose={onClose}
      titulo={baixa?.tipo === 'troca' ? 'Trocar no fornecedor' : 'Descartar como perda'}
      footer={baixa && (
        <>
          <Botao variante="contorno" onClick={onClose}>Cancelar</Botao>
          <Botao variante={baixa.tipo === 'perda' ? 'perigo' : 'escuro'} onClick={confirmar}>
            <Icon name={baixa.tipo === 'perda' ? 'PackageX' : 'Repeat'} size={16} />
            {baixa.tipo === 'perda' ? 'Registrar perda' : 'Registrar troca'}
          </Botao>
        </>
      )}
    >
      {baixa && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ProdutoThumb produto={baixa.produto} size={52} />
            <div className="min-w-0">
              <div className="font-semibold text-ink">{baixa.produto.nome}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge validade={baixa.produto.validade} />
                <span className="num-tab text-xs text-ink-soft">estoque {baixa.produto.estoque ?? 0} un · {formatBRL(baixa.produto.precoNormal)} cada</span>
              </div>
            </div>
          </div>
          {sugestao && (
            <p className="flex items-center gap-2 rounded-lg bg-cream-200 px-3 py-2 text-sm text-ink">
              <Icon name="BadgeCheck" size={16} className="shrink-0 text-navy" />
              <span>A marca <strong>{baixa.produto.marca}</strong> está cadastrada como <strong>{sugestao === 'troca' ? 'aceita troca' : 'sempre perda'}</strong>.</span>
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Escolha
              ativo={baixa.tipo === 'troca'}
              onClick={() => setBaixa({ ...baixa, tipo: 'troca' })}
              icone="Repeat"
              iconeCor="var(--color-info)"
              titulo="Troca com fornecedor"
              descricao="Ele recolhe ou troca. Não conta como perda."
            />
            <Escolha
              ativo={baixa.tipo === 'perda'}
              onClick={() => setBaixa({ ...baixa, tipo: 'perda' })}
              icone="PackageX"
              iconeCor="var(--color-critical)"
              titulo="Perda (descarte)"
              descricao="Vai para o lixo e entra nos relatórios de perda."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Quantas unidades saem" obrigatorio>
              <input type="number" min="1" inputMode="numeric" className={inputCls} value={baixa.quantidade} onChange={(e) => setBaixa({ ...baixa, quantidade: e.target.value })} />
            </Campo>
            <div className="flex flex-col justify-end pb-1">
              <span className="text-sm text-ink-soft">{baixa.tipo === 'perda' ? 'Valor perdido' : 'Valor devolvido'}</span>
              <span className={`num-tab text-lg font-bold ${baixa.tipo === 'perda' ? 'text-critical' : 'text-[#1f5c99]'}`}>
                {formatBRL(Math.round(Number(baixa.quantidade) || 0) * (Number(baixa.produto.precoNormal) || 0))}
              </span>
            </div>
          </div>
          <Campo label="Observação">
            <input
              className={inputCls}
              value={baixa.motivo}
              onChange={(e) => setBaixa({ ...baixa, motivo: e.target.value })}
              placeholder={baixa.tipo === 'troca' ? 'Ex.: fornecedor e número da troca' : 'Ex.: embalagem estufada'}
            />
          </Campo>
          {Number(baixa.quantidade) >= (Number(baixa.produto.estoque) || 0) && (
            <p className="text-sm text-ink-soft">O estoque deste lote zera e o produto sai da lista de vencidos e da fila do jornal.</p>
          )}
        </div>
      )}
    </Modal>
  )
}
