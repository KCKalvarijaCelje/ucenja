/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Globe } from "lucide-react";

interface LanguageSwitcherProps {
  currentLang: 'sl' | 'en';
  onLangChange: (lang: 'sl' | 'en') => void;
}

export function LanguageSwitcher({ currentLang, onLangChange }: LanguageSwitcherProps) {
  return (
    <div id="lang-switcher" className="flex items-center gap-1.5 bg-gray-50/60 border border-gray-100 rounded-lg p-1 text-xs font-medium text-gray-700">
      <Globe className="w-3.5 h-3.5 text-gray-400" />
      <button
        id="btn-lang-sl"
        onClick={() => onLangChange('sl')}
        className={`px-2 py-1 rounded transition-colors ${
          currentLang === 'sl'
            ? "bg-emerald-600 text-white shadow-sm"
            : "hover:bg-gray-100 text-gray-600"
        }`}
      >
        SL
      </button>
      <button
        id="btn-lang-en"
        onClick={() => onLangChange('en')}
        className={`px-2 py-1 rounded transition-colors ${
          currentLang === 'en'
            ? "bg-emerald-600 text-white shadow-sm"
            : "hover:bg-gray-100 text-gray-600"
        }`}
      >
        EN
      </button>
    </div>
  );
}
