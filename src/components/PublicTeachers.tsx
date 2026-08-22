/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Users, BookOpen, Volume2, Video, Clock } from "lucide-react";
import { TRANSLATIONS } from "../translations";
import { Teacher, Teaching, BIBLE_BOOKS_MAP } from "../types";

interface PublicTeachersProps {
  currentLang: 'sl' | 'en';
  teachers: Teacher[];
  teachings: Teaching[];
  selectedTeacherId?: string;
  onNavigate: (view: string, params?: any) => void;
}

export function PublicTeachers({ currentLang, teachers, teachings, selectedTeacherId, onNavigate }: PublicTeachersProps) {
  const t = TRANSLATIONS[currentLang];

  // If a specific teacher is selected, render the Teacher Detail View
  if (selectedTeacherId) {
    const teacher = teachers.find(tr => tr.id === selectedTeacherId);
    
    if (!teacher) {
      return (
        <div id="teacher-not-found" className="text-center py-20 bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <p className="text-gray-500 font-medium">Teacher profile not found.</p>
          <button
            id="back-teachers-btn"
            onClick={() => onNavigate('teachers')}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold cursor-pointer hover:bg-emerald-700"
          >
            {t.back}
          </button>
        </div>
      );
    }

    const bio = currentLang === 'en' && teacher.short_bio_en ? teacher.short_bio_en : teacher.short_bio_sl;
    const isBioFallback = currentLang === 'en' && teacher.short_bio_sl && !teacher.short_bio_en;

    // Filter teachings by this teacher
    const teacherPublications = teachings
      .filter(item => item.published && item.teacher_id === teacher.id)
      .sort((a, b) => new Date(b.teaching_date).getTime() - new Date(a.teaching_date).getTime());

    return (
      <div id="teacher-detail-view" className="space-y-8 py-6">
        {/* Profile Card Header */}
        <div className="flex flex-col md:flex-row gap-8 bg-white border border-gray-100 rounded-3xl p-6 shadow-sm items-center md:items-start text-center md:text-left">
          <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-emerald-100 shadow-xs shrink-0 bg-gray-50">
            <img 
              src={teacher.photo_url || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200&h=200"} 
              alt={teacher.full_name} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="space-y-3 flex-1">
            <div className="space-y-1">
              <span className="text-[10px] font-mono tracking-widest uppercase text-emerald-600 font-semibold">{t.filter_teacher}</span>
              <h2 className="text-2xl md:text-3xl font-sans font-semibold tracking-tight text-gray-950">{teacher.full_name}</h2>
            </div>
            
            <p className="text-sm text-gray-650 leading-relaxed max-w-2xl font-sans">
              {bio}
            </p>

            {isBioFallback && (
              <span className="inline-block text-[10px] bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded">
                {t.not_translated_fallback}
              </span>
            )}
            
            <p className="text-xs text-gray-400 font-mono font-bold">
              {t.teachings_count.replace("{count}", String(teacherPublications.length))}
            </p>
          </div>
        </div>

        {/* List of Teachings by this teacher */}
        <div id="teacher-publications" className="space-y-4">
          <h3 className="text-lg font-sans font-semibold text-gray-950 border-b border-gray-100 pb-3">{t.all}</h3>

          {teacherPublications.length === 0 ? (
            <p className="text-sm text-gray-450 italic py-6">No published teachings under this teacher profile yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teacherPublications.map(item => {
                const book = BIBLE_BOOKS_MAP[item.bible_book_code];
                const displayTitle = currentLang === 'en' && item.title_en ? item.title_en : item.title_sl;
                const displaySeries = currentLang === 'en' && item.series_name_en ? item.series_name_en : item.series_name_sl;

                return (
                  <div
                    id={`teacher-pub-row-${item.id}`}
                    key={item.id}
                    onClick={() => onNavigate('teaching-detail', { id: item.id })}
                    className="flex items-center justify-between p-4 bg-white border border-gray-100 hover:border-emerald-250 hover:shadow-sm cursor-pointer transition-all rounded-2xl text-left"
                  >
                    <div className="flex items-center gap-4">
                      <span className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-sm">
                        {item.media_type === 'audio' ? "🎙️" : "📺"}
                      </span>
                      <div>
                        {displaySeries && (
                          <p className="text-[10px] font-mono uppercase tracking-wide text-emerald-700 font-medium">
                            {displaySeries}
                          </p>
                        )}
                        <h4 className="font-sans font-medium text-sm text-gray-900 line-clamp-1">
                          {displayTitle}
                        </h4>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {book ? (currentLang === 'en' ? book.name_en : book.name_sl) : ""} {item.chapter_start}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right space-y-1 pl-4 shrink-0">
                      <span className="block text-[10px] font-mono text-gray-400">{item.teaching_date}</span>
                      {item.duration_text && (
                        <span className="inline-block text-[9px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {item.duration_text}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // default view: Directory list of all teachers
  return (
    <div id="teachers-directory" className="space-y-8 py-6">
      <div className="border-b border-gray-100 pb-4 space-y-1">
        <h2 className="text-3xl font-sans font-semibold tracking-tight text-gray-900">{t.teachers_archive}</h2>
        <p className="text-sm text-gray-500">{t.app_subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {teachers.map(teacher => {
          const teacherSermonCount = teachings.filter(i => i.teacher_id === teacher.id && i.published).length;
          const bio = currentLang === 'en' && teacher.short_bio_en ? teacher.short_bio_en : teacher.short_bio_sl;

          return (
            <div
              id={`dir-teacher-card-${teacher.id}`}
              key={teacher.id}
              onClick={() => onNavigate('teacher-detail', { id: teacher.id })}
              className="flex gap-5 p-6 bg-white border border-gray-150 hover:border-emerald-250 rounded-2xl cursor-pointer hover:shadow-md transition-all group text-left align-top"
            >
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-50 bg-gray-50 shrink-0">
                <img 
                  src={teacher.photo_url || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200&h=200"} 
                  alt={teacher.full_name} 
                  className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-sans font-semibold text-lg text-gray-950 group-hover:text-emerald-700 transition-colors leading-snug">
                  {teacher.full_name}
                </h3>
                <p className="text-xs text-gray-550 leading-relaxed line-clamp-3">
                  {bio}
                </p>
                <div className="pt-2 flex items-center justify-between text-[11px] font-mono font-medium text-emerald-750">
                  <span className="bg-emerald-50 px-2.5 py-0.5 rounded">
                    {t.teachings_count.replace("{count}", String(teacherSermonCount))}
                  </span>
                  <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
