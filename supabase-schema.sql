create table farms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  created_at timestamptz not null default now()
);

create table plots (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  name text not null,
  size_hectares numeric,
  soil_notes text,
  current_crop text,
  health_status text,
  created_at timestamptz not null default now()
);

create table crop_cycles (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  plot_id uuid references plots(id) on delete set null,
  crop text not null,
  variety text,
  stage text not null default 'Planning',
  nursery_date date,
  transplant_date date,
  expected_harvest_start date,
  expected_harvest_end date,
  plants integer not null default 0,
  input_cost numeric not null default 0,
  projected_revenue numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  item text not null,
  category text not null,
  stock numeric not null default 0,
  unit text not null,
  reorder_at numeric not null default 0,
  value numeric not null default 0,
  supplier text,
  created_at timestamptz not null default now()
);

create table farm_tasks (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  crop_cycle_id uuid references crop_cycles(id) on delete set null,
  title text not null,
  task_type text not null,
  due_date date not null,
  status text not null default 'Open',
  assigned_to text,
  created_at timestamptz not null default now()
);

create table farm_logs (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  crop_cycle_id uuid references crop_cycles(id) on delete set null,
  activity_date date not null default current_date,
  activity text not null,
  subject text not null,
  amount numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table harvests (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  crop_cycle_id uuid not null references crop_cycles(id) on delete cascade,
  harvest_date date not null,
  quantity numeric not null,
  unit text not null,
  damaged_quantity numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table sales (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  crop_cycle_id uuid references crop_cycles(id) on delete set null,
  sale_date date not null,
  buyer text,
  quantity numeric not null,
  unit text not null,
  unit_price numeric not null,
  total_amount numeric generated always as (quantity * unit_price) stored,
  payment_status text not null default 'Unpaid',
  created_at timestamptz not null default now()
);

create index crop_cycles_farm_id_idx on crop_cycles(farm_id);
create index farm_tasks_due_date_idx on farm_tasks(due_date);
create index farm_logs_activity_date_idx on farm_logs(activity_date);
create index harvests_crop_cycle_id_idx on harvests(crop_cycle_id);
create index sales_crop_cycle_id_idx on sales(crop_cycle_id);
