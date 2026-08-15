import { useState } from 'react'
import { useStore } from '../store/StoreContext'
import { Icon, Botao, Campo, inputCls } from '../components/ui'

export default function Config() {
  const { config, salvarConfig, resetar, toast } = useStore()
  const [f, setF] = useState({ ...config })

  const salvar = () => {
    salvarConfig(f)
    toast('Configurações salvas!')
  }

  const selecionarLogo = (arquivo) => {
    if (!arquivo) return
    if (!arquivo.type.startsWith('image/') || arquivo.size > 2 * 1024 * 1024) {
      toast('Use uma imagem PNG, JPG, WEBP ou SVG de até 2 MB.', 'erro')
      return
    }
    const leitor = new FileReader()
    leitor.onload = () => setF((atual) => ({ ...atual, logoDataUrl: String(leitor.result || '') }))
    leitor.onerror = () => toast('Não foi possível ler o logotipo.', 'erro')
    leitor.readAsDataURL(arquivo)
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
          <div className="sm:col-span-2"><Campo label="Slogan"><input className={inputCls} value={f.slogan || ''} onChange={(e) => setF({ ...f, slogan: e.target.value })} placeholder="Preço baixo. Desperdício zero." /></Campo></div>
          <div className="sm:col-span-2">
            <Campo label="Logotipo do estabelecimento">
              <div className="flex items-center gap-3 rounded-xl border border-ink-soft/15 bg-cream/40 p-3">
                <div className="flex h-16 w-24 items-center justify-center rounded-lg bg-white p-2 shadow-sm">
                  {f.logoDataUrl ? <img src={f.logoDataUrl} alt="Prévia do logotipo" className="max-h-full max-w-full object-contain" /> : <Icon name="Store" size={28} className="text-ink-soft" />}
                </div>
                <div className="min-w-0 flex-1">
                  <input id="logo-estabelecimento" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => selecionarLogo(e.target.files?.[0])} />
                  <label htmlFor="logo-estabelecimento" className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-bengala px-3 py-2 text-sm font-bold text-white">
                    <Icon name="Upload" size={15} /> Escolher logotipo
                  </label>
                  {f.logoDataUrl && <button type="button" onClick={() => setF({ ...f, logoDataUrl: '' })} className="ml-2 text-xs font-bold text-critical">Remover</button>}
                  <p className="mt-1 text-xs text-ink-soft">Prefira PNG ou SVG com fundo transparente.</p>
                </div>
              </div>
            </Campo>
          </div>
          <div className="sm:col-span-2">
            <span className="mb-2 block text-sm font-medium text-ink">Cores da marca</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['corPrimaria', 'Principal', '#e4232e'],
                ['corSecundaria', 'Apoio', '#082b4f'],
                ['corDestaque', 'Destaque', '#ffc928'],
              ].map(([campo, label, padrao]) => (
                <label key={campo} className="rounded-lg border border-ink-soft/15 bg-white p-2 text-xs font-medium text-ink-soft">
                  {label}
                  <input type="color" value={f[campo] || padrao} onChange={(e) => setF({ ...f, [campo]: e.target.value })} className="mt-1 h-10 w-full cursor-pointer rounded border-0 bg-transparent p-0" />
                </label>
              ))}
            </div>
          </div>
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

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={confirmarReset} className="rounded-lg border border-critical/25 bg-critical/5 px-3 py-2 text-sm font-medium text-critical hover:bg-critical/10">
          <Icon name="TriangleAlert" size={14} className="mr-1 inline" /> Apagar dados locais deste aparelho
        </button>
        <Botao onClick={salvar}><Icon name="Save" size={16} /> Salvar configurações</Botao>
      </div>
    </div>
  )
}
