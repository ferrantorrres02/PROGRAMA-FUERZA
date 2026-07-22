-- ============================================================
-- Esquema de base de datos para el Programa de Fuerza
-- Ejecuta esto en Supabase: Panel > SQL Editor > New query > Run
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists athletes (
  id uuid primary key default gen_random_uuid(),
  token uuid unique not null default gen_random_uuid(),
  name text not null,
  age text,
  sport text,
  objective text,
  level text,
  days text,
  equipment text,
  limitations text,
  plan jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  day_index int not null,
  done_at timestamptz not null default now()
);

alter table athletes enable row level security;
alter table logs enable row level security;

-- Solo un usuario autenticado (tú, el admin) puede leer/escribir directamente
-- desde el navegador. Los alumnos NUNCA acceden con estas políticas: entran
-- por las funciones del servidor (/api/athlete-data, /api/athlete-mark-done),
-- que usan la clave "service role" y por tanto se saltan estas reglas de forma
-- controlada, solo tras comprobar que el token es válido.

create policy "admin lee atletas" on athletes
  for select using (auth.role() = 'authenticated');
create policy "admin inserta atletas" on athletes
  for insert with check (auth.role() = 'authenticated');
create policy "admin actualiza atletas" on athletes
  for update using (auth.role() = 'authenticated');
create policy "admin borra atletas" on athletes
  for delete using (auth.role() = 'authenticated');

create policy "admin lee logs" on logs
  for select using (auth.role() = 'authenticated');
create policy "admin borra logs" on logs
  for delete using (auth.role() = 'authenticated');

-- Importante: no se crea ninguna política para el rol "anon", así que
-- cualquier acceso público directo a la base de datos queda bloqueado.
