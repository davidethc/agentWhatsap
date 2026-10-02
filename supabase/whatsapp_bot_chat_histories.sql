-- Chat history for the n8n "Postgres Chat Memory" node (WhatsApp agent).
-- Same shape n8n creates on its own; created here so it is locked down: RLS on and
-- no API grants, so the public/anon key can never read conversations. n8n connects
-- with the database owner role, which is not affected.
create table if not exists public.n8n_chat_histories (
  id serial primary key,
  session_id varchar(255) not null,
  message jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists n8n_chat_histories_session_id_idx
  on public.n8n_chat_histories (session_id, id);

alter table public.n8n_chat_histories enable row level security;

revoke all on table public.n8n_chat_histories from anon, authenticated;
revoke all on sequence public.n8n_chat_histories_id_seq from anon, authenticated;

comment on table public.n8n_chat_histories is
  'WhatsApp agent (n8n Postgres Chat Memory). Not exposed through the Data API.';
