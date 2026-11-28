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
language plpgsql set search_path = public as $$
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
-- Funções internas: o cliente sem login não chama nenhuma; os logins só as que precisam.
revoke execute on function public.cm_novo_usuario() from public, anon, authenticated;
revoke execute on function public.cm_eh_admin() from public, anon;
revoke execute on function public.cm_senha_trocada() from public, anon;
grant execute on function public.cm_eh_admin() to authenticated;
grant execute on function public.cm_senha_trocada() to authenticated;

-- Atualização ao vivo: todo aparelho aberto recebe as mudanças na hora.
do $$ begin
  alter publication supabase_realtime add table public.cm_itens;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.cm_perfis;
exception when duplicate_object then null; end $$;

-- Fotos dos produtos (as da pasta de imagens do PC da loja). Pasta pública para leitura;
-- só logins enviam. O PC sobe a foto de cada produto que entra no sistema.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "produtos: logados enviam fotos" on storage.objects;
create policy "produtos: logados enviam fotos" on storage.objects for insert to authenticated with check (bucket_id = 'produtos');
drop policy if exists "produtos: logados trocam fotos" on storage.objects;
create policy "produtos: logados trocam fotos" on storage.objects for update to authenticated using (bucket_id = 'produtos') with check (bucket_id = 'produtos');
drop policy if exists "produtos: logados veem fotos" on storage.objects;
create policy "produtos: logados veem fotos" on storage.objects for select to authenticated using (bucket_id = 'produtos');

-- 27/11/2026: visitas do site do cliente por dia (o site chama cm_registrar_visita sem login)
create table if not exists public.cm_visitas (
  dia date not null,
  pagina text not null,
  visitantes integer not null default 0,
  aberturas integer not null default 0,
  primary key (dia, pagina)
);
alter table public.cm_visitas enable row level security;
create policy "visitas: logados leem" on public.cm_visitas for select to authenticated using (true);
create or replace function public.cm_registrar_visita(p_pagina text, p_novo boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_pagina text := left(coalesce(nullif(p_pagina, ''), 'encarte'), 30);
  v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if v_pagina !~ '^[a-z-]+$' then return; end if;
  insert into public.cm_visitas (dia, pagina, visitantes, aberturas)
  values (v_dia, v_pagina, case when p_novo then 1 else 0 end, 1)
  on conflict (dia, pagina) do update
    set aberturas = cm_visitas.aberturas + 1,
        visitantes = cm_visitas.visitantes + case when p_novo then 1 else 0 end;
end;
$$;
revoke all on function public.cm_registrar_visita(text, boolean) from public;
grant execute on function public.cm_registrar_visita(text, boolean) to anon, authenticated;

-- 27/11/2026: vários mercados (aplicado como migração "multi_mercado_etapa1").
-- cm_mercados (id = endereço do mercado, convite = código da equipe); cm_perfis.mercado_id e
-- cm_itens.mercado_id (padrão 'bengala'); cm_meu_mercado(); RLS por mercado em itens, perfis e
-- visitas; cm_novo_usuario cria mercado (mercado_nome) ou entra na equipe (convite);
-- cm_convite_mercado(código) para o login; cm_registrar_visita(pagina, novo, mercado).
-- O Bengala guarda ids como sempre; outros mercados guardam "<mercado>~<id>" (ver src/lib/nuvem.js).

-- 27/11/2026: migração multi_mercado_endereco: endereço exclusivo escolhido no cadastro (mercado_endereco),
-- cm_endereco_livre(endereco) para o login conferir, nomes reservados (telas do app).
