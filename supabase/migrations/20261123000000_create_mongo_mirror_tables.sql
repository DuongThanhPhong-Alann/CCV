create table if not exists public.users (
  _id text primary key check (_id ~ '^[0-9a-fA-F]{24}$'),
  name text,
  email text,
  "passwordHash" text,
  "emailVerified" timestamptz,
  image text,
  "createdAt" timestamptz not null default now(),
  revision bigint not null default 1,
  mongo_synced boolean not null default false,
  deleted boolean not null default false,
  document jsonb not null
);

create table if not exists public.diagrams (
  _id text primary key check (_id ~ '^[0-9a-fA-F]{24}$'),
  "ownerId" text,
  name text,
  "taskId" text,
  entities jsonb not null default '[]'::jsonb,
  relations jsonb not null default '[]'::jsonb,
  decorations jsonb not null default '[]'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  revision bigint not null default 1,
  mongo_synced boolean not null default false,
  deleted boolean not null default false,
  document jsonb not null
);

create table if not exists public.tasks (
  _id text primary key check (_id ~ '^[0-9a-fA-F]{24}$'),
  title text,
  description text,
  "createdById" text,
  "createdByName" text,
  "createdByEmail" text,
  "assignedToId" text,
  "assignedToName" text,
  "assignedToEmail" text,
  "sourceTaskId" text,
  status text,
  "diagramId" text,
  "acceptedAt" timestamptz,
  submission jsonb,
  grade jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  revision bigint not null default 1,
  mongo_synced boolean not null default false,
  deleted boolean not null default false,
  document jsonb not null
);

-- Carry forward records if the earlier combined app_records table was already created.
do $$
begin
  if to_regclass('public.app_records') is not null then
    execute $copy_users$
      insert into public.users (
        _id, name, email, "passwordHash", "emailVerified", image, "createdAt",
        revision, mongo_synced, deleted, document
      )
      select
        id, name, email, data->>'passwordHash', nullif(data->>'emailVerified', '')::timestamptz,
        data->>'image', created_at, revision, mongo_synced, deleted,
        jsonb_set(coalesce(data, '{}'::jsonb), '{_id}', to_jsonb(id), true)
      from public.app_records where collection = 'users'
      on conflict (_id) do nothing
    $copy_users$;
    execute $copy_diagrams$
      insert into public.diagrams (
        _id, "ownerId", name, "taskId", entities, relations, decorations,
        "createdAt", "updatedAt", revision, mongo_synced, deleted, document
      )
      select
        id, owner_id, name, data->>'taskId', coalesce(data->'entities', '[]'::jsonb),
        coalesce(data->'relations', '[]'::jsonb), coalesce(data->'decorations', '[]'::jsonb),
        created_at, updated_at, revision, mongo_synced, deleted,
        jsonb_set(coalesce(data, '{}'::jsonb), '{_id}', to_jsonb(id), true)
      from public.app_records where collection = 'diagrams'
      on conflict (_id) do nothing
    $copy_diagrams$;
    execute $copy_tasks$
      insert into public.tasks (
        _id, title, description, "createdById", "createdByName", "createdByEmail",
        "assignedToId", "assignedToName", "assignedToEmail", "sourceTaskId", status,
        "diagramId", "acceptedAt", submission, grade, "createdAt", "updatedAt",
        revision, mongo_synced, deleted, document
      )
      select
        id, data->>'title', data->>'description', data->>'createdById', data->>'createdByName',
        data->>'createdByEmail', data->>'assignedToId', data->>'assignedToName', data->>'assignedToEmail',
        data->>'sourceTaskId', status, data->>'diagramId', nullif(data->>'acceptedAt', '')::timestamptz,
        data->'submission', data->'grade', created_at, updated_at, revision, mongo_synced, deleted,
        jsonb_set(coalesce(data, '{}'::jsonb), '{_id}', to_jsonb(id), true)
      from public.app_records where collection = 'tasks'
      on conflict (_id) do nothing
    $copy_tasks$;
    if to_regclass('public.app_records_legacy') is null then
      execute 'alter table public.app_records rename to app_records_legacy';
    end if;
  end if;
end $$;

create index if not exists users_name_idx on public.users (name) where deleted = false;
create unique index if not exists users_email_unique_idx on public.users (lower(email))
  where deleted = false and email is not null;
create index if not exists diagrams_owner_updated_idx on public.diagrams ("ownerId", "updatedAt" desc)
  where deleted = false;
create index if not exists tasks_owner_updated_idx on public.tasks ("createdById", "updatedAt" desc)
  where deleted = false;
create index if not exists tasks_assignee_updated_idx on public.tasks ("assignedToId", "updatedAt" desc)
  where deleted = false;
create index if not exists tasks_source_idx on public.tasks ("sourceTaskId") where deleted = false;

alter table public.users enable row level security;
alter table public.diagrams enable row level security;
alter table public.tasks enable row level security;

revoke all on table public.users, public.diagrams, public.tasks from anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.users, public.diagrams, public.tasks to service_role;
