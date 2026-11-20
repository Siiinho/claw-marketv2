-- ClawMarket: dados compartilhados entre todos os logins e aparelhos da loja.
-- Rode este arquivo inteiro uma vez no Supabase (SQL Editor > New query > Run).
-- Pode rodar de novo sem perder dados.

-- Perfis: um por login. O papel decide o que cada um vê no menu; os dados são os mesmos para todos.
create table if not exists public.cm_perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  usuario text not null unique,
  nome text not null,
  papel text not null default 'repositor' check (papel in ('admin', 'gerente', 'repositor')),
  master boolean not null default false,
  trocar_senha boolean not null default false,
  criado_em timestamptz not null default now()
);

-- Tudo o que o app guarda: produtos (com a fila do jornal), ofertas, jornais, lotes,
-- configuração e o encarte publicado. Uma linha por item, para dois aparelhos poderem
-- mexer em produtos diferentes ao mesmo tempo sem um apagar o outro.
create table if not exists public.cm_itens (
  colecao text not null,
  id text not null,
  dados jsonb,
  excluido boolean not null default false,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid(),
  primary key (colecao, id)
);
create index if not exists cm_itens_atualizado on public.cm_itens (atualizado_em);

-- Hora e autor de cada gravação vêm do banco, não do aparelho.
create or replace function public.cm_carimbo() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end $$;
drop trigger if exists cm_itens_carimbo on public.cm_itens;
create trigger cm_itens_carimbo before insert or update on public.cm_itens
  for each row execute function public.cm_carimbo();

create or replace function public.cm_eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cm_perfis where id = auth.uid() and papel = 'admin')
$$;

-- Ao criar um login: o usuário "admin" é o master (administrador, senha fixa admin);
-- os demais começam como repositor e o admin muda a função na tela Usuários.
create or replace function public.cm_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  u text := lower(coalesce(new.raw_user_meta_data ->> 'usuario', split_part(new.email, '@', 1)));
  eh_master boolean := u = 'admin' and not exists (select 1 from public.cm_perfis where master);
begin
  insert into public.cm_perfis (id, usuario, nome, papel, master, trocar_senha)
  values (new.id, u, coalesce(new.raw_user_meta_data ->> 'nome', u),
          case when eh_master then 'admin' else 'repositor' end, eh_master, false)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists cm_ao_criar_usuario on auth.users;
create trigger cm_ao_criar_usuario after insert on auth.users
  for each row execute function public.cm_novo_usuario();

-- O master entra sempre com admin / admin, sem troca obrigatória.
update public.cm_perfis set trocar_senha = false where master and trocar_senha;

-- O próprio login avisa que já trocou a senha (o resto do perfil só o admin muda).
create or replace function public.cm_senha_trocada() returns void
language sql security definer set search_path = public as $$
  update public.cm_perfis set trocar_senha = false where id = auth.uid()
$$;

alter table public.cm_perfis enable row level security;
alter table public.cm_itens enable row level security;

drop policy if exists "perfis: logados leem" on public.cm_perfis;
create policy "perfis: logados leem" on public.cm_perfis for select to authenticated using (true);
drop policy if exists "perfis: admin muda" on public.cm_perfis;
create policy "perfis: admin muda" on public.cm_perfis for update to authenticated
  using (public.cm_eh_admin()) with check (public.cm_eh_admin() and (master = false or papel = 'admin'));

-- Qualquer login (admin, gerente ou repositor) lê e grava os dados da loja.
drop policy if exists "itens: logados leem" on public.cm_itens;
create policy "itens: logados leem" on public.cm_itens for select to authenticated using (true);
drop policy if exists "itens: logados gravam" on public.cm_itens;
create policy "itens: logados gravam" on public.cm_itens for insert to authenticated with check (true);
drop policy if exists "itens: logados atualizam" on public.cm_itens;
create policy "itens: logados atualizam" on public.cm_itens for update to authenticated using (true) with check (true);
-- O cliente (sem login) só lê o encarte publicado, pela tag NFC.
drop policy if exists "itens: cliente le o encarte" on public.cm_itens;
create policy "itens: cliente le o encarte" on public.cm_itens for select to anon using (colecao = 'encarte' and not excluido);

grant select on public.cm_itens to anon;
grant select, insert, update on public.cm_itens to authenticated;
grant select, update on public.cm_perfis to authenticated;
grant execute on function public.cm_senha_trocada() to authenticated;

-- Atualização ao vivo: todo aparelho aberto recebe as mudanças na hora.
do $$ begin
  alter publication supabase_realtime add table public.cm_itens;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.cm_perfis;
exception when duplicate_object then null; end $$;
