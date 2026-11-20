import { useState } from 'react'
import { useStore } from '../store/StoreContext'
import { Icon, Botao, Campo, inputCls } from '../components/ui'
import {
  lerChaveEanImages, salvarChaveEanImages, testarChaveEanImages,
  lerBuscarDadosEanImages, salvarBuscarDadosEanImages,
} from '../lib/eanImages'

function numeroDaConta(conta, nomes) {
  for (const nome of nomes) {
    const valor = conta?.[nome]
    if (typeof valor === 'number') return valor
    if (valor && typeof valor === 'object' && typeof valor.balance === 'number') return valor.balance
  }
  return null
}

function CaixaEanImages({ toast }) {
  const [chave, setChave] = useState(() => lerChaveEanImages())
  const [mostrar, setMostrar] = useState(false)
  const [comDados, setComDados] = useState(() => lerBuscarDadosEanImages())
  const [testando, setTestando] = useState(false)
  const [status, setStatus] = useState(null)
  const salva = lerChaveEanImages()

  const salvar = () => {
    salvarChaveEanImages(chave)
    salvarBuscarDadosEanImages(comDados)
    setStatus(null)
    toast(chave.trim() ? 'Chave da EAN Images salva neste aparelho.' : 'Chave removida.')
  }

  const testar = async () => {
    salvarChaveEanImages(chave)
    setTestando(true)
    setStatus(null)
    try {
      const r = await testarChaveEanImages()
      const saldo = numeroDaConta(r.conta, ['balance', 'credits', 'saldo'])
      const modo = String(chave).startsWith('eani_test_') ? ' (chave de teste: imagens de exemplo, sem custo)' : ''
      setStatus({ ok: true, texto: `Chave válida${modo}.${saldo != null ? ` Saldo: ${saldo} créditos.` : ''}` })
    } catch (erro) {
      setStatus({ ok: false, texto: erro.message })
    } finally {
      setTestando(false)
    }
  }

  return (
    <div className="card-bengala p-5">
      <div className="mb-1 flex items-center gap-2">
        <Icon name="ImageDown" size={18} className="text-bengala" />
        <h2 className="font-bold text-ink">Imagens dos produtos (EAN Images)</h2>
      </div>
      <p className="mb-4 text-sm text-ink-soft">
        Com a chave, cada produto bipado busca a foto e a descrição oficiais pelo código de barras.
      </p>
      <Campo label="Chave da API (começa com eani_live_ ou eani_test_)">
        <div className="flex gap-2">
          <input
            type={mostrar ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            className={`${inputCls} font-mono`}
            placeholder="eani_live_..."
            value={chave}
            onChange={(e) => setChave(e.target.value)}
          />
          <button type="button" onClick={() => setMostrar((v) => !v)} className="shrink-0 rounded-lg border border-ink-soft/20 bg-white px-3 text-sm font-bold text-ink" aria-label={mostrar ? 'Esconder chave' : 'Mostrar chave'}>
            <Icon name={mostrar ? 'EyeOff' : 'Eye'} size={16} />
          </button>
        </div>
      </Campo>
      <label className="mt-3 flex items-center gap-2.5">
        <input type="checkbox" checked={comDados} onChange={(e) => setComDados(e.target.checked)} className="h-4 w-4 accent-bengala" />
        <span className="text-sm font-medium">Buscar também nome e descrição (+1 crédito por produto novo)</span>
      </label>
      {status && (
        <div className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${status.ok ? 'bg-success/10 text-success' : 'bg-critical/10 text-critical'}`}>
          {status.texto}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Botao onClick={salvar}><Icon name="Save" size={16} /> Salvar chave</Botao>
        <Botao variante="contorno" onClick={testar} disabled={testando || !chave.trim()}>
          <Icon name={testando ? 'LoaderCircle' : 'PlugZap'} size={16} className={testando ? 'animate-spin' : ''} /> {testando ? 'Testando…' : 'Testar chave'}
        </Botao>
        {salva && (
          <Botao variante="contorno" onClick={() => { setChave(''); salvarChaveEanImages(''); setStatus(null); toast('Chave removida deste aparelho.') }}>
            Remover
          </Botao>
        )}
      </div>
      <p className="mt-3 text-xs text-ink-soft">
        Custo na EAN Images: 1 crédito pela imagem e 1 pela descrição, só na primeira vez de cada produto. Depois é grátis.
        A chave fica guardada só neste aparelho. Ao hospedar para outros mercados, prefira cadastrá-la no servidor (variável EANIMAGES_API_KEY).
      </p>
    </div>
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
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="card-bengala p-5">
        <div className="mb-4 flex items-center gap-2">
          <Icon name="Store" size={18} className="text-bengala" />
          <h2 className="font-bold text-ink">Informações do estabelecimento</h2>
        </div>
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
      </div>

      <div className="card-bengala p-5">
        <div className="mb-4 flex items-center gap-2">
          <Icon name="BellRing" size={18} className="text-bengala" />
          <h2 className="font-bold text-ink">Alertas e automação</h2>
        </div>
        <div className="space-y-5">
          <div>
            <div className="mb-1 flex justify-between text-sm font-medium"><span>Dias de alerta de validade</span><span className="text-bengala">{f.diasAlerta} dias</span></div>
            <input type="range" min="1" max="30" value={f.diasAlerta} onChange={(e) => setF({ ...f, diasAlerta: Number(e.target.value) })} className="w-full accent-bengala" />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm font-medium"><span>Desconto padrão (ofertas automáticas)</span><span className="text-bengala">{f.descontoPadrao}%</span></div>
            <input type="range" min="5" max="80" step="5" value={f.descontoPadrao} onChange={(e) => setF({ ...f, descontoPadrao: Number(e.target.value) })} className="w-full accent-bengala" />
          </div>
          <label className="flex items-center gap-2.5">
            <input type="checkbox" checked={f.sugestoesAuto} onChange={(e) => setF({ ...f, sugestoesAuto: e.target.checked })} className="h-4 w-4 accent-bengala" />
            <span className="text-sm font-medium">Ativar sugestões automáticas de oferta</span>
          </label>
        </div>
      </div>

      <CaixaEanImages toast={toast} />

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={confirmarReset} className="rounded-lg border border-critical/25 bg-critical/5 px-3 py-2 text-sm font-medium text-critical hover:bg-critical/10">
          <Icon name="TriangleAlert" size={14} className="mr-1 inline" /> Apagar dados locais deste aparelho
        </button>
        <Botao onClick={salvar}><Icon name="Save" size={16} /> Salvar configurações</Botao>
      </div>
    </div>
  )
}
