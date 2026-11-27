-- ArsaTakip v3.2 · Telefona anlık bildirim (Bay Pipo)
-- Supabase > SQL Editor > bu dosyanın tamamını yapıştır > Run. Bir kere çalıştırmak yeter, tekrar çalıştırmak zarar vermez.
-- 1) bildirim_abone: her kullanıcının bildirim açtığı cihazlar (herkes sadece kendi cihazlarını görür/siler)
-- 2) bildirim_anahtar: bildirim imza anahtarı. Bot ilk çalışmada kendisi üretir. Gizli kısmını SADECE bot (servis anahtarı) okuyabilir.
-- 3) bildirim_pub: uygulamanın ihtiyaç duyduğu açık anahtar (gizli kısım yok)

create table if not exists public.bildirim_abone (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  cihaz text,
  test boolean default false,
  created_at timestamptz default now()
);
alter table public.bildirim_abone enable row level security;
drop policy if exists kendi_cihazlari on public.bildirim_abone;
create policy kendi_cihazlari on public.bildirim_abone for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.bildirim_anahtar (
  id int primary key,
  pub text not null,
  jwk jsonb not null,
  created_at timestamptz default now()
);
alter table public.bildirim_anahtar enable row level security;   -- kural yok = uygulamadan kimse okuyamaz, sadece bot (servis anahtarı)

create or replace view public.bildirim_pub as select pub from public.bildirim_anahtar where id = 1;
grant select on public.bildirim_pub to authenticated;

-- v3.2.1 · AI araştırmalı hedef fiyatlar herkes için ortak: herkes okuyabilir (sadece kaynak = 'hedef' satırları)
drop policy if exists hedef_herkes_okur on public.piyasa_analiz;
create policy hedef_herkes_okur on public.piyasa_analiz for select to authenticated using (kaynak = 'hedef');

-- v4.1 · AI dünya brifingi de herkes için ortak
drop policy if exists hedef_herkes_okur on public.piyasa_analiz;
create policy hedef_herkes_okur on public.piyasa_analiz for select to authenticated using (kaynak in ('hedef', 'brifing'));
