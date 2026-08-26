/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ShieldCheck } from "lucide-react";
import { TRANSLATIONS } from "../translations";
import { EcosystemNavbar, EcosystemUser } from "./EcosystemNavbar";

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string, params?: any) => void;
  currentLang: 'sl' | 'en';
  onLangChange: (lang: 'sl' | 'en') => void;
  isAdminLoggedIn: boolean;
  user?: EcosystemUser | null;
  onLogin?: () => void;
  onLogout?: () => void;
}

export function Header({
  currentView,
  onNavigate,
  currentLang,
  onLangChange,
  isAdminLoggedIn,
  user,
  onLogin,
  onLogout,
}: HeaderProps) {
  const t = TRANSLATIONS[currentLang];

  const extraNavItems = (
    <div className="flex items-center gap-1 sm:gap-1.5">
      <button
        id="nav-home"
        onClick={() => onNavigate('home')}
        className={`px-3 py-1.5 rounded-xl text-xs font-bold font-['Nohemi',sans-serif] transition-all cursor-pointer ${
          currentView === 'home' 
            ? "bg-[#93032E] text-white shadow-xs" 
            : "text-slate-700 hover:text-[#93032E] hover:bg-slate-100/80"
        }`}
      >
        {t.home}
      </button>
      <button
        id="nav-archive"
        onClick={() => onNavigate('archive')}
        className={`px-3 py-1.5 rounded-xl text-xs font-bold font-['Nohemi',sans-serif] transition-all cursor-pointer ${
          currentView === 'archive' || currentView === 'teaching-detail'
            ? "bg-[#93032E] text-white shadow-xs" 
            : "text-slate-700 hover:text-[#93032E] hover:bg-slate-100/80"
        }`}
      >
        {t.archive}
      </button>
      <button
        id="nav-teachers"
        onClick={() => onNavigate('teachers')}
        className={`px-3 py-1.5 rounded-xl text-xs font-bold font-['Nohemi',sans-serif] transition-all cursor-pointer ${
          currentView === 'teachers' || currentView === 'teacher-detail'
            ? "bg-[#93032E] text-white shadow-xs" 
            : "text-slate-700 hover:text-[#93032E] hover:bg-slate-100/80"
        }`}
      >
        {t.teachers}
      </button>
      <button
        id="nav-admin"
        onClick={() => onNavigate('admin')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-['Nohemi',sans-serif] cursor-pointer transition-all ${
          currentView === 'admin'
            ? "bg-[#93032E] text-white shadow-xs font-black"
            : isAdminLoggedIn
            ? "bg-amber-400 text-slate-950 font-black shadow-xs"
            : "text-slate-700 hover:text-[#93032E] hover:bg-slate-100/80"
        }`}
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>{isAdminLoggedIn ? "Dashboard" : t.admin}</span>
      </button>
    </div>
  );

  return (
    <EcosystemNavbar
      currentApp="ucenja"
      currentLang={currentLang}
      onLanguageChange={onLangChange}
      user={user}
      onLogin={onLogin}
      onLogout={onLogout}
      extraNavItems={extraNavItems}
    />
  );
}
