-- Points Tracker schema
-- Paste this entire file into Supabase SQL Editor and click "Run"

create table if not exists settings (
  id int primary key default 1,
  daily_budget int not null default 50,
  weekly_flex int not null default 0,
  constraint single_row check (id = 1)
);

insert into settings (id, daily_budget, weekly_flex)
values (1, 50, 0)
on conflict (id) do nothing;

create table if not exists entries (
  id bigserial primary key,
  kind text not null check (kind in ('food', 'exercise')),
  date date not null,
  name text not null,
  points int not null,
  note text,
  edited boolean default false,
  created_at timestamptz default now()
);

create index if not exists entries_date_idx on entries(date);
create index if not exists entries_date_kind_idx on entries(date, kind);
