import { useEffect } from 'react'
import { useStore, NAV, PERMISSOES } from '../store/StoreContext'
import { Icon } from '../components/ui'

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
    <div className="space-y-6">
      <div className={`rounded-xl px-4 py-3 text-sm ${nuvemStatus === 'online' ? 'bg-success/10 text-ink' : nuvemStatus === 'desligada' ? 'bg-cream-200 text-ink-soft' : 'bg-warning/10 text-ink'}`} role="status">
        {nuvemStatus === 'online' && 'Conectado à nuvem: todos os logins e aparelhos veem os mesmos produtos, fila e encarte, atualizados na hora.'}
        {nuvemStatus === 'conectando' && 'Conectando à nuvem…'}
        {nuvemStatus === 'erro' && 'Sem conexão com a nuvem agora. O que for feito fica neste aparelho e sobe quando a conexão voltar.'}
        {nuvemStatus === 'desligada' && 'Nuvem desligada: os logins e os dados ficam só neste aparelho (iguais para todos os logins dele).'}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {contas.map((u) => {
          const cp = COR_PAPEL[u.papel] || COR_PAPEL.repositor
          const perms = (PERMISSOES[u.papel] || []).length
          return (
            <div key={u.id} className="card-bengala p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: cp.c }}>
                  {u.nome.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold text-ink">{u.nome}</span>
                    {usuario.id === u.id && <span className="rounded-full bg-bengala/15 px-2 py-0.5 text-[10px] font-bold text-bengala">VOCÊ</span>}
                  </div>
                  <div className="truncate text-xs text-ink-soft">Nome de usuário</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                {souAdmin && !u.master ? (
                  <select value={u.papel} onChange={(e) => mudarPapel(u, e.target.value)} aria-label={`Função de ${u.nome}`}
                    className="rounded-full border-0 px-2.5 py-1 text-xs font-bold" style={{ background: cp.bg, color: cp.c }}>
                    {Object.entries(COR_PAPEL).map(([id, c]) => <option key={id} value={id}>{c.l}</option>)}
                  </select>
                ) : (
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: cp.bg, color: cp.c }}>{cp.l}{u.master ? ' · master' : ''}</span>
                )}
                <span className="text-xs text-ink-soft">{perms} permissões</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="card-bengala overflow-hidden">
        <div className="border-b border-ink-soft/10 px-5 py-3.5">
          <h2 className="font-bold text-ink">Matriz de permissões</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-soft/10 text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-2.5 font-medium">Funcionalidade</th>
                {Object.keys(COR_PAPEL).map((p) => <th key={p} className="px-3 py-2.5 text-center font-medium">{COR_PAPEL[p].l}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-soft/8">
              {NAV.map((n) => (
                <tr key={n.key} className="hover:bg-cream-200/50">
                  <td className="px-5 py-2.5 font-medium text-ink">{n.label}</td>
                  {Object.keys(COR_PAPEL).map((papel) => (
                    <td key={papel} className="px-3 py-2.5 text-center">
                      {PERMISSOES[papel].includes(n.key)
                        ? <Icon name="Check" size={16} className="mx-auto text-success" />
                        : <Icon name="X" size={16} className="mx-auto text-ink-soft/30" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
