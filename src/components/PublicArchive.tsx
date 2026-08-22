/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from "react";
import { Search, Filter, X, Volume2, Video, CheckSquare, ListFilter, SlidersHorizontal, BookOpen } from "lucide-react";
import { TRANSLATIONS } from "../translations";
import { Teacher, Teaching, BIBLE_BOOKS, BIBLE_BOOKS_MAP } from "../types";

interface PublicArchiveProps {
  currentLang: 'sl' | 'en';
  teachers: Teacher[];
  teachings: Teaching[];
  onNavigate: (view: string, params?: any) => void;
  initialFilters?: {
    bible_book_code?: string;
    initialQuery?: string;
  };
}

export function PublicArchive({ currentLang, teachers, teachings, onNavigate, initialFilters }: PublicArchiveProps) {
  const t = TRANSLATIONS[currentLang];

  // Filters State
  const [searchQuery, setSearchQuery] = useState(initialFilters?.initialQuery || "");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedBook, setSelectedBook] = useState(initialFilters?.bible_book_code || "");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedSeries, setSelectedSeries] = useState("");
  const [selectedMediaType, setSelectedMediaType] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");

  // Filter lists derived dynamically from dataset for rich, error-free filters
  const uniqueYears = useMemo(() => {
    const years = teachings
      .filter(item => item.published && item.teaching_date)
      .map(item => item.teaching_date.split('-')[0]);
    return Array.from(new Set(years)).sort((a, b) => b.localeCompare(a));
  }, [teachings]);

  const uniqueSeries = useMemo(() => {
    const series = teachings
      .filter(item => item.published)
      .map(item => currentLang === 'en' && item.series_name_en ? item.series_name_en : item.series_name_sl)
      .filter(Boolean);
    return Array.from(new Set(series)).sort();
  }, [teachings, currentLang]);

  // Handle clearing all filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedTeacher("");
    setSelectedBook("");
    setSelectedChapter("");
    setSelectedYear("");
    setSelectedSeries("");
    setSelectedMediaType("");
    setSortBy("date_desc");
  };

  // Filter and Sort dataset
  const filteredTeachings = useMemo(() => {
    let result = teachings.filter(item => item.published);

    // 1. Keyword search (Slovenian and English)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => {
        const teacher = teachers.find(t => t.id === item.teacher_id);
        const book = BIBLE_BOOKS_MAP[item.bible_book_code];
        
        return (
          item.title_sl?.toLowerCase().includes(q) ||
          item.title_en?.toLowerCase().includes(q) ||
          item.series_name_sl?.toLowerCase().includes(q) ||
          item.series_name_en?.toLowerCase().includes(q) ||
          item.summary_sl?.toLowerCase().includes(q) ||
          item.summary_en?.toLowerCase().includes(q) ||
          item.notes_sl?.toLowerCase().includes(q) ||
          item.notes_en?.toLowerCase().includes(q) ||
          teacher?.full_name?.toLowerCase().includes(q) ||
          book?.name_sl?.toLowerCase().includes(q) ||
          book?.name_en?.toLowerCase().includes(q)
        );
      });
    }

    // 2. Filter by Teacher
    if (selectedTeacher) {
      result = result.filter(item => item.teacher_id === selectedTeacher);
    }

    // 3. Filter by Bible Book
    if (selectedBook) {
      result = result.filter(item => item.bible_book_code === selectedBook);
    }

    // 4. Filter by Bible Chapter
    if (selectedChapter) {
      result = result.filter(item => item.chapter_start === parseInt(selectedChapter, 10));
    }

    // 5. Filter by Year
    if (selectedYear) {
      result = result.filter(item => item.teaching_date?.startsWith(selectedYear));
    }

    // 6. Filter by Series
    if (selectedSeries) {
      result = result.filter(item => {
        const itemSeriesName = currentLang === 'en' && item.series_name_en ? item.series_name_en : item.series_name_sl;
        return itemSeriesName === selectedSeries;
      });
    }

    // 7. Filter by Media Type
    if (selectedMediaType) {
      if (selectedMediaType === 'audio') {
        result = result.filter(item => item.media_type === 'audio' || item.media_type === 'audio_video');
      } else if (selectedMediaType === 'video') {
        result = result.filter(item => item.media_type === 'video' || item.media_type === 'audio_video');
      } else if (selectedMediaType === 'audio_video') {
        result = result.filter(item => item.media_type === 'audio_video');
      }
    }

    // 8. Sorting
    result.sort((a, b) => {
      if (sortBy === "date_desc") {
        return new Date(b.teaching_date).getTime() - new Date(a.teaching_date).getTime();
      } else if (sortBy === "date_asc") {
        return new Date(a.teaching_date).getTime() - new Date(b.teaching_date).getTime();
      } else if (sortBy === "title_asc") {
        const titleA = currentLang === 'en' && a.title_en ? a.title_en : a.title_sl;
        const titleB = currentLang === 'en' && b.title_en ? b.title_en : b.title_sl;
        return titleA.localeCompare(titleB);
      }
      return 0;
    });

    return result;
  }, [teachings, searchQuery, selectedTeacher, selectedBook, selectedChapter, selectedYear, selectedSeries, selectedMediaType, sortBy, teachers, currentLang]);

  return (
    <div id="public-archive" className="space-y-8 py-6">
      <div className="border-b border-gray-100 pb-4 space-y-1">
        <h2 className="text-3xl font-sans font-semibold tracking-tight text-gray-900">{t.archive}</h2>
        <p className="text-sm text-gray-500">{t.app_subtitle}</p>
      </div>

      {/* SEARCH AND FILTER BAR PANEL */}
      <div id="archive-filter-panel" className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 space-y-4">
        {/* Keyword Search */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              id="archive-keyword-input"
              type="text"
              placeholder={t.search_teachings}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm placeholder-gray-400 text-gray-800"
            />
            {searchQuery && (
              <button 
                id="clear-keyword-btn"
                onClick={() => setSearchQuery("")} 
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-150 inline-flex items-center"
              >
                <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
          
          <button
            id="btn-reset-filters"
            onClick={handleResetFilters}
            className="px-4 py-2.5 bg-gray-50 hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 font-medium text-xs border border-gray-200 hover:border-emerald-250 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{t.clear_search}</span>
          </button>
        </div>

        {/* Dynamic Select Filters Grid */}
        <div id="filters-grid" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          {/* 1. Teacher Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-semibold">{t.filter_teacher}</label>
            <select
              id="select-teacher"
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="w-full text-xs bg-white border border-gray-200 rounded-lg p-2 text-gray-700 focus:outline-none focus:border-emerald-500"
            >
              <option value="">{t.all}</option>
              {teachers.filter(tr => tr.active).map(tr => (
                <option key={tr.id} value={tr.id}>{tr.full_name}</option>
              ))}
            </select>
          </div>

          {/* 2. Bible Book Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-semibold">{t.filter_book}</label>
            <select
              id="select-book"
              value={selectedBook}
              onChange={(e) => setSelectedBook(e.target.value)}
              className="w-full text-xs bg-white border border-gray-200 rounded-lg p-2 text-gray-700 focus:outline-none focus:border-emerald-500"
            >
              <option value="">{t.all}</option>
              {BIBLE_BOOKS.map(book => (
                <option key={book.code} value={book.code}>
                  {currentLang === 'en' ? book.name_en : book.name_sl}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Chapter Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-semibold">{t.filter_chapter}</label>
            <input
              id="input-chapter"
              type="number"
              min="1"
              placeholder={t.all}
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(e.target.value)}
              className="w-full text-xs bg-white border border-gray-200 rounded-lg p-1.5 text-gray-700 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* 4. Year Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-semibold">{t.filter_year}</label>
            <select
              id="select-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full text-xs bg-white border border-gray-200 rounded-lg p-2 text-gray-700 focus:outline-none focus:border-emerald-500"
            >
              <option value="">{t.all}</option>
              {uniqueYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* 5. Sermon Series Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-semibold">{t.filter_series}</label>
            <select
              id="select-series"
              value={selectedSeries}
              onChange={(e) => setSelectedSeries(e.target.value)}
              className="w-full text-xs bg-white border border-gray-200 rounded-lg p-2 text-gray-700 focus:outline-none focus:border-emerald-500"
            >
              <option value="">{t.all}</option>
              {uniqueSeries.map(ser => (
                <option key={ser} value={ser}>{ser}</option>
              ))}
            </select>
          </div>

          {/* 6. Media type Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-semibold">{t.filter_media_type}</label>
            <select
              id="select-mediatype"
              value={selectedMediaType}
              onChange={(e) => setSelectedMediaType(e.target.value)}
              className="w-full text-xs bg-white border border-gray-200 rounded-lg p-2 text-gray-700 focus:outline-none focus:border-emerald-500"
            >
              <option value="">{t.all}</option>
              <option value="audio">🎙️ {t.audio}</option>
              <option value="video">📺 {t.video}</option>
              <option value="audio_video">🎙️+📺 {t.audio_video}</option>
            </select>
          </div>
        </div>
      </div>

      {/* METADATA RESULTS HEADER */}
      <div id="results-count-container" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
          {t.results_found.replace("{count}", String(filteredTeachings.length))}
        </span>

        {/* Sorting options */}
        <div id="sorting-picker" className="flex items-center gap-2">
          <label className="text-xs text-gray-400">{t.sort_by}:</label>
          <select
            id="select-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs bg-white border border-gray-200 rounded-lg p-1.5 text-gray-700 focus:outline-none focus:border-emerald-500 font-medium"
          >
            <option value="date_desc">{t.sort_date_desc}</option>
            <option value="date_asc">{t.sort_date_asc}</option>
            <option value="title_asc">{t.sort_title_asc}</option>
          </select>
        </div>
      </div>

      {/* SEARCH RESULTS LAYOUT */}
      {filteredTeachings.length === 0 ? (
        <div id="archive-empty" className="text-center py-20 bg-white border border-gray-100 rounded-2xl p-6">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-sm font-medium">{t.no_results}</p>
          <button
            id="btn-clear-archive-filters"
            onClick={handleResetFilters}
            className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            {t.clear_search}
          </button>
        </div>
      ) : (
        <div id="archive-results-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeachings.map(item => {
            const teacher = teachers.find(tr => tr.id === item.teacher_id);
            const book = BIBLE_BOOKS_MAP[item.bible_book_code];
            const displayTitle = currentLang === 'en' && item.title_en ? item.title_en : item.title_sl;
            const displaySeries = currentLang === 'en' && item.series_name_en ? item.series_name_en : item.series_name_sl;
            const displaySummary = currentLang === 'en' && item.summary_en ? item.summary_en : item.summary_sl;

            return (
              <div
                id={`teaching-card-${item.id}`}
                key={item.id}
                onClick={() => onNavigate('teaching-detail', { id: item.id })}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md hover:border-emerald-100/85 transition-all cursor-pointer"
              >
                {/* Visual Header */}
                <div className="p-5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    {/* Normalized localized bible book tag */}
                    {book && (
                      <span className="text-[10px] font-mono text-emerald-750 font-bold bg-emerald-50/75 px-2.5 py-1 rounded-md uppercase tracking-wider">
                        {currentLang === 'en' ? book.name_en : book.name_sl} {item.chapter_start}
                        {item.verse_start ? `:${item.verse_start}${item.verse_end ? `-${item.verse_end}` : ''}` : ''}
                      </span>
                    )}
                    {/* Media icon identifier */}
                    <div id="media-pill" className="flex items-center gap-1 bg-gray-50 border border-gray-100 px-2 py-1 rounded text-[10px] font-mono text-gray-400">
                      {item.media_type === 'audio' && <Volume2 className="w-3.5 h-3.5 text-gray-400" />}
                      {item.media_type === 'video' && <Video className="w-3.5 h-3.5 text-gray-400" />}
                      {item.media_type === 'audio_video' && (
                        <>
                          <Volume2 className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-200">|</span>
                          <Video className="w-3 h-3 text-gray-400" />
                        </>
                      )}
                      <span className="lowercase font-sans">{item.duration_text || ""}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {/* Series tag */}
                    {displaySeries && (
                      <p className="text-[11px] font-medium text-amber-700/80 uppercase tracking-wide font-mono">
                        {displaySeries}
                      </p>
                    )}
                    <h3 className="font-sans font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors leading-snug line-clamp-2">
                      {displayTitle}
                    </h3>
                  </div>

                  <p className="text-xs text-gray-450 line-clamp-3 leading-relaxed">
                    {displaySummary || t.no_summary}
                  </p>
                </div>

                {/* Card footer (Date & Teacher full name) */}
                <div className="px-5 py-4 border-t border-gray-50/80 bg-slate-50/20 flex items-center justify-between text-xs text-gray-500">
                  <span className="font-medium text-gray-900">{teacher?.full_name || "Pastor"}</span>
                  <span className="font-mono text-[10px] text-gray-400">{item.teaching_date}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
