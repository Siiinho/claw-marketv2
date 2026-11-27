import { createContext, useContext } from 'react'

// Cadastro do mercado: logo, lojas, WhatsApp, redes, formas de pagamento e como é o encarte.
// Fica em config.mercado (no app) e vai junto com o encarte publicado (encarte.marca), para o
// site do cliente mostrar a marca certa. Sem cadastro, vale o Bengala (cliente piloto).

export const PAGAMENTOS = {
  credito: ['Visa', 'Mastercard', 'Elo', 'Hipercard', 'American Express', 'Cabal', 'Sorocred', 'Mais!'],
  alimentacao: ['Alelo', 'Ben', 'Good Card', 'Ticket', 'Up', 'VR', 'Pluxee (Sodexo)', 'VeroCard'],
  outros: ['Pix', 'Dinheiro'],
}

export const lojaVazia = () => ({ id: `loja-${Date.now().toString(36)}`, nome: '', endereco: '', cidade: '', whatsapp: '', telefone: '', horario: '' })

// Campos que podem sair para o site do cliente (nada de dados internos).
const CAMPOS = ['nome', 'logo', 'whatsappOfertas', 'instagram', 'facebook', 'avisos', 'rodapeModo', 'rodapeImagem', 'encarteModo']
export function marcaPublica(mercado) {
  if (!mercado || !mercado.nome) return null
  const m = {}
  for (const c of CAMPOS) if (mercado[c]) m[c] = mercado[c]
  m.lojas = (mercado.lojas || []).filter((l) => l.nome || l.endereco).map(({ nome, endereco, cidade, whatsapp, telefone, horario }) => ({ nome, endereco, cidade, whatsapp, telefone, horario }))
  m.pagamentos = {
    credito: (mercado.pagamentos?.credito || []).filter((x) => PAGAMENTOS.credito.includes(x)),
    alimentacao: (mercado.pagamentos?.alimentacao || []).filter((x) => PAGAMENTOS.alimentacao.includes(x)),
    outros: (mercado.pagamentos?.outros || []).filter((x) => PAGAMENTOS.outros.includes(x)),
  }
  return m
}

// Sem cadastro (ou cadastro do próprio Bengala) vale a arte oficial do Bengala; outro mercado sem logo mostra o nome.
export const ehBengala = (marca) => !marca || /bengala/i.test(marca.nome || '')
export function LogoOuNome({ marca, padrao, className = '', style, nomeClassName = '' }) {
  const src = marca?.logo || (ehBengala(marca) ? padrao : null)
  if (src) return <img src={src} alt={marca?.nome || 'Bengala Supermercado'} className={className} style={style} />
  return <span className={`inline-flex items-center font-black uppercase leading-none ${nomeClassName}`} style={style}>{marca.nome}</span>
}

export const MarcaContexto = createContext(null)
export const useMarca = () => useContext(MarcaContexto)
export const soDigitos = (v) => String(v || '').replace(/\D/g, '')
export const linkWhatsapp = (numero, texto = 'Olá! Vi o jornal de ofertas e quero saber mais.') => {
  const n = soDigitos(numero)
  return n ? `https://wa.me/${n.length <= 11 ? `55${n}` : n}?text=${encodeURIComponent(texto)}` : null
}
