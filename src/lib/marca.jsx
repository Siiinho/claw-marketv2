import { createContext, useContext } from 'react'

// Cadastro do mercado: logo, lojas, WhatsApp, redes, formas de pagamento e como é o encarte.
// Fica em config.mercado (no app) e vai junto com o encarte publicado (encarte.marca), para o
// site do cliente mostrar a marca certa. Sem cadastro, vale o Bengala (cliente piloto).

export const PAGAMENTOS = {
  credito: ['Visa', 'Mastercard', 'Elo', 'Hipercard', 'American Express', 'Cabal', 'Sorocred', 'Mais!'],
  alimentacao: ['Alelo', 'Ben', 'Good Card', 'Ticket', 'Up', 'VR', 'Pluxee (Sodexo)', 'VeroCard'],
  outros: ['Pix', 'Dinheiro'],
}

export const CAMPOS_LOJA = ['nome', 'endereco', 'cidade', 'whatsapp', 'telefone', 'estacionamento', 'horario', 'horario2', 'linkGrupo', 'foraDoRodape']

// Página pública do QR de ofertas (o cliente escolhe a loja e entra no grupo dela).
export const paginaWhatsapp = () => (typeof window === 'undefined' ? '' : `${window.location.origin}${import.meta.env.BASE_URL}#/whatsapp`)
export const lojaVazia = () => ({ id: `loja-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, nome: '', endereco: '', cidade: '', whatsapp: '', telefone: '', estacionamento: false, horario: '', horario2: '', linkGrupo: '', foraDoRodape: false })

// Rodapé já validado do jornal impresso do Bengala: é a base do modelo, e o Bengala começa com ele preenchido.
export const BENGALA_PADRAO = {
  nome: 'Bengala Supermercado',
  whatsappOfertas: '(11) 96607-2187',
  redesLink: 'https://linktr.ee/bengalasupermercado',
  whatsLink: 'https://comunidadedeofertasbengala.my.canva.site/lojas',
  whatsTitulo: 'WhatsApp Bengala',
  lojas: [
    { nome: 'Loja 2', endereco: 'Avenida Líder, nº 1721', cidade: 'Cidade Líder', telefone: '2741-1233', estacionamento: true, whatsapp: '(11) 93349-6381', horario: 'De segunda a sábado das 07h00 às 21h00', horario2: 'Aos domingos e feriados das 08h00 às 14h00', linkGrupo: 'https://wpp.community/2BwwyU' },
    { nome: 'Loja 3', endereco: 'Rua Serra do Navio, nº 355', cidade: 'Pq. Santa Madalena', telefone: '2719-7195', estacionamento: true, whatsapp: '(11) 96607-2187', horario: 'De segunda a sábado das 07h00 às 20h00', horario2: 'Aos domingos e feriados das 08h00 às 14h00', linkGrupo: 'https://chat.whatsapp.com/Gloihy9DIV2DooIyn29Id1' },
    { nome: 'Loja 5', cidade: 'Jardim Tango', linkGrupo: 'https://wpp.community/uF5UNH', foraDoRodape: true },
    { nome: 'Loja 6', endereco: 'Rua Comendador Gil Pinheiro, 137', cidade: 'Chác. Calif. - SP', telefone: '(11) 2093-0017', estacionamento: true, whatsapp: '(11) 97077-7406', horario: 'De segunda a sábado das 07h00 às 21h00', horario2: 'Aos domingos e feriados das 08h00 às 20h00', linkGrupo: 'https://chat.whatsapp.com/L6cOrM3Eifw1bjnpLE8PkC' },
  ],
  pagamentos: {
    credito: ['Visa', 'Mastercard', 'Elo', 'American Express', 'Mais!', 'Sorocred', 'Hipercard', 'Cabal'],
    alimentacao: ['Alelo', 'Ben', 'Pluxee (Sodexo)', 'Good Card', 'Ticket', 'VR', 'Up', 'VeroCard'],
    outros: [],
  },
}

// Campos que podem sair para o site do cliente (nada de dados internos).
export const CAMPOS_TEXTO = ['nome', 'whatsappOfertas', 'instagram', 'facebook', 'avisos', 'rodapeModo', 'encarteModo', 'redesLink', 'whatsLink', 'whatsTitulo', 'whatsSubtitulo', 'avisoLimite', 'avisoValidade', 'legal']
const CAMPOS = [...CAMPOS_TEXTO, 'logo', 'rodapeImagem']
export function marcaPublica(mercado) {
  if (!mercado || !mercado.nome) return null
  const m = {}
  for (const c of CAMPOS) if (mercado[c]) m[c] = mercado[c]
  m.lojas = (mercado.lojas || []).filter((l) => l.nome || l.endereco).map((l) => Object.fromEntries(CAMPOS_LOJA.map((c) => [c, l[c]])))
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
