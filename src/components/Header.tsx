/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BookOpen, ShieldCheck } from "lucide-react";
import { TRANSLATIONS } from "../translations";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string, params?: any) => void;
  currentLang: 'sl' | 'en';
  onLangChange: (lang: 'sl' | 'en') => void;
  isAdminLoggedIn: boolean;
}

export function Header({ currentView, onNavigate, currentLang, onLangChange, isAdminLoggedIn }: HeaderProps) {
  const t = TRANSLATIONS[currentLang];

  return (
    <header id="app-header" className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div 
          id="brand-logo"
          onClick={() => onNavigate('home')} 
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center transition-transform group-hover:scale-105">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-sans font-semibold tracking-tight text-gray-900 group-hover:text-emerald-700 transition-colors">
              {t.app_title}
            </h1>
            <p className="text-[10px] font-mono tracking-wider uppercase text-emerald-600 font-medium">
              {t.church_name}
            </p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav id="desktop-nav" className="hidden md:flex items-center gap-8">
          <button
            id="nav-home"
            onClick={() => onNavigate('home')}
            className={`font-medium text-sm transition-colors ${
              currentView === 'home' ? "text-emerald-600" : "text-gray-650 hover:text-emerald-600"
            }`}
          >
            {t.home}
          </button>
          <button
            id="nav-archive"
            onClick={() => onNavigate('archive')}
            className={`font-medium text-sm transition-colors ${
              currentView === 'archive' || currentView === 'teaching-detail'
                ? "text-emerald-600"
                : "text-gray-650 hover:text-emerald-600"
            }`}
          >
            {t.archive}
          </button>
          <button
            id="nav-teachers"
            onClick={() => onNavigate('teachers')}
            className={`font-medium text-sm transition-colors ${
              currentView === 'teachers' || currentView === 'teacher-detail'
                ? "text-emerald-600"
                : "text-gray-650 hover:text-emerald-600"
            }`}
          >
            {t.teachers}
          </button>
        </nav>

        {/* Global Controls (Lang + Admin login status) */}
        <div id="header-controls" className="flex items-center gap-4">
          <LanguageSwitcher currentLang={currentLang} onLangChange={onLangChange} />

          <button
            id="nav-admin"
            onClick={() => onNavigate('admin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
              currentView === 'admin'
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : isAdminLoggedIn
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-emerald-600"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isAdminLoggedIn ? "Dashboard" : t.admin}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
