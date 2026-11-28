import { useEffect } from 'react'
import { useStore, NAV, PERMISSOES } from '../store/StoreContext'
import { Icon, Secao } from '../components/ui'

const COR_PAPEL = { admin: { c: '#2e6fb0', bg: '#e6f1fb', l: 'Admin' }, gerente: { c: '#2e9e6b', bg: '#e2f3ea', l: 'Gerente' }, repositor: { c: '#8a4fa0', bg: '#f0e8f5', l: 'Repositor' } }

export default function Usuarios() {
  const { usuario, contas, alterarPapel, toast, nuvemStatus, recarregarContas } = useStore()
  useEffect(() => { recarregarContas?.() }, [recarregarContas])
  const souAdmin = usuario.papel === 'admin'
  const mudarPapel = async (u, papel) => {
    if (await alterarPapel(u.id, papel)) toast(`${u.nome} agora é ${COR_PAPEL[papel].l}.`)
    else toast('Não foi possível mudar a função.', 'erro')
  }

  return (
    <div className="space-y-5">
      <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm text-ink ${nuvemStatus === 'online' ? 'bg-success/10' : nuvemStatus === 'desligada' ? 'bg-cream-200' : 'bg-warning/15'}`} role="status">
        <Icon name={nuvemStatus === 'online' ? 'Cloud' : nuvemStatus === 'desligada' ? 'CloudOff' : 'CloudCog'} size={17} className={`mt-0.5 shrink-0 ${nuvemStatus === 'online' ? 'text-success' : 'text-ink-soft'}`} />
        <span>
        {nuvemStatus === 'online' && 'Conectado à nuvem: todos os logins e aparelhos veem os mesmos produtos, fila e encarte, atualizados na hora.'}
        {nuvemStatus === 'conectando' && 'Conectando à nuvem…'}
        {nuvemStatus === 'erro' && 'Sem conexão com a nuvem agora. O que for feito fica neste aparelho e sobe quando a conexão voltar.'}
        {nuvemStatus === 'desligada' && 'Nuvem desligada: os logins e os dados ficam só neste aparelho (iguais para todos os logins dele).'}
        </span>
      </div>
      {souAdmin && usuario.convite && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed border-navy/30 bg-white p-4">
          <Icon name="KeyRound" size={22} className="text-navy" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">Código da equipe {usuario.mercadoNome ? `do ${usuario.mercadoNome}` : ''}</p>
            <p className="text-sm text-ink-soft">Quem trabalha no mercado entra em "Sou da equipe" com este código.</p>
          </div>
          <span className="num-tab rounded-lg bg-cream-200 px-3 py-1.5 text-2xl font-black tracking-[0.25em] text-navy">{usuario.convite}</span>
          <button type="button" className="inline-flex min-h-10 items-center gap-1 rounded-lg border-2 border-navy/30 px-3 text-sm font-bold text-navy" onClick={() => { navigator.clipboard?.writeText(usuario.convite); toast('Código copiado!') }}><Icon name="Copy" size={15} /> Copiar</button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {contas.map((u) => {
          const cp = COR_PAPEL[u.papel] || COR_PAPEL.repositor
          const perms = (PERMISSOES[u.papel] || []).length
          return (
            <div key={u.id} className="card-bengala p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: cp.c }}>
                  {u.nome.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold text-ink">{u.nome}</span>
                    {usuario.id === u.id && <span className="rounded-full bg-offer px-2 py-0.5 text-xs font-semibold text-navy">você</span>}
                  </div>
                  <div className="truncate text-xs text-ink-soft">Nome de usuário</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                {souAdmin && !u.master ? (
                  <select value={u.papel} onChange={(e) => mudarPapel(u, e.target.value)} aria-label={`Função de ${u.nome}`}
                    className="min-h-8 rounded-full border-0 px-2.5 text-xs font-semibold" style={{ background: cp.bg, color: cp.c }}>
                    {Object.entries(COR_PAPEL).map(([id, c]) => <option key={id} value={id}>{c.l}</option>)}
                  </select>
                ) : (
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: cp.bg, color: cp.c }}>{cp.l}{u.master ? ' · master' : ''}</span>
                )}
                <span className="num-tab text-xs text-ink-soft">{perms} {perms === 1 ? 'permissão' : 'permissões'}</span>
              </div>
            </div>
          )
        })}
      </div>

      <Secao titulo="O que cada função pode ver" descricao="Admin vê tudo. Gerente cuida das ofertas e do jornal. Repositor bipa os produtos." corpo="mt-4 -mx-4 md:-mx-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-ink-soft/10 bg-cream/60 text-left text-xs text-ink-soft">
                <th className="px-4 py-2.5 font-semibold md:px-5">Tela</th>
                {Object.keys(COR_PAPEL).map((p) => <th key={p} className="px-3 py-2.5 text-center font-semibold">{COR_PAPEL[p].l}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-soft/8">
              {NAV.map((n) => (
                <tr key={n.key} className="hover:bg-cream-200/50">
                  <td className="px-4 py-2.5 font-medium text-ink md:px-5">{n.label}</td>
                  {Object.keys(COR_PAPEL).map((papel) => (
                    <td key={papel} className="px-3 py-2.5 text-center">
                      {PERMISSOES[papel].includes(n.key)
                        ? <Icon name="Check" size={16} strokeWidth={2.25} className="mx-auto text-success" aria-label="pode" />
                        : <Icon name="Minus" size={16} className="mx-auto text-ink-soft/40" aria-label="não pode" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>
    </div>
  )
}
