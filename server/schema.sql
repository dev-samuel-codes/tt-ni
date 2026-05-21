create table if not exists app_users (
  id varchar(128) primary key,
  email varchar(255) null,
  display_name varchar(255) null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp
);

create table if not exists app_user_profiles (
  user_id varchar(128) primary key,
  gender varchar(16) not null,
  birth_year int not null,
  height_cm decimal(6,2) null,
  weight_kg decimal(6,2) null,
  pregnancy_status varchar(32) not null default 'none',
  lactation_status boolean not null default false,
  consent_accepted boolean not null default false,
  updated_at timestamp default current_timestamp on update current_timestamp,
  constraint fk_user_profiles_user foreign key (user_id) references app_users(id) on delete cascade
);

create table if not exists app_user_conditions (
  id varchar(64) primary key,
  user_id varchar(128) not null,
  condition_code varchar(255) not null,
  condition_name varchar(255) not null,
  severity varchar(32) not null default 'notice',
  created_at timestamp default current_timestamp,
  unique key user_condition_unique (user_id, condition_code),
  constraint fk_user_conditions_user foreign key (user_id) references app_users(id) on delete cascade
);

create table if not exists app_user_medications (
  id varchar(64) primary key,
  user_id varchar(128) not null,
  medication_name varchar(255) not null,
  dosage_text text null,
  frequency varchar(255) null,
  memo text null,
  created_at timestamp default current_timestamp,
  constraint fk_user_medications_user foreign key (user_id) references app_users(id) on delete cascade
);

create table if not exists app_supplement_products (
  id varchar(64) primary key,
  owner_user_id varchar(128) not null,
  product_name varchar(255) not null,
  brand_name varchar(255) null,
  source_type varchar(32) not null default 'manual',
  label_image_path text null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  constraint fk_supplement_products_user foreign key (owner_user_id) references app_users(id) on delete cascade
);

create table if not exists app_supplement_ingredients (
  id varchar(64) primary key,
  product_id varchar(64) not null,
  nutrient_id varchar(128) null,
  raw_name varchar(255) not null,
  standard_name varchar(255) not null,
  amount decimal(18,6) null,
  unit varchar(32) not null default 'mg',
  amount_per_daily_serving decimal(18,6) null,
  confidence decimal(6,4) not null default 1,
  review_required boolean not null default false,
  created_at timestamp default current_timestamp,
  constraint fk_supplement_ingredients_product foreign key (product_id) references app_supplement_products(id) on delete cascade
);

create table if not exists app_user_supplements (
  id varchar(64) primary key,
  user_id varchar(128) not null,
  product_id varchar(64) not null,
  daily_servings decimal(8,3) not null default 1,
  intake_time varchar(255) null,
  active boolean not null default true,
  memo text null,
  created_at timestamp default current_timestamp,
  unique key user_product_unique (user_id, product_id),
  constraint fk_user_supplements_user foreign key (user_id) references app_users(id) on delete cascade,
  constraint fk_user_supplements_product foreign key (product_id) references app_supplement_products(id) on delete cascade
);

create table if not exists app_analysis_reports (
  id varchar(64) primary key,
  user_id varchar(128) not null,
  status_summary_json json not null,
  total_nutrients_json json not null,
  duplicate_items_json json not null,
  interaction_warnings_json json not null,
  recommendations_json json not null,
  synergy_recommendations_json json not null,
  antagonism_warnings_json json not null,
  created_at timestamp default current_timestamp,
  constraint fk_analysis_reports_user foreign key (user_id) references app_users(id) on delete cascade
);

create table if not exists app_chat_sessions (
  id varchar(64) primary key,
  user_id varchar(128) not null,
  title varchar(255) not null default '새 대화',
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  constraint fk_chat_sessions_user foreign key (user_id) references app_users(id) on delete cascade
);

create table if not exists app_chat_messages (
  id varchar(64) primary key,
  session_id varchar(64) not null,
  role varchar(32) not null,
  content longtext not null,
  created_at timestamp default current_timestamp,
  constraint fk_chat_messages_session foreign key (session_id) references app_chat_sessions(id) on delete cascade
);

create index if not exists idx_chat_messages_session_created on app_chat_messages(session_id, created_at);
create index if not exists idx_chat_sessions_user_updated on app_chat_sessions(user_id, updated_at);
