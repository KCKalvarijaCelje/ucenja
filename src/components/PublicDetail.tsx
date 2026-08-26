/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { ArrowLeft, Volume2, Video, Calendar, User, Book, BookOpen, Clock, AlertTriangle } from "lucide-react";
import { TRANSLATIONS } from "../translations";
import { Teacher, Teaching, BIBLE_BOOKS_MAP } from "../types";
import { getAudioUrl, getMediaUrl } from "../lib/cdn";

interface PublicDetailProps {
  currentLang: 'sl' | 'en';
  teachingId: string;
  teachers: Teacher[];
  teachings: Teaching[];
  onNavigate: (view: string, params?: any) => void;
}

export function PublicDetail({ currentLang, teachingId, teachers, teachings, onNavigate }: PublicDetailProps) {
  const t = TRANSLATIONS[currentLang];
  const [activeTab, setActiveTab] = useState<'summary' | 'notes' | 'transcript'>('summary');

  // Find the current teaching
  const teaching = teachings.find(item => item.id === teachingId);
  const teacher = teaching ? teachers.find(tr => tr.id === teaching.teacher_id) : null;
  const book = teaching ? BIBLE_BOOKS_MAP[teaching.bible_book_code] : null;

  if (!teaching) {
    return (
      <div id="teaching-not-found" className="text-center py-20 bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h3 className="text-lg font-sans font-semibold text-gray-950">Teaching not found</h3>
        <button
          id="btn-back-archive"
          onClick={() => onNavigate('archive')}
          className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition"
        >
          {t.back}
        </button>
      </div>
    );
  }

  // Graceful fallback for English content
  const useFallbackEn = currentLang === 'en' && !teaching.title_en;
  const displayTitle = (currentLang === 'en' && teaching.title_en) ? teaching.title_en : teaching.title_sl;
  const displaySeries = (currentLang === 'en' && teaching.series_name_en) ? teaching.series_name_en : teaching.series_name_sl;
  
  const rawSummary = (currentLang === 'en' && teaching.summary_en) ? teaching.summary_en : teaching.summary_sl;
  const rawNotes = (currentLang === 'en' && teaching.notes_en) ? teaching.notes_en : teaching.notes_sl;
  const rawTranscript = (currentLang === 'en' && teaching.transcript_en) ? teaching.transcript_en : teaching.transcript_sl;

  // Render warnings if fallbacks are applied
  const isSummaryFallback = currentLang === 'en' && teaching.summary_sl && !teaching.summary_en;
  const isNotesFallback = currentLang === 'en' && teaching.notes_sl && !teaching.notes_en;
  const isTranscriptFallback = currentLang === 'en' && teaching.transcript_sl && !teaching.transcript_en;

  // Format bible chapter/verse reference text
  const formattedRef = book 
    ? `${currentLang === 'en' ? book.name_en : book.name_sl} ${teaching.chapter_start}${teaching.verse_start ? `:${teaching.verse_start}${teaching.verse_end ? `-${teaching.verse_end}` : ''}` : ''}`
    : "";

  // Get related teachings: teachings belonging to same series, or same book, or same teacher
  const relatedList = teachings
    .filter(item => item.published && item.id !== teaching.id)
    .filter(item => {
      return item.bible_book_code === teaching.bible_book_code || 
             item.teacher_id === teaching.teacher_id || 
             (item.series_name_sl && item.series_name_sl === teaching.series_name_sl);
    })
    .slice(0, 3);

  return (
    <div id="teaching-detail-page" className="space-y-8 py-6 max-w-5xl mx-auto">
      {/* Back button */}
      <button
        id="btn-back-to-archive"
        onClick={() => onNavigate('archive')}
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-emerald-700 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{t.back}</span>
      </button>

      {/* Main Grid: Info card and Youtube / Audio elements */}
      <div id="detail-main-grid" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Media Player & Content tabs */}
        <div className="lg:col-span-8 space-y-6">
          {/* Embedding Media Sections */}
          {teaching.media_type !== 'audio' && teaching.youtube_video_id ? (
            <div id="video-stream-box" className="w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-sm border border-gray-100">
              <iframe
                id="yt-embed-iframe"
                src={`https://www.youtube.com/embed/${teaching.youtube_video_id}`}
                title={displayTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
          ) : teaching.thumbnail_url ? (
            <div className="w-full aspect-[16/10] rounded-2xl overflow-hidden bg-gray-50 border border-gray-100">
              <img 
                src={getMediaUrl(teaching.thumbnail_url)} 
                alt={displayTitle} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : null}

          {/* Audio Player Row */}
          {(teaching.media_type === 'audio' || teaching.media_type === 'audio_video') && teaching.audio_url && (
            <div id="audio-stream-box" className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between text-xs text-emerald-800 font-medium">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 animate-pulse text-emerald-600" />
                  <span>{t.listen_audio}</span>
                </span>
                <span className="font-mono text-[10px] bg-white rounded border px-1.5 py-0.5">{teaching.duration_text || ""}</span>
              </div>
              <audio
                id="html5-audio-element"
                controls
                src={getAudioUrl(teaching.audio_url)}
                className="w-full accent-emerald-600"
              />
            </div>
          )}

          {/* Bilingual Fallback Notice if Title/Content missing in English */}
          {useFallbackEn && (
            <div id="bilingual-fallback-banner" className="flex items-center gap-2.5 p-3.5 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{t.not_translated_fallback}</span>
            </div>
          )}

          {/* Document Content Tabs Switcher */}
          <div id="content-tabs-container" className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex border-b border-gray-150 bg-gray-50/60 p-1">
              <button
                id="tab-btn-summary"
                onClick={() => setActiveTab('summary')}
                className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'summary' ? "bg-white text-gray-900 shadow-sm border border-gray-150" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {t.tab_summary}
              </button>
              <button
                id="tab-btn-notes"
                onClick={() => setActiveTab('notes')}
                className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'notes' ? "bg-white text-gray-900 shadow-sm border border-gray-150" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {t.tab_notes}
              </button>
              <button
                id="tab-btn-transcript"
                onClick={() => setActiveTab('transcript')}
                className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'transcript' ? "bg-white text-gray-900 shadow-sm border border-gray-150" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {t.tab_transcript}
              </button>
            </div>

            <div className="p-6">
              {/* Active Tab rendering */}
              {activeTab === 'summary' && (
                <div id="tab-summary-content" className="space-y-3">
                  {isSummaryFallback && (
                    <span className="inline-block text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100">{t.not_translated_fallback}</span>
                  )}
                  <p className="text-sm text-gray-700 leading-relaxed font-sans whitespace-pre-wrap">
                    {rawSummary || t.no_summary}
                  </p>
                </div>
              )}

              {activeTab === 'notes' && (
                <div id="tab-notes-content" className="space-y-3">
                  {isNotesFallback && (
                    <span className="inline-block text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100">{t.not_translated_fallback}</span>
                  )}
                  <p className="text-sm text-gray-700 leading-relaxed font-sans whitespace-pre-wrap">
                    {rawNotes || t.no_notes}
                  </p>
                </div>
              )}

              {activeTab === 'transcript' && (
                <div id="tab-transcript-content" className="space-y-3">
                  {isTranscriptFallback && (
                    <span className="inline-block text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100">{t.not_translated_fallback}</span>
                  )}
                  <p className="text-sm text-gray-700 leading-relaxed font-sans whitespace-pre-wrap">
                    {rawTranscript || t.no_transcript}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Teaching Metadata Panel & Author Profile */}
        <div className="lg:col-span-4 space-y-6">
          <div id="metadata-panel-card" className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 space-y-4">
            <h3 className="font-sans font-semibold text-lg text-gray-950 border-b border-gray-50 pb-2.5">
              {displayTitle}
            </h3>

            {/* Teaching Series */}
            {displaySeries && (
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400">{t.filter_series}</span>
                <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded inline-block">
                  {displaySeries}
                </p>
              </div>
            )}

            {/* Verse References */}
            {formattedRef && (
              <div className="space-y-0.5 flex flex-col">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400">{t.bible_reference}</span>
                <span className="text-sm font-semibold text-gray-800 leading-relaxed flex items-center gap-1.5">
                  <Book className="w-4 h-4 text-emerald-600" />
                  <span>{formattedRef}</span>
                </span>
              </div>
            )}

            {/* Date published */}
            <div className="space-y-0.5 flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400">{t.published_on}</span>
              <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>{teaching.teaching_date}</span>
              </span>
            </div>

            {/* Teacher Details Box */}
            {teacher && (
              <div 
                id="author-profile-box"
                onClick={() => onNavigate('teacher-detail', { id: teacher.id })}
                className="pt-4 border-t border-gray-50 flex items-center gap-3 cursor-pointer group hover:bg-gray-50 p-2 rounded-xl transition-colors"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 border border-gray-50 shrink-0">
                  <img 
                    src={teacher.photo_url || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200&h=200"} 
                    alt={teacher.full_name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400">{t.filter_teacher}</span>
                  <p className="text-xs font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">
                    {teacher.full_name}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Related/Recommend teachings column */}
          <div id="related-sermons-panel" className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide font-mono flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <BookOpen className="w-4 h-4 text-emerald-650" />
              <span>{t.related_teachings}</span>
            </h4>
            
            {relatedList.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No similar teachings found.</p>
            ) : (
              <div className="space-y-3">
                {relatedList.map(item => {
                  const itemTitle = currentLang === 'en' && item.title_en ? item.title_en : item.title_sl;
                  return (
                    <div
                      id={`related-card-${item.id}`}
                      key={item.id}
                      onClick={() => {
                        onNavigate('teaching-detail', { id: item.id });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="p-3 bg-white hover:bg-gray-50 border border-gray-100 rounded-xl cursor-pointer transition-all hover:border-emerald-100 text-left space-y-1 shadow-xs"
                    >
                      <h5 className="font-sans font-semibold text-xs text-gray-900 line-clamp-2 hover:text-emerald-700 transition-colors leading-snug">
                        {itemTitle}
                      </h5>
                      <div className="flex justify-between items-center text-[10px] text-gray-400">
                        <span>{item.teaching_date}</span>
                        <span className="bg-emerald-50 text-emerald-750 px-1.5 py-0.5 rounded font-mono font-bold">
                          {BIBLE_BOOKS_MAP[item.bible_book_code] ? (currentLang === 'en' ? BIBLE_BOOKS_MAP[item.bible_book_code].name_en : BIBLE_BOOKS_MAP[item.bible_book_code].name_sl) : item.bible_book_code}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
