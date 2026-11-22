import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/StoreContext'
import { Icon, EmptyState, Botao, Campo, Rotulo, inputCls } from '../components/ui'
import CentralArtes from '../components/CentralArtes'
import { percentDesc, dataISOmaisDias } from '../lib/utils'

// Cartazes unitários (A4 a A7) e etiquetas de gôndola, com o selo de cada produto e a
// foto do produto quando ele tem uma. O jornal fica só com as artes de rede social.
export default function Cartazes() {
  const navigate = useNavigate()
  const store = useStore()
  const { produtos, ofertaDoProduto, toast } = store
  const [periodoDe, setPeriodoDe] = useState(() => dataISOmaisDias(0))
  const [periodoAte, setPeriodoAte] = useState(() => dataISOmaisDias(6))

  const precoNovo = (p) => {
    const o = ofertaDoProduto(p.id)
    if (o) return p.precoNormal * (1 - o.desconto / 100)
    return p.precoPromo ?? p.precoNormal
  }

  const itens = useMemo(
    () => produtos
      .filter((p) => p.precoPromo || ofertaDoProduto(p.id) || p.naFila)
      .map((p) => ({ ...p, precoJornal: precoNovo(p), descontoJornal: percentDesc(p.precoNormal, precoNovo(p)) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [produtos, ofertaDoProduto],
  )
  const loja = (store.lojas || []).find((l) => l.id === store.lojaAtiva) || (store.lojas || [])[0]

  if (itens.length === 0) {
    return (
      <EmptyState
        icon="Image"
        titulo="Nenhum produto em oferta"
        descricao="Bipe um produto e coloque na fila do jornal ou numa oferta para criar o cartaz."
        acao={
          <div className="flex flex-wrap justify-center gap-2">
            <Botao onClick={() => navigate('/scanner')}><Icon name="ScanLine" size={16} /> Escanear produto</Botao>
            <Botao variante="contorno" onClick={() => navigate('/ofertas')}><Icon name="Tag" size={16} /> Ver ofertas</Botao>
          </div>
        }
      />
    )
  }

  return (
    <CentralArtes
      saidas={['cartaz', 'etiqueta']}
      saidaInicial="cartaz"
      subtitulo="O selo de cada produto é o escolhido no jornal, e a foto entra quando o produto tem uma."
      itens={itens}
      titulo="Cartazes de oferta"
      encarte={{ periodoDe, periodoAte: periodoAte >= periodoDe ? periodoAte : periodoDe }}
      loja={loja}
      toast={toast}
      onBipar={() => navigate('/scanner')}
      ajustes={(
        <>
          <Rotulo>Oferta válida</Rotulo>
          <div className="grid max-w-md grid-cols-2 gap-2">
            <Campo label="De"><input type="date" className={inputCls} value={periodoDe} onChange={(e) => setPeriodoDe(e.target.value)} /></Campo>
            <Campo label="Até"><input type="date" className={inputCls} value={periodoAte} min={periodoDe} onChange={(e) => setPeriodoAte(e.target.value)} /></Campo>
          </div>
        </>
      )}
    />
  )
}
