-- ArsaTakip v2.7.2 · Yönetici = ana hesabın (admin) gördüğü her şeyi görür
-- Supabase > SQL Editor > bu dosyanın tamamını yapıştır > Run. Bir kere çalıştırmak yeter, tekrar çalıştırmak da zarar vermez.
-- Sadece OKUMA izni ekler; mevcut kurallara dokunmaz (Supabase'de izinler "veya" ile birleşir).

create or replace function public.ben_yonetici() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','yonetici'));
$$;

create or replace function public.admin_mi(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = uid and role = 'admin');
$$;

do $$
declare t text;
begin
  foreach t in array array['piyasa_bot','piyasa_sanal'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists yonetici_admini_gorur on public.%I', t);
      execute format('create policy yonetici_admini_gorur on public.%I for select to authenticated using (public.ben_yonetici() and public.admin_mi(user_id))', t);
    end if;
  end loop;
end $$;

-- Profiller: yönetici ana hesabı bulabilsin diye herkesin adını/rolünü okuyabilmeli
drop policy if exists yonetici_profilleri_gorur on public.profiles;
create policy yonetici_profilleri_gorur on public.profiles for select to authenticated using (public.ben_yonetici());

-- v3.3.1 · Kişisel veriler (portföy, takip, alarm, olay, ayarlar) herkese özel: yönetici de admin'inkini göremez
do $$
declare t text;
begin
  foreach t in array array['piyasa_portfoy','piyasa_takip','piyasa_alarm','piyasa_olay','piyasa_ayar'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists yonetici_admini_gorur on public.%I', t);
    end if;
  end loop;
end $$;
