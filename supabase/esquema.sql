-- Mis Finanzas — esquema multiusuario (proyecto Supabase mis-finanzas).
-- Cada persona sólo ve lo suyo (RLS). Tokens y correos procesados: sólo el servidor.

create table if not exists public.perfiles (
  user_id uuid primary key references auth.users on delete cascade,
  email text unique,
  nombre text,
  ajustes jsonb not null default '{}'::jsonb,
  gmail_conectado boolean not null default false,
  sync_estado text,
  sync_pendientes int not null default 0,
  ultima_sync timestamptz,
  creado timestamptz not null default now()
);

create table if not exists public.tokens (
  user_id uuid primary key references auth.users on delete cascade,
  refresh_cifrado text not null,
  actualizado timestamptz not null default now()
);

create table if not exists public.movimientos (
  user_id uuid not null references auth.users on delete cascade,
  id text not null,              -- id del correo de Gmail (o «m…» si es a mano)
  f date not null,
  h text,
  m numeric(12,2) not null,
  tipo text not null,            -- compra | transferencia | deposito | retiro
  c text not null,               -- comercio / destino / origen tal cual
  tj text,                       -- terminación de tarjeta o cuenta
  clave text not null,           -- comercio normalizado (llave del diccionario)
  cat_auto text,
  fmt text,
  extra jsonb,
  dup text[],
  creado timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists movimientos_user_f on public.movimientos (user_id, f desc);

create table if not exists public.correos (
  user_id uuid not null references auth.users on delete cascade,
  msg_id text not null,
  estado text not null,          -- ok | dup | no
  primary key (user_id, msg_id)
);

-- Diccionario compartido: comercio normalizado → categoría (reglas o IA). Lo leen todos.
create table if not exists public.diccionario (
  clave text primary key,
  cat text not null,
  fuente text not null,          -- regla | ia
  ejemplo text,
  usos int not null default 1,
  creado timestamptz not null default now()
);

alter table public.perfiles   enable row level security;
alter table public.tokens     enable row level security;
alter table public.movimientos enable row level security;
alter table public.correos    enable row level security;
alter table public.diccionario enable row level security;

drop policy if exists "perfil propio" on public.perfiles;
create policy "perfil propio" on public.perfiles for select to authenticated using (user_id = auth.uid());
drop policy if exists "perfil propio editar" on public.perfiles;
create policy "perfil propio editar" on public.perfiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "movimientos propios" on public.movimientos;
create policy "movimientos propios" on public.movimientos for select to authenticated using (user_id = auth.uid());

drop policy if exists "diccionario legible" on public.diccionario;
create policy "diccionario legible" on public.diccionario for select to authenticated using (true);

-- Nadie anónimo toca nada; los usuarios no pueden cambiar campos del sistema de su perfil.
revoke all on all tables in schema public from anon;
revoke update on public.perfiles from authenticated;
grant update (ajustes, nombre) on public.perfiles to authenticated;
revoke all on public.tokens, public.correos from authenticated;

-- v2: se lista todo el correo hasta terminar el historial; luego sólo lo reciente.
alter table public.perfiles add column if not exists historial_completo boolean not null default false;

-- v3: el diccionario guarda más detalle para análisis y para saber quién clasificó.
alter table public.diccionario add column if not exists sub text;           -- subcategoría (p. ej. «bar», «gasolina»)
alter table public.diccionario add column if not exists esencial boolean;   -- necesario (true) o gusto (false)
alter table public.diccionario add column if not exists nombre text;        -- nombre limpio del comercio
alter table public.diccionario add column if not exists confianza real;     -- 0..1 según la IA
alter table public.diccionario add column if not exists ia boolean not null default false; -- ya lo vio la IA
alter table public.diccionario add column if not exists intentos int not null default 0;

-- v4: Gemini se reserva para SharPicks. Tope diario de llamadas y registro de uso.
create table if not exists public.ia_uso (
  dia date primary key,
  llamadas int not null default 0,
  comercios int not null default 0
);
alter table public.ia_uso enable row level security;
revoke all on public.ia_uso from anon, authenticated;
alter table public.perfiles add column if not exists ia_inicial boolean not null default false;
