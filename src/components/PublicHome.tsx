/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Search, Compass, BookOpen, Clock, PlayCircle, Users, ArrowRight } from "lucide-react";
import { TRANSLATIONS } from "../translations";
import { Teacher, Teaching, BIBLE_BOOKS, BIBLE_BOOKS_MAP } from "../types";

interface PublicHomeProps {
  currentLang: 'sl' | 'en';
  teachers: Teacher[];
  teachings: Teaching[];
  onNavigate: (view: string, params?: any) => void;
}

export function PublicHome({ currentLang, teachers, teachings, onNavigate }: PublicHomeProps) {
  const t = TRANSLATIONS[currentLang];
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onNavigate('archive', { initialQuery: searchQuery.trim() });
    } else {
      onNavigate('archive');
    }
  };

  // Filter out unpublished teachings
  const publishedTeachings = teachings.filter(item => item.published);

  // Get featured teachings (or fallback to latest ones if none are marked)
  const featured = publishedTeachings.filter(item => item.featured).slice(0, 3);
  const featuredList = featured.length > 0 ? featured : publishedTeachings.slice(0, 3);

  // Get recent teachings
  const recentList = publishedTeachings
    .sort((a, b) => new Date(b.teaching_date).getTime() - new Date(a.teaching_date).getTime())
    .slice(0, 5);

  // Get Bible books that actually have sermons in the archive to let members explore them easily
  const booksInArchive = Array.from(new Set(publishedTeachings.map(t => t.bible_book_code)));
  const explorerBooks = BIBLE_BOOKS.filter(book => booksInArchive.includes(book.code)).slice(0, 8);
  // Fallback to major ones if none yet
  const displayBooks = explorerBooks.length > 0 
    ? explorerBooks 
    : BIBLE_BOOKS.filter(b => ['GEN', 'PSA', 'ROM', '1CO', '2CO', 'HEB', 'MAT', 'JHN'].includes(b.code));

  return (
    <div id="public-home" className="space-y-16 py-8">
      {/* 1. Hero / Branding Section */}
      <section id="home-hero" className="relative text-center max-w-4xl mx-auto px-4 space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-mono font-medium">
          <Compass className="w-3.5 h-3.5" />
          <span>{t.app_subtitle}</span>
        </div>
        <h2 className="text-4xl sm:text-5xl font-sans font-semibold tracking-tight text-gray-900 leading-tight">
          {currentLang === 'sl' 
            ? "Odkrijte globino in veselje Božje besede"
            : "Discover the depth and joy of God's Word"
          }
        </h2>
        <p className="text-base text-gray-500 max-w-2xl mx-auto font-sans">
          {currentLang === 'sl'
            ? "Dobrodošli v našem trajnem, dvojezičnem arhivu svetopisemskih naukov. Preiskujte zvočne in video zapise, preučujte zapiske in poglabljajte svoje razumevanje Božje milosti."
            : "Welcome to our permanent, bilingual archive of biblical studies. Search audio and video recordings, read lecture notes, and deepen your understanding of God's grace."
          }
        </p>

        {/* Home Search Bar */}
        <form onSubmit={handleSearchSubmit} id="home-search-form" className="max-w-xl mx-auto mt-8 flex items-center relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-600 transition-colors w-5 h-5" />
          <input
            id="home-search-input"
            type="text"
            placeholder={t.search_placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-28 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm placeholder-gray-400 text-gray-800"
          />
          <button
            id="home-search-submit"
            type="submit"
            className="absolute right-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-medium cursor-pointer hover:bg-emerald-700 transition-colors"
          >
            {t.search}
          </button>
        </form>
      </section>

      {/* 2. Featured Teachings Component */}
      <section id="home-featured" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            <h3 className="text-xl font-semibold tracking-tight text-gray-900">{t.featured_teachings}</h3>
          </div>
          <button
            id="link-view-all"
            onClick={() => onNavigate('archive')}
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
          >
            <span>{t.view_all}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredList.map(item => {
            const teacher = teachers.find(t => t.id === item.teacher_id);
            const book = BIBLE_BOOKS_MAP[item.bible_book_code];
            const displayTitle = currentLang === 'en' && item.title_en ? item.title_en : item.title_sl;
            const displaySeries = currentLang === 'en' && item.series_name_en ? item.series_name_en : item.series_name_sl;

            return (
              <div 
                id={`featured-card-${item.id}`}
                key={item.id}
                onClick={() => onNavigate('teaching-detail', { id: item.id })}
                className="group bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4 hover:shadow-md hover:border-emerald-100 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {item.thumbnail_url ? (
                    <div className="w-full aspect-[16/10] rounded-xl overflow-hidden bg-gray-50 relative">
                      <img 
                        src={item.thumbnail_url} 
                        alt={displayTitle}
                        className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      {item.media_type !== 'audio' && (
                        <div className="absolute right-2 bottom-2 bg-emerald-600/90 text-white rounded p-1">
                          <PlayCircle className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full aspect-[16/10] rounded-xl bg-gradient-to-br from-emerald-50/50 to-emerald-100/20 flex flex-col justify-center items-center p-4 text-center">
                      <p className="text-[10px] font-mono tracking-wider uppercase text-emerald-750 font-medium">{displaySeries || "Sermon"}</p>
                      <span className="text-gray-400 font-serif text-3xl font-bold mt-1">†</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {book && (
                      <span className="text-[11px] font-mono text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                        {currentLang === 'en' ? book.name_en : book.name_sl} {item.chapter_start}
                      </span>
                    )}
                    <h4 className="font-sans font-semibold text-gray-950 text-base leading-snug group-hover:text-emerald-700 transition-colors line-clamp-2">
                      {displayTitle}
                    </h4>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500">
                  <span className="font-medium text-gray-700">{teacher?.full_name || t.filter_teacher}</span>
                  <span className="font-mono text-[10px]">{item.teaching_date}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Browse by Bible Book & Recent List */}
      <section id="home-details-grid" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left column: Recent Sermons list */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
            <Clock className="w-5 h-5 text-emerald-600" />
            <h3 className="text-xl font-semibold tracking-tight text-gray-900">{t.recent_teachings}</h3>
          </div>

          <div className="space-y-4">
            {recentList.map(item => {
              const teacher = teachers.find(t => t.id === item.teacher_id);
              const book = BIBLE_BOOKS_MAP[item.bible_book_code];
              const displayTitle = currentLang === 'en' && item.title_en ? item.title_en : item.title_sl;
              
              return (
                <div 
                  id={`recent-row-${item.id}`}
                  key={item.id}
                  onClick={() => onNavigate('teaching-detail', { id: item.id })}
                  className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 border border-gray-100 rounded-xl cursor-pointer transition-all hover:border-emerald-100/70"
                >
                  <div className="flex items-center gap-4">
                    <span className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-sm font-semibold text-gray-600">
                      {item.media_type === 'audio' ? "🎙️" : "📺"}
                    </span>
                    <div>
                      <h4 className="font-sans font-medium text-sm text-gray-900 hover:text-emerald-700 transition-colors line-clamp-1">
                        {displayTitle}
                      </h4>
                      <p className="text-xs text-gray-400">
                        {teacher?.full_name} • {book ? (currentLang === 'en' ? book.name_en : book.name_sl) : ""} {item.chapter_start}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400 whitespace-nowrap pl-4">{item.teaching_date}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: Explore by Book */}
        <div id="explore-books" className="lg:col-span-5 space-y-6">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
            <Compass className="w-5 h-5 text-emerald-600" />
            <h3 className="text-xl font-semibold tracking-tight text-gray-900">{t.browse_by_book}</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {displayBooks.map(book => (
              <button
                id={`book-explore-${book.code}`}
                key={book.code}
                onClick={() => onNavigate('archive', { bible_book_code: book.code })}
                className="flex items-center justify-between p-3 bg-white hover:bg-emerald-50 border border-gray-100 rounded-xl cursor-pointer transition-colors group text-left"
              >
                <span className="text-xs font-medium text-gray-700 group-hover:text-emerald-800 transition-colors">
                  {currentLang === 'en' ? book.name_en : book.name_sl}
                </span>
                <ArrowRight className="w-3 h-3 text-gray-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Browse by Teacher */}
      <section id="home-teachers" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 bg-slate-50/40 py-12 rounded-3xl border border-gray-100">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-mono font-medium">
            <Users className="w-3.5 h-3.5" />
            <span>{t.teachers}</span>
          </div>
          <h3 className="text-2xl font-semibold tracking-tight text-gray-900">{t.browse_by_teacher}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mt-8">
          {teachers.map(teacher => {
            const teacherTeachingsCount = teachings.filter(i => i.teacher_id === teacher.id && i.published).length;
            const bio = currentLang === 'en' && teacher.short_bio_en ? teacher.short_bio_en : teacher.short_bio_sl;
            
            return (
              <div 
                id={`teacher-card-${teacher.id}`}
                key={teacher.id}
                onClick={() => onNavigate('teacher-detail', { id: teacher.id })}
                className="flex gap-4 p-5 bg-white border border-gray-100 rounded-2xl cursor-pointer hover:border-emerald-200 hover:shadow-sm transition-all group"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-50 shrink-0">
                  <img 
                    src={teacher.photo_url || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200&h=200"} 
                    alt={teacher.full_name}
                    className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-sans font-semibold text-gray-950 group-hover:text-emerald-700 transition-colors">
                    {teacher.full_name}
                  </h4>
                  <p className="text-xs text-gray-500 line-clamp-2">
                    {bio}
                  </p>
                  <span className="inline-block text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                    {t.teachings_count.replace("{count}", String(teacherTeachingsCount))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
