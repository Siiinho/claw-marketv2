import { useState } from 'react'
import { useStore } from '../store/StoreContext'
import { Icon, Botao, Campo, inputCls, Secao, Escolha } from '../components/ui'
import { arquivoParaDataURL } from '../lib/utils'
import { LOJAS } from '../data/seed'
import { PAGAMENTOS, lojaVazia, marcaPublica, MarcaContexto, ehBengala } from '../lib/marca'
import logoBengala from '../assets/logo.png'
import { RodapeOficial } from '../components/PaginaTemplate'

// Logo com fundo transparente: reduz mantendo PNG (o JPEG pintaria o fundo de branco).
function logoParaDataURL(file, max = 640) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const escala = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(img.width * escala))
        c.height = Math.max(1, Math.round(img.height * escala))
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        resolve(c.toDataURL('image/png'))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

const inicial = (config) => {
  const m = config?.mercado || {}
  return {
    nome: m.nome || config?.nomeMercado || '',
    logo: m.logo || '',
    lojas: m.lojas?.length ? m.lojas : LOJAS.map((l) => ({ ...lojaVazia(), ...l, id: l.id })),
    whatsappOfertas: m.whatsappOfertas || LOJAS[0]?.whatsapp || '',
    instagram: m.instagram || '',
    facebook: m.facebook || '',
    avisos: m.avisos || '',
    pagamentos: { credito: [], alimentacao: [], outros: ['Pix', 'Dinheiro'], ...(m.pagamentos || {}) },
    // o Bengala já tem a faixa oficial do jornal impresso; mercado novo começa com a montada
    rodapeModo: m.rodapeModo || (/bengala/i.test(m.nome || config?.nomeMercado || '') ? 'imagem' : 'gerado'),
    rodapeImagem: m.rodapeImagem || '',
    encarteModo: m.encarteModo || 'nosso',
    encarteProprio: { fotos: [], observacao: '', ...(m.encarteProprio || {}) },
  }
}

function Marcar({ grupo, f, setF }) {
  const marcados = f.pagamentos[grupo] || []
  const trocar = (x) => setF({ ...f, pagamentos: { ...f.pagamentos, [grupo]: marcados.includes(x) ? marcados.filter((y) => y !== x) : [...marcados, x] } })
  return (
    <div className="flex flex-wrap gap-1.5">
      {PAGAMENTOS[grupo].map((x) => {
        const ativo = marcados.includes(x)
        return (
          <button key={x} type="button" onClick={() => trocar(x)} aria-pressed={ativo}
            className={`min-h-11 rounded-lg border-2 px-3 text-sm font-bold ${ativo ? 'border-navy bg-navy text-white' : 'border-navy/30 bg-white text-navy hover:border-navy'}`}>
            {ativo && <Icon name="Check" size={14} className="mr-1 inline" />}{x}
          </button>
        )
      })}
    </div>
  )
}

export default function Mercado() {
  const { config, salvarConfig, toast } = useStore()
  const [f, setF] = useState(() => inicial(config))
  const set = (campo, valor) => setF((v) => ({ ...v, [campo]: valor }))
  const setLoja = (i, campo, valor) => setF((v) => ({ ...v, lojas: v.lojas.map((l, k) => (k === i ? { ...l, [campo]: valor } : l)) }))

  const lerLogo = async (e) => {
    const arq = e.target.files?.[0]
    e.target.value = ''
    if (!arq) return
    try { set('logo', await logoParaDataURL(arq)) } catch { toast('Não consegui ler essa imagem. Tente PNG ou JPG.', 'erro') }
  }
  const lerRodape = async (e) => {
    const arq = e.target.files?.[0]
    e.target.value = ''
    if (!arq) return
    try { set('rodapeImagem', await arquivoParaDataURL(arq, 1600)) } catch { toast('Não consegui ler essa imagem.', 'erro') }
  }
  const lerFotosEncarte = async (e) => {
    const arqs = [...(e.target.files || [])]
    e.target.value = ''
    const fotos = []
    for (const a of arqs) { try { fotos.push(await arquivoParaDataURL(a, 1100)) } catch { /* pula a que não abriu */ } }
    setF((v) => ({ ...v, encarteProprio: { ...v.encarteProprio, fotos: [...v.encarteProprio.fotos, ...fotos].slice(0, 6) } }))
  }

  const salvar = () => {
    if (!f.nome.trim()) { toast('Coloque o nome do mercado.', 'erro'); return }
    salvarConfig({ mercado: { ...f, nome: f.nome.trim() }, nomeMercado: f.nome.trim() })
    toast('Cadastro do mercado salvo! Ele vai junto no próximo jornal publicado.')
  }

  const previa = marcaPublica(f)

  return (
    <div className="space-y-5 pb-24">
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Secao numero={1} titulo="Marca" descricao="Nome e logo que aparecem no jornal, na nota de compras e no app.">
          <div className="space-y-3">
            <Campo label="Nome do mercado" obrigatorio><input className={inputCls} value={f.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Ex.: Supermercado Bom Preço" /></Campo>
            <div className="flex items-center gap-3">
              <div className="flex h-24 w-40 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-navy/30 bg-[repeating-conic-gradient(#eef1f5_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-2">
                {f.logo || ehBengala(f) ? <img src={f.logo || logoBengala} alt="Logo do mercado" className="max-h-full max-w-full object-contain" /> : <span className="text-center text-sm text-ink-soft">Sem logo</span>}
              </div>
              <div className="space-y-2">
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-navy px-4 font-bold text-white">
                  <Icon name="Upload" size={16} /> Enviar logo
                  <input type="file" accept="image/*" className="hidden" onChange={lerLogo} />
                </label>
                {f.logo && <button type="button" className="block text-sm font-semibold text-red-700 underline" onClick={() => set('logo', '')}>Tirar logo</button>}
                <p className="text-sm text-ink-soft">{!f.logo && ehBengala(f) ? 'Usando a logo oficial do Bengala.' : 'De preferência PNG sem fundo.'}</p>
              </div>
            </div>
          </div>
        </Secao>

        <Secao numero={2} titulo="Contato e redes" descricao="O WhatsApp de ofertas vira um QR Code no rodapé do jornal.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="WhatsApp de ofertas"><input className={inputCls} inputMode="tel" value={f.whatsappOfertas} onChange={(e) => set('whatsappOfertas', e.target.value)} placeholder="(11) 90000-0000" /></Campo>
            <Campo label="Instagram"><input className={inputCls} value={f.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="@seumercado" /></Campo>
            <Campo label="Facebook"><input className={inputCls} value={f.facebook} onChange={(e) => set('facebook', e.target.value)} placeholder="facebook.com/seumercado" /></Campo>
            <Campo label="Aviso do rodapé"><input className={inputCls} value={f.avisos} onChange={(e) => set('avisos', e.target.value)} placeholder="Ofertas válidas enquanto durarem os estoques." /></Campo>
          </div>
        </Secao>
      </div>

      <Secao numero={3} titulo="Lojas" descricao="Endereço, telefone e horário de cada loja. Até 3 aparecem no rodapé do jornal."
        acao={<Botao variante="contorno" onClick={() => set('lojas', [...f.lojas, lojaVazia()])}><Icon name="Plus" size={16} /> Adicionar loja</Botao>}>
        <div className="grid gap-3 lg:grid-cols-2">
          {f.lojas.map((l, i) => (
            <div key={l.id || i} className="rounded-xl border border-navy/15 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-bold text-navy">Loja {i + 1}</span>
                {f.lojas.length > 1 && <button type="button" className="text-sm font-semibold text-red-700 underline" onClick={() => set('lojas', f.lojas.filter((_, k) => k !== i))}>Remover</button>}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Campo label="Nome da loja"><input className={inputCls} value={l.nome} onChange={(e) => setLoja(i, 'nome', e.target.value)} /></Campo>
                <Campo label="Bairro / cidade"><input className={inputCls} value={l.cidade} onChange={(e) => setLoja(i, 'cidade', e.target.value)} /></Campo>
                <div className="sm:col-span-2"><Campo label="Endereço"><input className={inputCls} value={l.endereco} onChange={(e) => setLoja(i, 'endereco', e.target.value)} /></Campo></div>
                <Campo label="WhatsApp"><input className={inputCls} inputMode="tel" value={l.whatsapp} onChange={(e) => setLoja(i, 'whatsapp', e.target.value)} /></Campo>
                <Campo label="Telefone"><input className={inputCls} inputMode="tel" value={l.telefone} onChange={(e) => setLoja(i, 'telefone', e.target.value)} /></Campo>
                <div className="sm:col-span-2"><Campo label="Horário"><input className={inputCls} value={l.horario} onChange={(e) => setLoja(i, 'horario', e.target.value)} placeholder="Seg a sáb 7h às 22h · Dom 7h às 14h" /></Campo></div>
              </div>
            </div>
          ))}
        </div>
      </Secao>

      <Secao numero={4} titulo="Formas de pagamento" descricao="Toque nas que o mercado aceita.">
        <div className="space-y-4">
          <div><p className="mb-1.5 font-bold text-ink">Cartões</p><Marcar grupo="credito" f={f} setF={setF} /></div>
          <div><p className="mb-1.5 font-bold text-ink">Vale alimentação e refeição</p><Marcar grupo="alimentacao" f={f} setF={setF} /></div>
          <div><p className="mb-1.5 font-bold text-ink">Outros</p><Marcar grupo="outros" f={f} setF={setF} /></div>
        </div>
      </Secao>

      <Secao numero={5} titulo="Modelo do encarte" descricao="Como o jornal deste mercado vai ser montado.">
        <div className="grid gap-3 md:grid-cols-2">
          <Escolha ativo={f.encarteModo === 'nosso'} onClick={() => set('encarteModo', 'nosso')} icone="Newspaper"
            titulo="Usar o modelo ClawMarket" descricao="Pronto na hora: campanhas por setor, layouts jornal, 3×3, 1+7 e ancorado, com a marca do mercado." />
          <Escolha ativo={f.encarteModo === 'proprio'} onClick={() => set('encarteModo', 'proprio')} icone="Camera"
            titulo="O mercado já tem encarte próprio" descricao="Tire fotos do encarte impresso. A equipe ClawMarket monta um modelo igual a ele." />
        </div>
        {f.encarteModo === 'proprio' && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
            <p className="font-bold text-ink">Fotos do encarte impresso ({f.encarteProprio.fotos.length}/6)</p>
            <p className="text-sm text-ink-soft">Fotografe a frente e o verso, bem de perto e com boa luz. Enquanto o modelo próprio não fica pronto, o jornal sai no modelo ClawMarket com a marca do mercado.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {f.encarteProprio.fotos.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt={`Foto ${i + 1} do encarte`} className="h-28 w-20 rounded-lg object-cover shadow" />
                  <button type="button" aria-label="Tirar foto" onClick={() => setF((v) => ({ ...v, encarteProprio: { ...v.encarteProprio, fotos: v.encarteProprio.fotos.filter((_, k) => k !== i) } }))}
                    className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-700 text-white"><Icon name="X" size={14} /></button>
                </div>
              ))}
              {f.encarteProprio.fotos.length < 6 && (
                <label className="flex h-28 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-navy/40 bg-white text-center text-xs font-bold text-navy">
                  <Icon name="Camera" size={20} /> Tirar foto
                  <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={lerFotosEncarte} />
                </label>
              )}
            </div>
            <div className="mt-3"><Campo label="Observação para a equipe"><textarea className={inputCls} rows={2} value={f.encarteProprio.observacao} onChange={(e) => setF((v) => ({ ...v, encarteProprio: { ...v.encarteProprio, observacao: e.target.value } }))} placeholder="Ex.: as cores do jornal são vermelho e amarelo, o selo fica no canto" /></Campo></div>
          </div>
        )}
      </Secao>

      <Secao numero={6} titulo="Rodapé do jornal" descricao="Faixa com lojas, contatos e pagamentos no pé de cada página.">
        <div className="grid gap-3 md:grid-cols-2">
          <Escolha ativo={f.rodapeModo === 'gerado'} onClick={() => set('rodapeModo', 'gerado')} icone="LayoutTemplate" titulo="Montar com o cadastro" descricao="Logo, QR do WhatsApp, lojas e pagamentos." />
          <Escolha ativo={f.rodapeModo === 'imagem'} onClick={() => set('rodapeModo', 'imagem')} icone="Image" titulo="Usar a imagem do rodapé do mercado" descricao="Envie a faixa pronta, como no jornal impresso. No Bengala, já vale a faixa oficial." />
        </div>
        {f.rodapeModo === 'imagem' && (
          <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-navy px-4 font-bold text-white">
            <Icon name="Upload" size={16} /> {f.rodapeImagem ? 'Trocar imagem do rodapé' : 'Enviar imagem do rodapé'}
            <input type="file" accept="image/*" className="hidden" onChange={lerRodape} />
          </label>
        )}
        <p className="mb-1.5 mt-4 text-sm font-bold text-ink-soft">Como fica no jornal</p>
        <div className="overflow-hidden rounded-xl border border-navy/15">
          <div className="relative w-full bg-white" style={{ height: 150 }}>
            <MarcaContexto.Provider value={previa}>
              <RodapeOficial altura={150} />
            </MarcaContexto.Provider>
          </div>
        </div>
      </Secao>

      <div className="z-20 flex justify-end md:sticky md:bottom-4">
        <Botao onClick={salvar} className="w-full shadow-lg md:w-auto"><Icon name="Save" size={16} /> Salvar cadastro</Botao>
      </div>
    </div>
  )
}
