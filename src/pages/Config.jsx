import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/StoreContext'
import { Icon, Botao, Campo, inputCls, Secao, Rotulo } from '../components/ui'
import { codigosComFotoDaLoja } from '../lib/catalogoBengala'
import { enviarFotosCatalogoNuvem, nuvemAtiva } from '../lib/nuvem'

// Sobe para a nuvem as fotos da pasta do PC (A:\imagens) dos produtos da mercadologia.
// Só aparece no PC da loja, que é quem enxerga a pasta pelo /api/imagens-produtos.
function FotosNaNuvem({ toast }) {
  const [pastaNoPC, setPastaNoPC] = useState(false)
  const [progresso, setProgresso] = useState(null)
  const [rodando, setRodando] = useState(false)
  const sinal = useRef({})
  useEffect(() => {
    fetch('/api/imagens-produtos?status=1', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPastaNoPC(Boolean(d?.ativo)))
      .catch(() => setPastaNoPC(false))
    return () => { sinal.current.parar = true }
  }, [])
  if (!pastaNoPC || !nuvemAtiva()) return null
  const enviar = async () => {
    setRodando(true)
    sinal.current = {}
    try {
      const codigos = await codigosComFotoDaLoja()
      const fim = await enviarFotosCatalogoNuvem(codigos, setProgresso, sinal.current)
      toast(`Fotos na nuvem: ${fim.enviados} enviadas agora, ${fim.jaNaNuvem} já estavam lá, ${fim.semFoto} sem foto na pasta.`)
    } catch (erro) {
      toast(erro.message || 'Não foi possível enviar as fotos.', 'erro')
    } finally {
      setRodando(false)
    }
  }
  const pct = progresso?.total ? Math.round((progresso.feitos / progresso.total) * 100) : 0
  return (
    <Secao className="lg:col-span-2" titulo="Fotos dos produtos na nuvem" descricao="Envia as fotos da pasta de imagens deste PC para a nuvem. Depois disso, a foto aparece ao bipar pelo celular e no encarte publicado. Só envia as que ainda não estão lá.">
      {progresso ? (
        <div className="mb-3">
          <div className="h-3 overflow-hidden rounded-full bg-cream-200"><div className="h-full bg-navy transition-[width] duration-300" style={{ width: `${pct}%` }} /></div>
          <div className="mt-1 text-xs text-ink-soft">{progresso.feitos} de {progresso.total} · {progresso.enviados} enviadas · {progresso.jaNaNuvem} já estavam · {progresso.semFoto} sem foto na pasta</div>
        </div>
      ) : null}
      {rodando
        ? <Botao variante="contorno" onClick={() => { sinal.current.parar = true }}><Icon name="Square" size={15} /> Parar</Botao>
        : <Botao variante="escuro" onClick={enviar}><Icon name="CloudUpload" size={16} /> Enviar fotos da mercadologia</Botao>}
    </Secao>
  )
}
export default function Config() {
  const { config, salvarConfig, resetar, toast } = useStore()
  const [f, setF] = useState({ ...config })

  const salvar = () => {
    salvarConfig(f)
    toast('Configurações salvas!')
  }

  const confirmarReset = () => {
    const confirmacao = window.prompt('Zona de perigo. Digite RESTAURAR para apagar os dados locais deste aparelho.')
    if (confirmacao !== 'RESTAURAR') {
      if (confirmacao !== null) toast('Restauração cancelada: confirmação incorreta.', 'info')
      return
    }
    resetar()
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Secao titulo="Estabelecimento" descricao="Nome e link que aparecem no encarte e nas artes.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Nome do mercado"><input className={inputCls} value={f.nomeMercado} onChange={(e) => setF({ ...f, nomeMercado: e.target.value })} /></Campo>
            <Campo label="Moeda">
              <select className={inputCls} value={f.moeda} onChange={(e) => setF({ ...f, moeda: e.target.value })}>
                <option value="BRL">Real (BRL)</option>
                <option value="USD">Dólar (USD)</option>
              </select>
            </Campo>
            <div className="sm:col-span-2"><Campo label="Link do jornal oficial"><input className={inputCls} value={f.jornalUrl} onChange={(e) => setF({ ...f, jornalUrl: e.target.value })} /></Campo></div>
          </div>
        </Secao>

        <Secao titulo="Alertas e automação" descricao="Quando avisar sobre vencimento e quanto de desconto sugerir.">
          <div className="space-y-5">
            <div>
              <Rotulo acao={<span className="num-tab text-sm font-semibold text-navy">{f.diasAlerta} dias</span>}>Avisar quando faltar</Rotulo>
              <input type="range" min="1" max="30" value={f.diasAlerta} onChange={(e) => setF({ ...f, diasAlerta: Number(e.target.value) })} className="w-full accent-navy" aria-label="Dias de alerta de validade" />
            </div>
            <div>
              <Rotulo acao={<span className="num-tab text-sm font-semibold text-navy">{f.descontoPadrao}%</span>}>Desconto padrão das ofertas automáticas</Rotulo>
              <input type="range" min="5" max="80" step="5" value={f.descontoPadrao} onChange={(e) => setF({ ...f, descontoPadrao: Number(e.target.value) })} className="w-full accent-navy" aria-label="Desconto padrão" />
            </div>
            <label className="flex items-center gap-2.5">
              <input type="checkbox" checked={f.sugestoesAuto} onChange={(e) => setF({ ...f, sugestoesAuto: e.target.checked })} className="h-5 w-5 accent-navy" />
              <span className="text-sm font-medium text-ink">Sugerir ofertas automaticamente</span>
            </label>
          </div>
        </Secao>

        <FotosNaNuvem toast={toast} />
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-ink-soft/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={confirmarReset} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-critical hover:bg-critical/10">
          <Icon name="TriangleAlert" size={15} /> Apagar dados locais deste aparelho
        </button>
        <Botao onClick={salvar}><Icon name="Save" size={16} /> Salvar configurações</Botao>
      </div>
    </div>
  )
}
