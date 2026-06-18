create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

do $$
declare
  existing_id uuid;
begin
  select id
  into existing_id
  from vault.decrypted_secrets
  where name = 'hourly_order_summary_project_url'
  limit 1;

  if existing_id is null then
    perform vault.create_secret(
      'https://ejoyopfapvulkegsqfxb.supabase.co',
      'hourly_order_summary_project_url',
      'Supabase project URL for the hosted hourly order summary cron job'
    );
  else
    perform vault.update_secret(
      existing_id,
      'https://ejoyopfapvulkegsqfxb.supabase.co',
      'hourly_order_summary_project_url',
      'Supabase project URL for the hosted hourly order summary cron job'
    );
  end if;
end
$$;

do $$
declare
  existing_id uuid;
begin
  select id
  into existing_id
  from vault.decrypted_secrets
  where name = 'hourly_order_summary_service_role_key'
  limit 1;

  if existing_id is null then
    perform vault.create_secret(
      'REPLACE_IN_SUPABASE_VAULT',
      'hourly_order_summary_service_role_key',
      'Service role key for invoking the hosted hourly order summary Edge Function'
    );
  else
    perform vault.update_secret(
      existing_id,
      'REPLACE_IN_SUPABASE_VAULT',
      'hourly_order_summary_service_role_key',
      'Service role key for invoking the hosted hourly order summary Edge Function'
    );
  end if;
end
$$;

drop trigger if exists hourly_order_summary_queue_set_updated_at
  on public.hourly_order_summary_queue;

drop table if exists automation.hourly_order_summary_queue;

create table if not exists public.hourly_order_summary_queue (
  stripe_checkout_session_id text primary key,
  customer_name text not null,
  contact_info text not null,
  delivery_option text not null,
  address text,
  total_amount integer not null,
  payment_status text not null,
  placed_at timestamptz not null,
  internal_subject text not null,
  internal_message text not null,
  customer_message text not null,
  delivery_target text not null,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed')),
  delivery_attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hourly_order_summary_queue_delivery_status_idx
  on public.hourly_order_summary_queue (delivery_status, placed_at);

alter table public.hourly_order_summary_queue enable row level security;

revoke all on public.hourly_order_summary_queue from anon, authenticated;

create or replace function public.set_hourly_order_summary_queue_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists hourly_order_summary_queue_set_updated_at
  on public.hourly_order_summary_queue;

create trigger hourly_order_summary_queue_set_updated_at
before update on public.hourly_order_summary_queue
for each row
execute function public.set_hourly_order_summary_queue_updated_at();

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'hourly-order-summary-text'
  ) then
    perform cron.unschedule('hourly-order-summary-text');
  end if;
end
$$;

select cron.schedule(
  'hourly-order-summary-text',
  '5 * * * *',
  $cron$
  select
    net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'hourly_order_summary_project_url')
        || '/functions/v1/hourly-order-summary-text',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'hourly_order_summary_service_role_key')
      ),
      body := jsonb_build_object(
        'trigger', 'pg_cron',
        'scheduled_at', now()
      ),
      timeout_milliseconds := 60000
    );
  $cron$
);
