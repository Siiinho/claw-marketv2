// Corrige o setor dos produtos dos catálogos pelo nome (src/lib/classificarSetor.js).
// Os setores antigos vinham de palavras soltas no nome ("Gatorade" virava Pet Shop por causa de
// "GATO", limpador Ypê "Doce Vida" virava doce/Mercearia). Uso:
//   node scripts/reclassificar-setores.mjs
// Reescreve src/data/catalogoMercadologiaBengala.json e public/catalogo/base-produtos.json.
// Os produtos já salvos no app são corrigidos na hora de carregar (StoreContext), pela mesma regra.
import fs from 'node:fs'
import { setorPeloNome } from '../src/lib/classificarSetor.js'

const MERCADOLOGIA = 'src/data/catalogoMercadologiaBengala.json'
const BASE = 'public/catalogo/base-produtos.json'

const contagem = {}
let total = 0
const anotar = (codigo, antigo, novo) => {
  total++
  const k = `${antigo} -> ${novo}`
  contagem[k] = (contagem[k] || 0) + 1
}

const merc = JSON.parse(fs.readFileSync(MERCADOLOGIA, 'utf8'))
for (const p of merc.produtos) {
  const novo = setorPeloNome(p.nome) || setorPeloNome(p.nomeBengala)
  if (novo && novo !== p.setor) { anotar(p.codigoBarras, p.setor, novo); p.setor = novo }
}
fs.writeFileSync(MERCADOLOGIA, JSON.stringify(merc))

const base = JSON.parse(fs.readFileSync(BASE, 'utf8'))
for (const linha of base.produtos) {
  const novo = setorPeloNome(linha[1])
  if (novo && novo !== linha[2]) { anotar(linha[0], linha[2], novo); linha[2] = novo }
}
fs.writeFileSync(BASE, JSON.stringify(base))

console.log('produtos com setor corrigido:', total)
console.log(Object.entries(contagem).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n}\t${k}`).join('\n'))
