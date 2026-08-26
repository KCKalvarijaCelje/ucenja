/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { BookOpen } from "lucide-react";
import { supabase, getAuthBroadcastChannel, broadcastAuthChange, performGlobalSignOut } from "./supabaseClient";
import { Teacher, Teaching } from "./types";
import { TRANSLATIONS } from "./translations";
import { Header } from "./components/Header";
import { PublicHome } from "./components/PublicHome";
import { PublicArchive } from "./components/PublicArchive";
import { PublicDetail } from "./components/PublicDetail";
import { PublicTeachers } from "./components/PublicTeachers";
import { AdminDashboard } from "./components/AdminDashboard";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { PwaInstallBanner } from "./components/PwaInstallBanner";

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
  const [user, setUser] = useState<{ name: string; email: string; role?: string } | null>(() => {
    try {
      const saved = localStorage.getItem('kck_user_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { name: parsed.name || 'Aleš', email: parsed.email || '', role: 'Admin' };
      }
    } catch {}
    return null;
  });

  // Format display name with proper Slovenian diacritics (Š, Č, Ž)
  const formatSlovenianDisplayName = (rawName?: string | null, email?: string | null): string => {
    const emailLower = (email || '').toLowerCase().trim();
    let name = (rawName || '').trim();

    if (emailLower === 'ales.lajlar@gmail.com' || emailLower === 'aleslajlar@gmail.com') {
      return 'Aleš Lajlar';
    }

    if (!name && email) {
      name = email.split('@')[0];
    }

    if (!name) return 'Uporabnik';

    // If name is dot-separated like "kenzley.lajlar" or "whitney.lajlar", format to capitalized words
    if (name.includes('.') && !name.includes(' ')) {
      name = name.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
    }

    return name
      .replace(/\bAles\b/g, 'Aleš')
      .replace(/\bales\b/g, 'Aleš')
      .replace(/\bStefan\b/g, 'Štefan')
      .replace(/\bStef\b/g, 'Štef')
      .replace(/\bSpela\b/g, 'Špela')
      .replace(/\bBostjan\b/g, 'Boštjan')
      .replace(/\bBozena\b/g, 'Božena')
      .replace(/\bZiga\b/g, 'Žiga')
      .replace(/\bZan\b/g, 'Žan')
      .replace(/\bCrt\b/g, 'Črt')
      .replace(/\bMatjaz\b/g, 'Matjaž')
      .replace(/\bMarusa\b/g, 'Maruša')
      .replace(/\bAljosa\b/g, 'Aljoša')
      .replace(/\bAnze\b/g, 'Anže')
      .replace(/\bSasa\b/g, 'Saša')
      .replace(/\bBlaz\b/g, 'Blaž');
  };

  useEffect(() => {
    const syncUserSession = async (sessionUser: any) => {
      if (sessionUser) {
        const email = (sessionUser.email || '').toLowerCase().trim();
        const metaName = sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || '';
        let displayName = metaName || email.split('@')[0];

        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, role')
            .or(`email.ilike.${email},id.eq.${sessionUser.id},auth_user_id.eq.${sessionUser.id}`)
            .maybeSingle();

          if (profile?.full_name) {
            displayName = profile.full_name;
          }
        } catch {
          // ignore
        }

        const formattedName = formatSlovenianDisplayName(displayName, email);
        setUser({
          name: formattedName,
          email: email,
          role: 'Admin',
        });
      } else {
        setUser(null);
      }
    };

    // 1. Initial getSession check
    supabase.auth.getSession().then(({ data: { session } }) => {
      syncUserSession(session?.user ?? null);
    }).catch(() => {});

    // 2. Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      syncUserSession(session?.user ?? null);
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        broadcastAuthChange('GLOBAL_SIGNIN');
      } else if (event === 'SIGNED_OUT') {
        broadcastAuthChange('GLOBAL_SIGNOUT');
      }
    });

    // 3. BroadcastChannel listener for instant cross-app sync
    const channel = getAuthBroadcastChannel();
    if (channel) {
      channel.onmessage = (e) => {
        if (e.data?.type === 'GLOBAL_SIGNOUT') {
          syncUserSession(null);
        } else if (e.data?.type === 'GLOBAL_SIGNIN') {
          supabase.auth.getSession().then(({ data: { session } }) => {
            syncUserSession(session?.user ?? null);
          });
        }
      };
    }

    // 4. Tab focus & visibility sync
    const handleTabFocus = () => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        syncUserSession(session?.user ?? null);
      }).catch(() => {});
    };

    window.addEventListener('focus', handleTabFocus);
    document.addEventListener('visibilitychange', handleTabFocus);

    return () => {
      subscription.unsubscribe();
      if (channel) channel.close();
      window.removeEventListener('focus', handleTabFocus);
      document.removeEventListener('visibilitychange', handleTabFocus);
    };
  }, []);

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
    <div id="app-root-container" className="min-h-screen bg-[#FAF7F5] text-gray-800 flex flex-col justify-between selection:bg-[#93032E] selection:text-white">
      
      {/* 1. Global Navigation Bar */}
      <Header
        currentView={routerState.view}
        onNavigate={handleNavigate}
        currentLang={currentLang}
        onLangChange={handleLangChange}
        isAdminLoggedIn={routerState.view === 'admin'}
        user={user}
        onLogin={() => handleNavigate('admin')}
        onLogout={() => {
          supabase.auth.signOut();
          setUser(null);
          localStorage.removeItem('kck_user_session');
        }}
      />

      {/* 2. Main Page Content Section */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-1 py-8 pb-24 md:pb-8 w-full">
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
                onNavigate={handleNavigate}
              />
            )}
          </div>
        )}
      </main>

      {/* 3. Mobile Native Bottom Navigation Bar */}
      <MobileBottomNav
        currentView={routerState.view}
        onNavigate={handleNavigate}
        currentLang={currentLang}
        isAdminLoggedIn={routerState.view === 'admin'}
      />

      {/* Mobile/Desktop PWA Install Banner */}
      <PwaInstallBanner currentLang={currentLang} />

      {/* 4. Global Information Footer */}
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
