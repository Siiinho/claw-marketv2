// Ajuste de cada parte do cartaz (como no editor do jornal): x e y em fração do cartaz, s = tamanho.
// Fica em `produto.ajusteCartaz` = { topo, nome, foto, preco }.
export const CAMADAS_CARTAZ = [['topo', 'Topo', 'Megaphone'], ['nome', 'Nome', 'Type'], ['foto', 'Foto', 'Image'], ['preco', 'Preço', 'BadgeDollarSign']]
// Textos ficam por cima do fundo do preço quando uma parte cresce sobre a outra.
const CAMADA_Z = { foto: 1, preco: 2, nome: 3, topo: 4 }
const AJUSTE_NEUTRO = { x: 0, y: 0, s: 1 }
export const ajusteCartazDe = (produto, camada) => ({ ...AJUSTE_NEUTRO, ...(produto?.ajusteCartaz?.[camada] || {}) })
export function CamadaCartaz({ nome, produto, w, h, style, children }) {
  const a = ajusteCartazDe(produto, nome)
  const mexido = a.x || a.y || a.s !== 1
  return (
    <div data-camada={nome} style={{ position: 'relative', zIndex: CAMADA_Z[nome], ...style, ...(mexido ? { transform: `translate(${a.x * w}px, ${a.y * h}px) scale(${a.s})`, transformOrigin: 'center' } : {}) }}>
      {children}
    </div>
  )
}

