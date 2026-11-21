import { useState } from 'react'
import { SETORES, arquivoParaDataURL, dataISOmaisDias } from '../lib/utils'
import { setorPeloNome } from '../lib/classificarSetor'
import { Botao, Campo, Icon, ProdutoThumb, inputCls } from './ui'

const UNIDADES = ['UNI', 'KG', 'PCT', 'CX', 'BDJ', 'DZ']
const unidadePadrao = (setor) => (setor === 'hortifruti' || setor === 'acougue' ? 'KG' : 'UNI')

// Passo de cadastro quando o código bipado não existe no cadastro, na mercadologia nem na base.
// O código já vem preenchido; o produto é salvo e segue para o jornal de onde foi bipado.
//  - `inicial`: o que já se sabe do produto (código e, às vezes, nome ou foto achados fora).
//  - `comLote`: pede também validade e quantidade (scanner do Jornal, que não tem o passo do lote).
export default function CadastroProdutoNovo({ inicial, comLote = false, titulo = 'Produto não encontrado. Cadastre agora', textoSalvar = 'Cadastrar e continuar', onSalvar, onCancelar, toast }) {
  const [p, setP] = useState(() => ({
    nome: '',
    marca: '',
    gramagem: '',
    setor: 'mercearia',
    precoNormal: '',
    precoPromo: '',
    validade: comLote ? dataISOmaisDias(7) : '',
    estoque: 1,
    imagem: null,
    ...inicial,
    unidade: inicial?.unidade || unidadePadrao(inicial?.setor || 'mercearia'),
  }))
  const [lendoFoto, setLendoFoto] = useState(false)
  // Enquanto ninguém escolhe o setor, ele acompanha o nome (ex.: "Limpador..." vai para Limpeza).
  const [setorTocado, setSetorTocado] = useState(false)
  const muda = (campo) => (e) => setP((atual) => ({ ...atual, [campo]: e.target.value }))

  const mudarNome = (e) => {
    const nome = e.target.value
    setP((atual) => {
      const sugerido = setorTocado ? null : setorPeloNome(nome)
      if (!sugerido || sugerido === atual.setor) return { ...atual, nome }
      return {
        ...atual,
        nome,
        setor: sugerido,
        unidade: atual.unidade === unidadePadrao(atual.setor) ? unidadePadrao(sugerido) : atual.unidade,
      }
    })
  }

  const trocarSetor = (setor) => setP((atual) => ({
    ...atual,
    setor,
    // a unidade acompanha o setor enquanto ninguém escolheu outra
    unidade: atual.unidade === unidadePadrao(atual.setor) ? unidadePadrao(setor) : atual.unidade,
  }))

  const receberFoto = async (arquivo) => {
    if (!arquivo) return
    setLendoFoto(true)
    try {
      const imagem = await arquivoParaDataURL(arquivo, 800)
      setP((atual) => ({
        ...atual,
        imagem,
        imagemManual: true,
        imagemTratada: true,
        imagemTratamento: 'imagem-manual-livre-v1',
        imagemAltaResolucao: null,
        imagemOrigem: 'upload-manual',
        imagemOrigemNome: 'Foto tirada no cadastro',
      }))
    } catch {
      toast?.('Não foi possível ler a foto.', 'erro')
    } finally {
      setLendoFoto(false)
    }
  }

  const salvar = () => {
    const codigo = String(p.codigoBarras || '').replace(/\D/g, '')
    if (!codigo) return toast?.('Informe o código de barras.', 'erro')
    if (!p.nome?.trim()) return toast?.('Informe o nome do produto.', 'erro')
    const normal = Number(String(p.precoNormal).replace(',', '.'))
    if (!(normal > 0)) return toast?.('Informe o preço normal.', 'erro')
    const promo = Number(String(p.precoPromo || '').replace(',', '.'))
    if (promo && promo >= normal) return toast?.('O preço de oferta precisa ser menor que o normal.', 'erro')
    onSalvar({
      ...p,
      id: p.id || globalThis.crypto?.randomUUID?.() || `produto-${Date.now()}`,
      codigoBarras: codigo,
      nome: p.nome.trim(),
      marca: (p.marca || '').trim(),
      gramagem: (p.gramagem || '').trim(),
      loja: p.loja || 'loja3',
      precoNormal: normal,
      precoPromo: promo > 0 ? promo : null,
      estoque: Math.max(1, Number(p.estoque) || 1),
      cadastradoNoScanner: true,
      // quem cadastrou escolheu o setor: a correção automática não troca
      setorManual: true,
    })
  }

  return (
    <div className="anim-in mt-3 rounded-xl border-2 border-info/30 bg-info/5 p-3 sm:p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-info text-white"><Icon name="PackagePlus" size={19} /></span>
        <div className="min-w-0 flex-1">
          <div className="font-black text-ink">{titulo}</div>
          <div className="text-xs text-ink-soft">Preencha os dados e ele entra no cadastro e no jornal. Campos com * são obrigatórios.</div>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-3">
        <ProdutoThumb produto={p} size={72} />
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg bg-bengala px-3 text-sm font-bold text-white">
            <Icon name={lendoFoto ? 'LoaderCircle' : 'Camera'} size={16} className={lendoFoto ? 'animate-spin' : ''} /> Tirar foto
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { receberFoto(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-ink-soft/20 bg-white px-3 text-sm font-bold text-ink">
            <Icon name="ImagePlus" size={16} /> Escolher arquivo
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { receberFoto(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Campo label="Código de barras *"><input className={inputCls} inputMode="numeric" value={p.codigoBarras || ''} onChange={muda('codigoBarras')} /></Campo>
        <div className="col-span-2"><Campo label="Nome do produto *"><input className={inputCls} value={p.nome || ''} onChange={mudarNome} placeholder="Ex.: Arroz Tio João 5kg" autoFocus /></Campo></div>
        <Campo label="Marca"><input className={inputCls} value={p.marca || ''} onChange={muda('marca')} /></Campo>
        <Campo label="Gramagem"><input className={inputCls} value={p.gramagem || ''} onChange={muda('gramagem')} placeholder="350 g" /></Campo>
        <Campo label="Setor *">
          <select className={inputCls} value={p.setor || 'mercearia'} onChange={(e) => { setSetorTocado(true); trocarSetor(e.target.value) }}>
            {SETORES.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Vendido por">
          <select className={inputCls} value={p.unidade} onChange={muda('unidade')}>
            {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </Campo>
        <Campo label="Preço normal (R$) *"><input type="number" min="0.01" step="0.01" inputMode="decimal" className={inputCls} value={p.precoNormal ?? ''} onChange={muda('precoNormal')} /></Campo>
        <Campo label="Preço de oferta (R$)"><input type="number" min="0.01" step="0.01" inputMode="decimal" className={inputCls} value={p.precoPromo ?? ''} onChange={muda('precoPromo')} placeholder="Opcional" /></Campo>
        {comLote && (
          <>
            <Campo label="Validade (uso interno)"><input type="date" className={inputCls} value={p.validade || ''} onChange={muda('validade')} /></Campo>
            <Campo label="Quantidade"><input type="number" min="1" inputMode="numeric" className={inputCls} value={p.estoque || 1} onChange={muda('estoque')} /></Campo>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Botao variante="contorno" onClick={onCancelar} className="justify-center">Cancelar</Botao>
        <Botao onClick={salvar} disabled={lendoFoto} className="min-h-11 justify-center"><Icon name="Check" size={16} /> {textoSalvar}</Botao>
      </div>
    </div>
  )
}
