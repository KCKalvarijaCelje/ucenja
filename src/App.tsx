/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { BookOpen } from "lucide-react";
import { supabase } from "./supabaseClient";
import { Teacher, Teaching } from "./types";
import { TRANSLATIONS } from "./translations";
import { Header } from "./components/Header";
import { PublicHome } from "./components/PublicHome";
import { PublicArchive } from "./components/PublicArchive";
import { PublicDetail } from "./components/PublicDetail";
import { PublicTeachers } from "./components/PublicTeachers";
import { AdminDashboard } from "./components/AdminDashboard";

export default function App() {
  // Locale / Translation configuration
  const [currentLang, setCurrentLang] = useState<'sl' | 'en'>(() => {
    const saved = localStorage.getItem("app_lang");
    return (saved === 'sl' || saved === 'en') ? saved : 'sl';
  });

  const handleLangChange = (lang: 'sl' | 'en') => {
    setCurrentLang(lang);
    localStorage.setItem("app_lang", lang);
  };

  const t = TRANSLATIONS[currentLang];

  // Core Data models State
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teachings, setTeachings] = useState<Teaching[]>([]);
  const [loading, setLoading] = useState(true);

  // Hash-based Clean routing structure
  const [routerState, setRouterState] = useState<{ view: string; params: any }>({
    view: 'home',
    params: {}
  });

  // Fetch Supabase database content on mount
  const handleReloadData = async () => {
    try {
      // 1. Fetch teachers
      const { data: trData, error: trErr } = await supabase
        .from('teachers')
        .select('*')
        .order('full_name', { ascending: true });
      
      if (trErr) {
        console.error("Error fetching teachers from Supabase:", trErr);
      } else if (trData) {
        setTeachers(trData as Teacher[]);
      }

      // 2. Fetch teachings ordered by teaching date desc
      const { data: teData, error: teErr } = await supabase
        .from('teachings')
        .select('*')
        .order('teaching_date', { ascending: false });
      
      if (teErr) {
        console.error("Error fetching teachings from Supabase:", teErr);
      } else if (teData) {
        setTeachings(teData as Teaching[]);
      }
      
      setLoading(false);
    } catch (err) {
      console.error("Error retrieving dataset:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    handleReloadData();
  }, []);

  // Set real-time Supabase listeners to automatically update listings on changes
  useEffect(() => {
    const channel = supabase
      .channel('public-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teachings' },
        () => {
          handleReloadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teachers' },
        () => {
          handleReloadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Standard hash-change routing coordination
  useEffect(() => {
    const handleHashChange = (e?: HashChangeEvent) => {
      const hasUnsavedTeachings = localStorage.getItem("teaching_form_has_changes") === "true";
      const hasUnsavedTeachers = localStorage.getItem("teacher_form_has_changes") === "true";

      if (hasUnsavedTeachings || hasUnsavedTeachers) {
        if (!window.confirm(TRANSLATIONS[currentLang].unsaved_warning)) {
          if (e && e.oldURL) {
            const oldHash = new URL(e.oldURL).hash;
            window.removeEventListener('hashchange', handleHashChange);
            window.location.hash = oldHash;
            setTimeout(() => {
              window.addEventListener('hashchange', handleHashChange);
            }, 0);
          } else {
            window.location.hash = '#/admin';
          }
          return;
        } else {
          localStorage.removeItem("teaching_form_has_changes");
          localStorage.removeItem("teacher_form_has_changes");
        }
      }

      const hash = window.location.hash || '#/';
      
      if (hash === '#/' || hash === '#/home') {
        setRouterState({ view: 'home', params: {} });
      } else if (hash === '#/archive') {
        const sessionFilters = sessionStorage.getItem("archive_nav_filters");
        const parsed = sessionFilters ? JSON.parse(sessionFilters) : {};
        setRouterState({ view: 'archive', params: parsed });
      } else if (hash.startsWith('#/teaching/')) {
        const id = hash.replace('#/teaching/', '');
        setRouterState({ view: 'teaching-detail', params: { id } });
      } else if (hash === '#/teachers') {
        setRouterState({ view: 'teachers', params: {} });
      } else if (hash.startsWith('#/teacher/')) {
        const id = hash.replace('#/teacher/', '');
        setRouterState({ view: 'teacher-detail', params: { id } });
      } else if (hash === '#/admin' || hash.startsWith('#/admin/')) {
        setRouterState({ view: 'admin', params: {} });
      } else {
        setRouterState({ view: 'home', params: {} });
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    // Trigger on initial entry
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentLang]);

  // Unified Navigation dispatcher
  const handleNavigate = (view: string, params?: any) => {
    const hasUnsavedTeachings = localStorage.getItem("teaching_form_has_changes") === "true";
    const hasUnsavedTeachers = localStorage.getItem("teacher_form_has_changes") === "true";

    if (hasUnsavedTeachings || hasUnsavedTeachers) {
      if (!window.confirm(TRANSLATIONS[currentLang].unsaved_warning)) {
        return;
      } else {
        localStorage.removeItem("teaching_form_has_changes");
        localStorage.removeItem("teacher_form_has_changes");
      }
    }

    if (view === 'home') {
      window.location.hash = '#/home';
    } else if (view === 'archive') {
      if (params) {
        sessionStorage.setItem("archive_nav_filters", JSON.stringify(params));
      } else {
        sessionStorage.removeItem("archive_nav_filters");
      }
      window.location.hash = '#/archive';
    } else if (view === 'teaching-detail') {
      window.location.hash = `#/teaching/${params.id}`;
    } else if (view === 'teachers') {
      window.location.hash = '#/teachers';
    } else if (view === 'teacher-detail') {
      window.location.hash = `#/teacher/${params.id}`;
    } else if (view === 'admin') {
      window.location.hash = '#/admin';
    }
  };

  return (
    <div id="app-root-container" className="min-h-screen bg-neutral-50/40 text-gray-800 flex flex-col justify-between selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* 1. Global Navigation Bar */}
      <Header
        currentView={routerState.view}
        onNavigate={handleNavigate}
        currentLang={currentLang}
        onLangChange={handleLangChange}
        isAdminLoggedIn={routerState.view === 'admin'}
      />

      {/* 2. Main Page Content Section */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-1 py-8 w-full">
        {loading ? (
          <div id="loader-overlay" className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-10 h-10 border-2 border-emerald-650 border-t-transparent animate-spin rounded-full" />
            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">{t.loading}</p>
          </div>
        ) : (
          <div id="view-renderer">
            {routerState.view === 'home' && (
              <PublicHome
                currentLang={currentLang}
                teachers={teachers}
                teachings={teachings}
                onNavigate={handleNavigate}
              />
            )}

            {routerState.view === 'archive' && (
              <PublicArchive
                currentLang={currentLang}
                teachers={teachers}
                teachings={teachings}
                onNavigate={handleNavigate}
                initialFilters={routerState.params}
              />
            )}

            {routerState.view === 'teaching-detail' && (
              <PublicDetail
                currentLang={currentLang}
                teachingId={routerState.params?.id}
                teachers={teachers}
                teachings={teachings}
                onNavigate={handleNavigate}
              />
            )}

            {routerState.view === 'teachers' && (
              <PublicTeachers
                currentLang={currentLang}
                teachers={teachers}
                teachings={teachings}
                onNavigate={handleNavigate}
              />
            )}

            {routerState.view === 'teacher-detail' && (
              <PublicTeachers
                currentLang={currentLang}
                teachers={teachers}
                teachings={teachings}
                selectedTeacherId={routerState.params?.id}
                onNavigate={handleNavigate}
              />
            )}

            {routerState.view === 'admin' && (
              <AdminDashboard
                currentLang={currentLang}
                teachers={teachers}
                teachings={teachings}
                onRefreshData={handleReloadData}
              />
            )}
          </div>
        )}
      </main>

      {/* 3. Global Information Footer */}
      <footer id="global-footer" className="bg-white border-t border-gray-150/80 py-8 text-xs text-gray-500 font-sans mt-16 shadow-inner text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-gray-800">{t.app_title}</span>
            <span className="text-gray-300">|</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-600 font-bold">{t.church_name}</span>
          </div>
          
          <div className="flex items-center gap-4 text-gray-400 text-[11px]">
            <span>© 2026 Krščanska Cerkev Slovenija. Vse pravice pridržane.</span>
            <span className="text-gray-200">|</span>
            <a 
              href="#/admin" 
              className="hover:text-emerald-700 transition-colors cursor-pointer font-semibold underline decoration-dotted"
            >
              Editorial Access
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
