import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { carregarEncartePublicado, assinarEncarte } from '../lib/encartePublico'
import { MarcaContexto, ehBengala, linkWhatsapp, BENGALA_PADRAO } from '../lib/marca'
import logoBengala from '../assets/logo-bengala-transparente.png'

// Página pública do QR de ofertas: o cliente escolhe a loja e entra no grupo/comunidade de WhatsApp dela.
// Vem do cadastro do mercado (publicado junto com o jornal). Sem cadastro, vale o Bengala.

const HEX = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='98' viewBox='0 0 56 98'%3E%3Cpath d='M28 66L0 50V16L28 0l28 16v34L28 66zm0 32L0 82V66l28 16 28-16v16L28 98z' fill='none' stroke='%2396ff5a' stroke-opacity='.28' stroke-width='2'/%3E%3C/svg%3E")`

function Balao({ marca }) {
  const src = marca?.logo || (ehBengala(marca) ? logoBengala : null)
  return (
    <div className="relative mx-auto h-44 w-44 sm:h-52 sm:w-52">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white to-[#c9c9c9] shadow-[0_12px_30px_rgba(0,0,0,.45)]" />
      <div className="absolute bottom-1 left-2 h-12 w-12 rotate-[20deg] bg-[#d9d9d9] [clip-path:polygon(0_100%,30%_0,100%_45%)]" />
      <div className="absolute inset-[12px] flex items-center justify-center rounded-full bg-gradient-to-br from-[#38d14a] to-[#0f9a2b] p-5 shadow-[inset_0_4px_10px_rgba(0,0,0,.3)]">
        {src
          ? <img src={src} alt={marca?.nome || 'Bengala Supermercado'} className="max-h-full max-w-full object-contain drop-shadow-[0_3px_4px_rgba(0,0,0,.35)]" />
          : <span className="text-center text-2xl font-black uppercase leading-none text-white drop-shadow">{marca?.nome}</span>}
      </div>
    </div>
  )
}

export default function WhatsappOfertas() {
  const [encarte, setEncarte] = useState(null)
  const [carregou, setCarregou] = useState(false)
  useEffect(() => {
    let ativo = true
    const carregar = async () => {
      const novo = await carregarEncartePublicado().catch(() => null)
      if (!ativo) return
      setCarregou(true)
      if (novo) setEncarte(novo)
    }
    carregar()
    const parar = assinarEncarte(carregar)
    return () => { ativo = false; parar() }
  }, [])

  const marca = encarte?.marca || null
  const base = marca || BENGALA_PADRAO
  const lojas = (base.lojas || []).filter((l) => l.linkGrupo || l.whatsapp)
  const geral = linkWhatsapp(base.whatsappOfertas, 'Olá, desejo receber ofertas!')
  const temJornal = encarte?.itens?.length > 0

  return (
    <MarcaContexto.Provider value={marca}>
      <div className="flex min-h-[100dvh] flex-col text-[#222]" style={{ background: `${HEX}, radial-gradient(circle at 50% 30%, #2bd43b 0%, #0d8a1f 45%, #04390c 100%)`, fontFamily: '"Archivo Narrow", "Arial Narrow", Arial, sans-serif' }}>
        <main className="mx-auto w-full max-w-[560px] flex-1 px-4 pb-8 pt-8 sm:pt-12">
          <Balao marca={marca} />

          <div className="relative mt-[-18px] rounded-md border-[3px] border-[#222] bg-[#f4f4f4] shadow-[10px_10px_0_#222]">
            <div className="flex items-center gap-1.5 border-b-[3px] border-[#222] px-3 py-2" aria-hidden="true">
              {['×', '+', '−'].map((s) => <span key={s} className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#222] text-[12px] font-black leading-none">{s}</span>)}
            </div>
            <div className="px-4 pb-5 pt-3 text-center">
              <p className="text-[clamp(26px,7vw,40px)] font-black uppercase leading-none">Receba nossas</p>
              <p className="text-[clamp(64px,19vw,110px)] font-black uppercase leading-[.9] tracking-tight text-[#ee2b34]">Ofertas</p>
              <p className="mt-1 text-[clamp(16px,4.6vw,24px)] font-black uppercase">Diretamente no seu WhatsApp!!!</p>
            </div>
          </div>

          <p className="mx-auto mt-8 w-fit rounded-md border-2 border-[#222] bg-[#f4f4f4] px-3 py-1 text-center text-[clamp(15px,4.3vw,22px)] font-black uppercase underline underline-offset-4">
            {lojas.length > 1 ? 'Selecione a loja de sua preferência abaixo:' : 'Toque no botão abaixo:'}
          </p>

          <div className={`mt-5 grid gap-4 ${lojas.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {lojas.map((l, i) => {
              const href = l.linkGrupo || linkWhatsapp(l.whatsapp, 'Olá, desejo receber ofertas!')
              return (
                <a key={`${l.nome}-${i}`} href={href} target="_blank" rel="noopener noreferrer"
                  className="flex min-h-[88px] flex-col items-center justify-center rounded-xl border-[3px] border-[#222] bg-[#f4f4f4] px-2 py-2 text-center shadow-[6px_6px_0_#222] transition-transform active:translate-x-1 active:translate-y-1 active:shadow-[2px_2px_0_#222]">
                  <span className="text-[clamp(17px,4.8vw,24px)] font-black uppercase leading-tight underline underline-offset-2">{l.nome || base.nome}</span>
                  {l.cidade && <span className="text-[clamp(15px,4.3vw,22px)] font-bold uppercase leading-tight">{l.cidade}</span>}
                </a>
              )
            })}
            {!lojas.length && geral && (
              <a href={geral} target="_blank" rel="noopener noreferrer" className="flex min-h-[88px] items-center justify-center rounded-xl border-[3px] border-[#222] bg-[#f4f4f4] text-[24px] font-black uppercase shadow-[6px_6px_0_#222]">Quero receber</a>
            )}
          </div>

          {temJornal && (
            <Link to="/folhear" className="mt-8 flex min-h-14 items-center justify-center gap-2 rounded-xl border-[3px] border-[#222] bg-[#ffd23f] px-4 text-[clamp(18px,5vw,24px)] font-black uppercase shadow-[6px_6px_0_#222]">
              Ver o jornal de ofertas de hoje
            </Link>
          )}
          {!carregou && <p className="mt-6 text-center font-bold text-white/80">Carregando…</p>}
        </main>
        <footer className="bg-[#111] px-4 py-2 text-center text-[13px] text-white/75">
          {base.nome} · Ofertas válidas enquanto durarem os estoques
        </footer>
      </div>
    </MarcaContexto.Provider>
  )
}
