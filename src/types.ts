/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Teacher {
  id: string;
  full_name: string;
  slug: string;
  short_bio_sl: string;
  short_bio_en: string;
  photo_url: string;
  active: boolean;
  created_at?: string;
}

export interface Teaching {
  id: string;
  title_sl: string;
  title_en: string;
  slug: string;
  teaching_date: string; // ISO string under the format YYYY-MM-DD
  teacher_id: string; // references Teacher.id
  series_name_sl: string;
  series_name_en: string;
  summary_sl: string;
  summary_en: string;
  notes_sl: string;
  notes_en: string;
  transcript_sl: string;
  transcript_en: string;
  bible_book_code: string; // references BibleBook.code
  chapter_start: number;
  chapter_end?: number;
  verse_start?: number;
  verse_end?: number;
  media_type: 'audio' | 'video' | 'audio_video';
  youtube_url: string;
  youtube_video_id: string;
  audio_url: string;
  google_drive_file_id: string;
  duration_text: string;
  thumbnail_url: string;
  published: boolean;
  featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface BibleBook {
  code: string;
  name_sl: string;
  name_en: string;
  testament: 'OT' | 'NT';
  canonical_order: number;
}

export interface AdminSettings {
  google_drive_folder_id: string;
  youtube_playlist_id: string;
  sync_interval_days: number;
  auto_suggest_matching: boolean;
}

export interface ImportedMediaItem {
  id: string;
  source: 'google_drive' | 'youtube';
  title: string;
  media_url: string;
  file_id_or_video_id: string;
  thumbnail_url?: string;
  duration_text?: string;
  imported_at: string;
  file_created_at?: string;
  // Parsed metadata
  parsed_title?: string;
  parsed_teacher_name?: string;
  parsed_bible_book?: string;
  parsed_chapter?: number;
}

export interface ImportItem {
  id: string;
  title_sl: string;
  title_en?: string;
  teacher_id?: string;
  bible_book_code?: string;
  chapter_start?: number;
  verse_start?: number | null;
  verse_end?: number | null;
  media_type: 'audio' | 'video';
  audio_url?: string;
  youtube_url?: string;
  source: 'google_drive' | 'youtube';
  status: 'unreviewed' | 'linked' | 'new_teaching_created' | 'ignored';
  confidence_score: number;
  created_at: string;
  teaching_id?: string;
  updated_at?: string;
}

export interface MatchSuggestion {
  id: string;
  audio_item: ImportedMediaItem;
  video_item: ImportedMediaItem;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export const BIBLE_BOOKS: BibleBook[] = [
  // Old Testament
  { code: 'GEN', name_sl: '1. Mojzesova (Geneza)', name_en: 'Genesis', testament: 'OT', canonical_order: 1 },
  { code: 'EXO', name_sl: '2. Mojzesova (Eksodus)', name_en: 'Exodus', testament: 'OT', canonical_order: 2 },
  { code: 'LEV', name_sl: '3. Mojzesova (Levitik)', name_en: 'Leviticus', testament: 'OT', canonical_order: 3 },
  { code: 'NUM', name_sl: '4. Mojzesova (Numeri)', name_en: 'Numbers', testament: 'OT', canonical_order: 4 },
  { code: 'DEU', name_sl: '5. Mojzesova (Devteronomij)', name_en: 'Deuteronomy', testament: 'OT', canonical_order: 5 },
  { code: 'JOS', name_sl: 'Jozue', name_en: 'Joshua', testament: 'OT', canonical_order: 6 },
  { code: 'JDG', name_sl: 'Sodniki', name_en: 'Judges', testament: 'OT', canonical_order: 7 },
  { code: 'RUT', name_sl: 'Ruta', name_en: 'Ruth', testament: 'OT', canonical_order: 8 },
  { code: '1SA', name_sl: '1. Samuelova', name_en: '1 Samuel', testament: 'OT', canonical_order: 9 },
  { code: '2SA', name_sl: '2. Samuelova', name_en: '2 Samuel', testament: 'OT', canonical_order: 10 },
  { code: '1KI', name_sl: '1. Kraljev', name_en: '1 Kings', testament: 'OT', canonical_order: 11 },
  { code: '2KI', name_sl: '2. Kraljev', name_en: '2 Kings', testament: 'OT', canonical_order: 12 },
  { code: 'PSA', name_sl: 'Psalmi', name_en: 'Psalms', testament: 'OT', canonical_order: 19 },
  { code: 'PRO', name_sl: 'Pregovori', name_en: 'Proverbs', testament: 'OT', canonical_order: 20 },
  { code: 'ISA', name_sl: 'Izaija', name_en: 'Isaiah', testament: 'OT', canonical_order: 23 },
  { code: 'JER', name_sl: 'Jeremija', name_en: 'Jeremiah', testament: 'OT', canonical_order: 24 },
  { code: 'DAN', name_sl: 'Daniel', name_en: 'Daniel', testament: 'OT', canonical_order: 27 },
  
  // New Testament
  { code: 'MAT', name_sl: 'Matej', name_en: 'Matthew', testament: 'NT', canonical_order: 40 },
  { code: 'MRK', name_sl: 'Marko', name_en: 'Mark', testament: 'NT', canonical_order: 41 },
  { code: 'LUK', name_sl: 'Luka', name_en: 'Luke', testament: 'NT', canonical_order: 42 },
  { code: 'JHN', name_sl: 'Janez', name_en: 'John', testament: 'NT', canonical_order: 43 },
  { code: 'ACT', name_sl: 'Apostolska dela', name_en: 'Acts', testament: 'NT', canonical_order: 44 },
  { code: 'ROM', name_sl: 'Rimljanom', name_en: 'Romans', testament: 'NT', canonical_order: 45 },
  { code: '1CO', name_sl: '1. Korinčanom', name_en: '1 Corinthians', testament: 'NT', canonical_order: 46 },
  { code: '2CO', name_sl: '2. Korinčanom', name_en: '2 Corinthians', testament: 'NT', canonical_order: 47 },
  { code: 'GAL', name_sl: 'Galačanom', name_en: 'Galatians', testament: 'NT', canonical_order: 48 },
  { code: 'EFE', name_sl: 'Efežanom', name_en: 'Ephesians', testament: 'NT', canonical_order: 49 },
  { code: 'PHP', name_sl: 'Filipljanom', name_en: 'Philippians', testament: 'NT', canonical_order: 50 },
  { code: 'COL', name_sl: 'Kološanom', name_en: 'Colossians', testament: 'NT', canonical_order: 51 },
  { code: '1TH', name_sl: '1. Tesaloničanom', name_en: '1 Thessalonians', testament: 'NT', canonical_order: 52 },
  { code: '2TH', name_sl: '2. Tesaloničanom', name_en: '2 Thessalonians', testament: 'NT', canonical_order: 53 },
  { code: '1TI', name_sl: '1. Timoteju', name_en: '1 Timothy', testament: 'NT', canonical_order: 54 },
  { code: '2TI', name_sl: '2. Timoteju', name_en: '2 Timothy', testament: 'NT', canonical_order: 55 },
  { code: 'TIT', name_sl: 'Titu', name_en: 'Titus', testament: 'NT', canonical_order: 56 },
  { code: 'PHM', name_sl: 'Filemonu', name_en: 'Philemon', testament: 'NT', canonical_order: 57 },
  { code: 'HEB', name_sl: 'Hebrejcem', name_en: 'Hebrews', testament: 'NT', canonical_order: 58 },
  { code: 'JAS', name_sl: 'Jakob', name_en: 'James', testament: 'NT', canonical_order: 59 },
  { code: '1PE', name_sl: '1. Petrovo', name_en: '1 Peter', testament: 'NT', canonical_order: 60 },
  { code: '2PE', name_sl: '2. Petrovo', name_en: '2 Peter', testament: 'NT', canonical_order: 61 },
  { code: '1JN', name_sl: '1. Janezovo', name_en: '1 John', testament: 'NT', canonical_order: 62 },
  { code: 'REV', name_sl: 'Razodetje', name_en: 'Revelation', testament: 'NT', canonical_order: 66 }
];

export const BIBLE_BOOKS_MAP = BIBLE_BOOKS.reduce((acc, book) => {
  acc[book.code] = book;
  return acc;
}, {} as Record<string, BibleBook>);
