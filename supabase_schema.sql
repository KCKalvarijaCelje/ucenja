-- ==============================================================================
-- SUPABASE MIGRATION SCHEMA FOR BIBLE TEACHING ARCHIVE (ARHIV SVETOPISEMSKIH NAUKOV)
-- ==============================================================================

-- 1. Enable Required Extensions
create extension if not exists "uuid-ossp";

-- 2. Create Admin Users Table
create table if not exists public.admin_users (
  email text primary key,
  role text not null default 'super_admin',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Create Teachers Table
create table if not exists public.teachers (
  id text primary key,
  full_name text not null,
  slug text not null unique,
  short_bio_sl text default '',
  short_bio_en text default '',
  photo_url text default '',
  active boolean default true,
  created_at timestamptz default now()
);

-- 4. Create Teachings / Sermons Table
create table if not exists public.teachings (
  id text primary key,
  title_sl text not null,
  title_en text default '',
  slug text not null unique,
  teaching_date text not null, -- format: YYYY-MM-DD
  teacher_id text references public.teachers(id) on delete set null,
  series_name_sl text default '',
  series_name_en text default '',
  summary_sl text default '',
  summary_en text default '',
  notes_sl text default '',
  notes_en text default '',
  transcript_sl text default '',
  transcript_en text default '',
  bible_book_code text default 'ROM',
  chapter_start integer default 1,
  chapter_end integer,
  verse_start integer,
  verse_end integer,
  media_type text not null default 'audio', -- 'audio', 'video', 'audio_video'
  youtube_url text default '',
  youtube_video_id text default '',
  audio_url text default '',
  google_drive_file_id text default '',
  duration_text text default '',
  thumbnail_url text default '',
  published boolean default true,
  featured boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. Create Admin Settings Table
create table if not exists public.admin_settings (
  id text primary key default 'global',
  google_drive_folder_id text default '',
  youtube_playlist_id text default '',
  sync_interval_days integer default 7,
  auto_suggest_matching boolean default true,
  updated_at timestamptz default now()
);

-- 6. Create Pending Imports Table (Raw stream queue)
create table if not exists public.pending_imports (
  id text primary key,
  source text not null, -- 'google_drive' | 'youtube'
  title text not null,
  media_url text default '',
  file_id_or_video_id text default '',
  thumbnail_url text default '',
  duration_text text default '',
  imported_at timestamptz default now(),
  file_created_at timestamptz
);

-- 7. Create Import Items Table (Review & matching queue)
create table if not exists public.import_items (
  id text primary key,
  title_sl text not null,
  title_en text default '',
  teacher_id text references public.teachers(id) on delete set null,
  bible_book_code text,
  chapter_start integer,
  verse_start integer,
  verse_end integer,
  media_type text not null default 'audio', -- 'audio' | 'video'
  audio_url text default '',
  youtube_url text default '',
  source text not null, -- 'google_drive' | 'youtube'
  status text not null default 'unreviewed', -- 'unreviewed' | 'linked' | 'new_teaching_created' | 'ignored'
  confidence_score integer default 0,
  teaching_id text references public.teachings(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ==============================================================================
-- INDEXES FOR HIGH-PERFORMANCE SEARCH & FILTERING
-- ==============================================================================
create index if not exists idx_teachings_date on public.teachings (teaching_date desc);
create index if not exists idx_teachings_teacher on public.teachings (teacher_id);
create index if not exists idx_teachings_book on public.teachings (bible_book_code);
create index if not exists idx_teachings_slug on public.teachings (slug);
create index if not exists idx_teachings_published on public.teachings (published);
create index if not exists idx_teachings_featured on public.teachings (featured);
create index if not exists idx_import_items_status on public.import_items (status);
create index if not exists idx_import_items_created on public.import_items (created_at desc);

-- ==============================================================================
-- SECURITY DEFINER HELPER FUNCTION FOR ADMIN AUTHORIZATION
-- ==============================================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.admin_users
    where email = (auth.jwt() ->> 'email')
  );
$$;

-- ==============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- 1. Enable RLS on all tables
alter table public.teachers enable row level security;
alter table public.teachings enable row level security;
alter table public.admin_settings enable row level security;
alter table public.pending_imports enable row level security;
alter table public.import_items enable row level security;
alter table public.admin_users enable row level security;

-- 2. Teachers Policies
create policy "Allow public read active teachers"
  on public.teachers for select
  using (true);

create policy "Allow admins to insert/update/delete teachers"
  on public.teachers for all
  using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');

-- 3. Teachings Policies
create policy "Allow public read published teachings"
  on public.teachings for select
  using (published = true or public.is_admin() or auth.role() = 'service_role');

create policy "Allow admins to manage teachings"
  on public.teachings for all
  using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');

-- 4. Admin Settings Policies
create policy "Allow admins and service role to read settings"
  on public.admin_settings for select
  using (true);

create policy "Allow admins and service role to manage settings"
  on public.admin_settings for all
  using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');

-- 5. Pending Imports Policies
create policy "Allow public read on pending imports for review"
  on public.pending_imports for select
  using (true);

create policy "Allow admins and service role to manage pending imports"
  on public.pending_imports for all
  using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');

-- 6. Import Items Policies
create policy "Allow public read on import items for review"
  on public.import_items for select
  using (true);

create policy "Allow admins and service role to manage import items"
  on public.import_items for all
  using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');

-- 7. Admin Users Policies
create policy "Allow authenticated users to read admin users"
  on public.admin_users for select
  using (true);

create policy "Allow super admins and service role to manage admin users"
  on public.admin_users for all
  using (public.is_admin() or auth.role() = 'service_role')
  with check (public.is_admin() or auth.role() = 'service_role');

-- ==============================================================================
-- REALTIME SUBSCRIPTIONS PUBLICATION
-- ==============================================================================
alter publication supabase_realtime add table public.teachings, public.teachers, public.import_items;

-- ==============================================================================
-- INITIAL SEED DATA
-- ==============================================================================

-- 1. Default Admin Users
insert into public.admin_users (email, role)
values 
  ('ales.lajlar@gmail.com', 'super_admin'),
  ('admin@church.si', 'super_admin')
on conflict (email) do nothing;

-- 2. Default Teachers
insert into public.teachers (id, full_name, slug, short_bio_sl, short_bio_en, photo_url, active)
values 
  (
    't1',
    'Aleš Lajlar',
    'ales-lajlar',
    'Aleš je pastor in pastor-učitelj s strastjo do sistematičnega poučevanja Božje besede in razlaganja praktičnih svetopisemskih resnic za vsakdanje življenje s poudarkom na milosti.',
    'Aleš is a pastor and teaching elder with a passion for systematic teaching of God''s word and explaining practical biblical truths for daily life, emphasizing grace.',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200&h=200',
    true
  ),
  (
    't2',
    'Janez Novak',
    'janez-novak',
    'Janez se osredotoča na zgodovinski kontekst Svetega pisma in spodbuja h globokemu krščanskemu učenstvu ter rasti v veri.',
    'Janez focuses on the historical context of the Bible and encourages deep Christian discipleship and growth in faith.',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200&h=200',
    true
  )
on conflict (id) do nothing;

-- 3. Default Settings
insert into public.admin_settings (id, google_drive_folder_id, youtube_playlist_id, sync_interval_days, auto_suggest_matching)
values 
  ('global', '1A7b_G1p8D3g9P5h9Z6K_DriveFolderId', 'PL_PLy_YTL_YoutubePlaylistId', 7, true)
on conflict (id) do nothing;

-- 4. Initial Seed Teachings
insert into public.teachings (
  id, title_sl, title_en, slug, teaching_date, teacher_id, series_name_sl, series_name_en,
  summary_sl, summary_en, notes_sl, notes_en, transcript_sl, transcript_en,
  bible_book_code, chapter_start, chapter_end, verse_start, verse_end,
  media_type, youtube_url, youtube_video_id, audio_url, google_drive_file_id,
  duration_text, thumbnail_url, published, featured
)
values
  (
    'rec1',
    'Živeti po Duhu',
    'Living according to the Spirit',
    'ziveti-po-duhu',
    '2026-06-10',
    't1',
    'Življenje v Kristusu',
    'Life in Christ',
    'Poučevanje iz Rimljanom 8 o tem, kako hoditi v Duhu. Spoznali bomo, da ni nobene obsodbe za tiste, ki so v Kristusu Jezusu, in kako nas Sveti Duh osvobaja postave greha in smrti.',
    'Teaching from Romans 8 about walking in the Spirit. We will discover there is no condemnation for those in Christ Jesus and how the Holy Spirit sets us free from the law of sin and death.',
    '1. Nobene obsodbe več (Rim 8,1)\n2. Postava Duha življenja v Kristusu nas je osvobodila (Rim 8,2)\n3. Telesni um je sovraštvo proti Bogu; Duhovni um je življenje in mir (Rim 8,6)\n4. Sinovsko nasledstvo - kličemo Abba, Oče! (Rim 8,15)',
    '1. No condemnation anymore (Rom 8:1)\n2. The law of the Spirit of life in Christ has set us free (Rom 8:2)\n3. Mind of the flesh is enmity toward God; spiritual mind is life and peace (Rom 8:6)\n4. Spirit of adoption - we cry Abba, Father! (Rom 8:15)',
    'Danes beremo iz pisma Rimljanom, iz osmega poglavja. To je eno najbolj osrednjih poglavij Nove zaveze, ki govori o naši popolni svobodi v Gospodu...',
    'Today we are reading from the epistle to the Romans, chapter eight. This is one of the most central chapters of the New Testament, talking about our complete freedom in the Lord...',
    'ROM', 8, 8, 1, 17,
    'audio_video',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ',
    'https://example.com/audio/romans8-teaching.mp3', 'drive_file_rom8_1',
    '45:20',
    'https://images.unsplash.com/photo-1504052434569-70ad58210b97?auto=format&fit=crop&q=80&w=400&h=250',
    true, true
  ),
  (
    'rec2',
    'Resnična duhovna avtoriteta',
    'True spiritual authority',
    'resnicna-duhovna-avtoriteta',
    '2026-05-24',
    't1',
    'Obrana evangelija (2. Korinčanom)',
    'Defense of the Gospel (2 Corinthians)',
    'Poglobljena študija drugega pisma Korinčanom. Pastor Aleš razlaga, da se Božja moč popolnoma razodeva v naši slabotnosti ter definira pravo duhovno avtoriteto, ki izvira iz ponižnosti.',
    'In-depth study of the second epistle to the Corinthians. Pastor Aleš explains how God''s power is made perfect in our weakness, defining true spiritual authority rooted in humility.',
    '1. Pavel brani svojo apostolsko poklicanost proti lažnim učiteljem.\n2. Merilo avtoritete ni zunanji uspeh, temveč zvestoba in brazgotine križa.\n3. ''Dovolj ti je moja milost, kajti moja moč se dopolnjuje v slabotnosti.''',
    '1. Paul defends his apostolic calling against false apostles.\n2. The metric of authority is not external success, but faithfulness and scars of the cross.\n3. ''My grace is sufficient for you, for my power is made perfect in weakness.''',
    'Ko Pavel piše cerkvi v Korint, se sooča z obtožbami. Lažni učitelji so se ponašali s svojimi vizijami in močjo. Pavel pa se ponaša s svojo šibkostjo...',
    'When Paul writes to the church in Corinth, he faces accusations. False teachers boasted in their visions and power. Paul boasts in his weaknesses...',
    '2CO', 12, 12, 1, 10,
    'audio_video',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ',
    'https://example.com/audio/2cor12-teaching.mp3', 'drive_file_2cor12_1',
    '38:45',
    'https://images.unsplash.com/photo-1438211394456-73cbf0120551?auto=format&fit=crop&q=80&w=400&h=250',
    true, true
  ),
  (
    'rec3',
    'Gora, ki se je ne smete dotakniti vs. Gora Sion',
    'The mountain you must not touch vs. Mount Zion',
    'gora-ki-se-je-ne-smete-dotakniti-vs-gora-sion',
    '2026-06-03',
    't2',
    'Študij pisma Hebrejcem',
    'Study of Hebrews',
    'Kontrast med staro zavezo (gora Sinaj, prestrašenost, zakon) in novo zavezo (gora Sion, milost, veselo občestvo angelov ter opravičeni v Kristusu).',
    'Contrast between the old covenant (Mount Sinai, fear, law) and the new covenant (Mount Zion, grace, joyful assembly of angels, and those made righteous in Christ).',
    '1. Gore Sinaj se ni bilo dovoljeno dotakniti - simbol strahu (Heb 12,18-21)\n2. Vi pa ste stopili k gori Sion, k mestu živega Boga (Heb 12,22)\n3. Stopili smo k Sredniku nove zaveze, Jezusu, in h krvi kropitve.',
    '1. Mount Sinai could not be touched - symbol of fear (Heb 12:18-21)\n2. But you have come to Mount Zion, the city of the living God (Heb 12:22)\n3. We have come to Jesus, the mediator of a new covenant, and to the sprinkled blood.',
    'Zakon na gori Sinaj je bil podan z grmenjem in ognjem. Ljudstvo je trepetalo. Mojzes je rekel: ''Strah me je in trepečem.'' Toda pod novo zavezo smo poklicani k nečemu povsem drugačnemu...',
    'The law on Mount Sinai was given with thunder and fire. The people trembled. Moses said, ''I am terrified and trembling.'' But under the new covenant, we are called to something completely different...',
    'HEB', 12, 12, 18, 24,
    'audio',
    '', '',
    'https://example.com/audio/hebrews12-teaching.mp3', 'drive_file_heb12',
    '51:10',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=400&h=250',
    true, false
  )
on conflict (id) do nothing;
