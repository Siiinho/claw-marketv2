// Baixa no SERVIDOR a foto de um link copiado (Google Imagens, site de loja...). Aceita o endereço
// da imagem, o link de redirecionamento do Google e a página do produto (usa a foto principal dela).
// O formato não importa (JPG, JFIF, PNG, WebP, AVIF...): quem confere a foto é fotoProduto.js.
// Só acessa endereços públicos: o link não pode ser usado para alcançar a rede da loja.
import https from 'node:https'
import dns from 'node:dns'
import net from 'node:net'

const MAX_FOTO = 12 * 1024 * 1024
const MAX_PAGINA = 2 * 1024 * 1024
const TEMPO = 12000
const AGENTE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

export class ErroLink extends Error {}

const bloqueados = new net.BlockList()
for (const [rede, bits] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3]]) bloqueados.addSubnet(rede, bits, 'ipv4')

export function ipPublico(ip) {
  if (net.isIPv4(ip)) return !bloqueados.check(ip, 'ipv4')
  if (!net.isIPv6(ip)) return false
  // só IPv6 global de verdade (2000::/3), sem 6to4, Teredo e documentação, que escondem outro IP
  return /^[23]/i.test(ip) && !/^(2002:|2001:0{0,4}:|2001:db8:)/i.test(ip)
}

// A conferência é feita no mesmo endereço em que a conexão é aberta (não dá para trocar depois).
function procurarPublico(host, opcoes, pronto) {
  dns.lookup(host, { ...opcoes, all: true }, (erro, lista) => {
    if (erro) return pronto(erro)
    if (!lista.length || lista.some((e) => !ipPublico(e.address))) return pronto(new ErroLink('Esse endereço não é permitido.'))
    return opcoes.all ? pronto(null, lista) : pronto(null, lista[0].address, lista[0].family)
  })
}

function enderecoValido(texto) {
  let url
  try { url = new URL(texto) } catch (_) { throw new ErroLink('Cole um link válido.') }
  if (url.protocol === 'http:') url.protocol = 'https:'
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new ErroLink('Cole um link que comece com https://')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (net.isIP(host) && !ipPublico(host)) throw new ErroLink('Esse endereço não é permitido.')
  return url
}

function pedir(url) {
  return new Promise((ok, falha) => {
    const prazo = setTimeout(() => req.destroy(new ErroLink('O site demorou demais para responder.')), TEMPO)
    const acabar = (fn, v) => { clearTimeout(prazo); fn(v) }
    const req = https.get(url, {
      lookup: procurarPublico,
      headers: { 'User-Agent': AGENTE, Accept: 'image/avif,image/webp,image/*,text/html;q=0.8,*/*;q=0.5', 'Accept-Language': 'pt-BR,pt;q=0.9' },
    }, (res) => {
      const status = res.statusCode || 0
      if (status >= 300 && status < 400 && res.headers.location) { res.resume(); return acabar(ok, { para: res.headers.location }) }
      if (status !== 200) { res.resume(); return acabar(falha, new ErroLink(`O site não liberou essa foto (erro ${status}).`)) }
      const tipo = String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
      const limite = tipo.includes('html') ? MAX_PAGINA : MAX_FOTO
      const partes = []
      let total = 0
      res.on('data', (p) => {
        total += p.length
        if (total <= limite) return partes.push(p)
        // página grande: o começo já tem a foto principal; foto grande demais é recusada
        res.destroy()
        return acabar(tipo.includes('html') ? ok : falha, tipo.includes('html') ? { tipo, corpo: Buffer.concat(partes) } : new ErroLink('Essa foto é grande demais (mais de 12 MB).'))
      })
      res.on('end', () => acabar(ok, { tipo, corpo: Buffer.concat(partes) }))
      res.on('error', (e) => acabar(falha, e))
    })
    req.on('error', (e) => acabar(falha, e instanceof ErroLink ? e : new ErroLink('Não foi possível abrir esse link.')))
  })
}

// Links do Google que escondem o endereço de verdade.
export function abrirLinkDoGoogle(url) {
  if (!/(^|\.)google\.(com|com\.br|[a-z]{2,3})$/i.test(url.hostname)) return null
  const p = url.searchParams
  if (url.pathname === '/imgres') return p.get('imgurl') || p.get('imgrefurl')
  if (url.pathname === '/url') return p.get('url') || p.get('q')
  return null
}

const desfazer = (t) => t.replace(/&amp;/g, '&').replace(/&#x2F;/gi, '/').replace(/&quot;/g, '"')
export function fotoPrincipalDaPagina(html, base) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    if (!/(?:property|name)\s*=\s*["'](?:og:image(?::secure_url|:url)?|twitter:image)["']/i.test(tag)) continue
    const valor = tag.match(/content\s*=\s*["']([^"']+)["']/i)?.[1]
    if (!valor) continue
    try { return new URL(desfazer(valor), base).href } catch (_) { /* tenta a próxima */ }
  }
  return null
}

// Devolve { bytes, origem }. Lança ErroLink com uma mensagem pronta para a pessoa.
export async function baixarFotoDoLink(texto) {
  const entrada = String(texto || '').trim()
  // "Copiar endereço da imagem" no Google às vezes traz a própria miniatura embutida
  const embutida = entrada.match(/^data:image\/[a-z+.-]+;base64,([a-z0-9+/=\s]+)$/i)
  if (embutida) return { bytes: Buffer.from(embutida[1], 'base64'), origem: null }

  let url = enderecoValido(entrada)
  let paginas = 0
  for (let passo = 0; passo < 8; passo += 1) {
    const doGoogle = abrirLinkDoGoogle(url)
    if (doGoogle) { url = enderecoValido(doGoogle); continue }
    const r = await pedir(url)
    if (r.para) { url = enderecoValido(new URL(r.para, url).href); continue }
    if (!r.tipo.includes('html')) return { bytes: r.corpo, origem: url.href }
    if (/(^|\.)google\./i.test(url.hostname) || /(^|\.)share\.google$/i.test(url.hostname)) throw new ErroLink('Esse é o link da pesquisa do Google. Abra a foto, segure (ou botão direito) e copie o endereço da imagem.')
    const foto = paginas === 0 ? fotoPrincipalDaPagina(r.corpo.toString('utf8'), url) : null
    if (!foto) throw new ErroLink('Esse link abre uma página sem foto. Copie o endereço da imagem.')
    paginas += 1
    url = enderecoValido(foto)
  }
  throw new ErroLink('Esse link redireciona vezes demais. Copie o endereço da imagem.')
}
