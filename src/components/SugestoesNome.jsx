import { normalizarBusca } from '../lib/catalogoBengala'
import { formatBRL, setorById } from '../lib/utils'
import { Icon, ProdutoThumb } from './ui'

// Lista da busca pelo nome. `carregando` é o código do item escolhido: a lista continua na tela,
// com o item girando, até o produto abrir.
export default function SugestoesNome({ codigo, busca, onEscolher, carregando = null }) {
  const { sugestoes, procurandoNome, destaque, setDestaque } = busca
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-ink-soft/15 bg-white">
      {procurandoNome && !sugestoes.length ? (
        <p className="flex items-center gap-2 px-3 py-3 text-sm text-ink-soft"><Icon name="LoaderCircle" size={16} className="animate-spin" /> Procurando na base de produtos...</p>
      ) : !sugestoes.length ? (
        <p className="px-3 py-3 text-sm text-ink-soft">{normalizarBusca(codigo).length < 2 ? 'Continue digitando o nome.' : 'Nenhum produto com esse nome. Tente outra palavra, a marca ou o código de barras.'}</p>
      ) : (
        <ul id="sugestoes-nome" role="listbox" aria-label="Produtos encontrados pelo nome" className="max-h-80 divide-y divide-ink-soft/10 overflow-y-auto">
          {sugestoes.map((item, i) => {
            const girando = carregando !== null && carregando === item.codigoBarras
            return (
              <li key={`${item.origem}-${item.codigoBarras || item.nome}`} id={`sugestao-${i}`} role="option" aria-selected={i === destaque}>
                <button type="button" onClick={() => onEscolher(item)} disabled={carregando !== null} onMouseMove={() => i !== destaque && setDestaque(i)}
                  className={`flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left ${i === destaque ? 'bg-cream-200' : 'bg-white'} ${carregando !== null && !girando ? 'opacity-50' : ''}`}>
                  {item.produto ? <ProdutoThumb produto={item.produto} size={34} /> : <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-cream-200 text-ink-soft"><Icon name="Package" size={17} /></span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">{item.nome}</span>
                    <span className="block truncate text-xs text-ink-soft">
                      {[item.origem === 'cadastrado' ? (item.produto?.naFila ? 'Já na fila' : 'Cadastrado no app') : item.origem === 'loja' ? 'Mercadologia da loja' : 'Base de produtos (sem preço)', item.setor && setorById(item.setor)?.nome, item.codigoBarras].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {Number(item.precoNormal) > 0 && <span className="num-tab shrink-0 text-sm font-bold text-ink">{formatBRL(Number(item.precoNormal))}</span>}
                  <Icon name={girando ? 'LoaderCircle' : 'Plus'} size={17} className={`shrink-0 text-navy ${girando ? 'animate-spin' : ''}`} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
