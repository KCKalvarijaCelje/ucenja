import React from 'react';
import { Home, BookOpen, Users, ShieldCheck } from 'lucide-react';
import { TRANSLATIONS } from '../translations';

interface MobileBottomNavProps {
  currentView: string;
  onNavigate: (view: string, params?: any) => void;
  currentLang: 'sl' | 'en';
  isAdminLoggedIn?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate,
  currentLang,
  isAdminLoggedIn,
}) => {
  const t = TRANSLATIONS[currentLang];
  const isHome = currentView === 'home';
  const isArchive = currentView === 'archive' || currentView === 'teaching-detail';
  const isTeachers = currentView === 'teachers' || currentView === 'teacher-detail';
  const isAdmin = currentView === 'admin';

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#A6A15E]/20 shadow-lg px-2 py-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="grid grid-cols-4 items-center justify-items-center">
        {/* 1. Domov */}
        <button
          onClick={() => onNavigate('home')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
            isHome ? 'text-[#93032E] font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Home className={`w-5 h-5 ${isHome ? 'stroke-[2.5px]' : ''}`} />
          <span className="text-[10px] mt-0.5 tracking-tight font-['Nohemi',sans-serif]">
            {t.home}
          </span>
        </button>

        {/* 2. Arhiv */}
        <button
          onClick={() => onNavigate('archive')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
            isArchive ? 'text-[#93032E] font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <BookOpen className={`w-5 h-5 ${isArchive ? 'stroke-[2.5px]' : ''}`} />
          <span className="text-[10px] mt-0.5 tracking-tight font-['Nohemi',sans-serif]">
            {t.archive}
          </span>
        </button>

        {/* 3. Učitelji */}
        <button
          onClick={() => onNavigate('teachers')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
            isTeachers ? 'text-[#93032E] font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className={`w-5 h-5 ${isTeachers ? 'stroke-[2.5px]' : ''}`} />
          <span className="text-[10px] mt-0.5 tracking-tight font-['Nohemi',sans-serif]">
            {t.teachers}
          </span>
        </button>

        {/* 4. Uredništvo / Admin */}
        <button
          onClick={() => onNavigate('admin')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
            isAdmin ? 'text-[#93032E] font-bold' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className={`w-5 h-5 ${isAdmin ? 'stroke-[2.5px]' : ''}`} />
          <span className="text-[10px] mt-0.5 tracking-tight font-['Nohemi',sans-serif]">
            {isAdminLoggedIn ? 'Dashboard' : t.admin}
          </span>
        </button>
      </div>
    </nav>
  );
};
