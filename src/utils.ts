/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BIBLE_BOOKS, ImportedMediaItem, MatchSuggestion } from "./types";

// Map Slovene common names/inflections of Bible books to canonical BibleBook codes
const SLOVENE_BOOK_MAP: Record<string, string> = {
  "rimljanom": "ROM",
  "rim": "ROM",
  "pismo rimljanom": "ROM",
  "korinčanom": "1CO", // defaults to 1CO if unspecified
  "1. korinčanom": "1CO",
  "1. pismo korinčanom": "1CO",
  "2. korinčanom": "2CO",
  "2. pismo korinčanom": "2CO",
  "mojzesova": "GEN", // defaults to 1st
  "1. mojzesova": "GEN",
  "geneza": "GEN",
  "2. mojzesova": "EXO",
  "eksodus": "EXO",
  "3. mojzesova": "LEV",
  "levitik": "LEV",
  "4. mojzesova": "NUM",
  "numeri": "NUM",
  "5. mojzesova": "DEU",
  "devteronomij": "DEU",
  "jozue": "JOS",
  "sodniki": "JDG",
  "ruta": "RUT",
  "1. samuelova": "1SA",
  "2. samuelova": "2SA",
  "1. kraljev": "1KI",
  "2. kraljev": "2KI",
  "psalmi": "PSA",
  "psalm": "PSA",
  "pregovori": "PRO",
  "izaija": "ISA",
  "jeremija": "JER",
  "daniel": "DAN",
  "matej": "MAT",
  "evangelij po mateju": "MAT",
  "marko": "MRK",
  "evangelij po marku": "MRK",
  "luka": "LUK",
  "evangelij po luku": "LUK",
  "janez": "JHN",
  "evangelij po janezu": "JHN",
  "apostolska dela": "ACT",
  "galačanom": "GAL",
  "pismo galačanom": "GAL",
  "efežanom": "EFE",
  "pismo efežanom": "EFE",
  "filipljanom": "PHP",
  "pismo filipljanom": "PHP",
  "kološanom": "COL",
  "pismo kološanom": "COL",
  "1. tesaloničanom": "1TH",
  "2. tesaloničanom": "2TH",
  "1. timoteju": "1TI",
  "2. timoteju": "2TI",
  "titu": "TIT",
  "filemonu": "PHM",
  "hebrejcem": "HEB",
  "pismo hebrejcem": "HEB",
  "jakob": "JAS",
  "jakobovo pismo": "JAS",
  "1. petrovo": "1PE",
  "2. petrovo": "2PE",
  "1. janezovo": "1JN",
  "razodetje": "REV"
};

interface ParsedMetadata {
  title: string;
  teacher_name: string;
  bible_book_code: string;
  chapter_start: number;
}

/**
 * Parses a media title following standard formats:
 * - Teaching Title - Teacher Name (Bible Book)
 * - Teaching Title - Teacher Name (Bible Book Chapter)
 * E.g., "Resnična duhovna avtoriteta - Aleš Lajlar (2. Pismo Korinčanom)"
 */
export function parseMediaTitle(rawTitle: string): ParsedMetadata {
  const result: ParsedMetadata = {
    title: rawTitle,
    teacher_name: "",
    bible_book_code: "ROM", // default fallback
    chapter_start: 1
  };

  try {
    // Regex matches: Title - Teacher (Book [Chapter])
    const mainRegex = /^(.*?)\s*-\s*([^(]+?)\s*\((.*?)\)$/;
    const match = rawTitle.match(mainRegex);

    if (match) {
      result.title = match[1].trim();
      result.teacher_name = match[2].trim();
      
      const rawRef = match[3].trim();
      // Parse reference like "Rimljanom 8" or "2. Pismo Korinčanom 12" or "Rimljanom"
      // Split into letters and numbers
      const refMatch = rawRef.match(/^(.*?)\s*(\d+)?$/);
      if (refMatch) {
        const rawBookName = refMatch[1].trim().toLowerCase();
        const rawChapter = refMatch[2];

        // Match with Slovene mapping
        let foundCode = "";
        for (const [key, code] of Object.entries(SLOVENE_BOOK_MAP)) {
          if (rawBookName.includes(key) || key.includes(rawBookName)) {
            foundCode = code;
            break;
          }
        }

        if (foundCode) {
          result.bible_book_code = foundCode;
        }

        if (rawChapter) {
          result.chapter_start = parseInt(rawChapter, 10);
        }
      }
    }
  } catch (error) {
    console.error("Failed parsing title:", rawTitle, error);
  }

  return result;
}

/**
 * Custom fuzzy title similarities helper (Jaro-Winkler-like simplification)
 */
export function stringSimilarity(s1: string, s2: string): number {
  let longer = s1.toLowerCase();
  let shorter = s2.toLowerCase();
  if (s1.length < s2.length) {
    longer = s2.toLowerCase();
    shorter = s1.toLowerCase();
  }
  const longerLength = longer.length;
  if (longerLength === 0) {
    return 1.0;
  }
  return (longerLength - editDistance(longer, shorter)) / longerLength;
}

function editDistance(s1: string, s2: string): number {
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }
  return costs[s2.length];
}

/**
 * Run matching algorithms across list of imported Google Drive and YouTube media streams
 */
export function computeSuggestedMatches(
  driveItems: ImportedMediaItem[],
  ytItems: ImportedMediaItem[]
): MatchSuggestion[] {
  const suggestions: MatchSuggestion[] = [];

  driveItems.forEach(audio => {
    const audioMeta = parseMediaTitle(audio.title);
    
    ytItems.forEach(video => {
      const videoMeta = parseMediaTitle(video.title);

      // Check for similarity
      const titleSim = stringSimilarity(audioMeta.title, videoMeta.title);
      const teacherSim = stringSimilarity(audioMeta.teacher_name || "a", videoMeta.teacher_name || "b");
      const refMatch = audioMeta.bible_book_code === videoMeta.bible_book_code && audioMeta.chapter_start === videoMeta.chapter_start;

      let confidence: 'high' | 'medium' | 'low' = 'low';
      let pct = Math.round(titleSim * 100);
      let matchReason = "";

      if (refMatch && titleSim > 0.8) {
        confidence = 'high';
        matchReason = `Popolno ujemaje svetopisemskega stavka (${BIBLE_BOOKS.find(b => b.code === audioMeta.bible_book_code)?.name_sl} ${audioMeta.chapter_start}) in visoko ujemanje naslova (${pct}%).`;
      } else if (refMatch || titleSim > 0.75) {
        confidence = 'medium';
        matchReason = refMatch 
          ? `Ujemanje svetopisemskega stavka z delnim ujemanjem naslova.`
          : `Visoka podobnost naslovov (${pct}%) brez gotovega ujemanja svetopisemske reference.`;
      } else if (titleSim > 0.5) {
        confidence = 'low';
        matchReason = `Nizko ujemaje naslova (${pct}%). Potreben ročni pregled.`;
      } else {
        return; // Too low to suggest
      }

      suggestions.push({
        id: `${audio.id}_${video.id}`,
        audio_item: {
          ...audio,
          parsed_title: audioMeta.title,
          parsed_teacher_name: audioMeta.teacher_name,
          parsed_bible_book: audioMeta.bible_book_code,
          parsed_chapter: audioMeta.chapter_start
        },
        video_item: {
          ...video,
          parsed_title: videoMeta.title,
          parsed_teacher_name: videoMeta.teacher_name,
          parsed_bible_book: videoMeta.bible_book_code,
          parsed_chapter: videoMeta.chapter_start
        },
        confidence,
        reason: matchReason
      });
    });
  });

  return suggestions;
}

/**
 * Helper to slugify Slovene strings for clean and predictable URLs
 */
export function slugify(text: string): string {
  const map: Record<string, string> = {
    "č": "c", "ž": "z", "š": "s", "ć": "c", "đ": "d",
    "Č": "C", "Ž": "Z", "Š": "S", "Ć": "C", "Đ": "D"
  };
  
  let slug = text.trim();
  for (const [key, val] of Object.entries(map)) {
    slug = slug.replace(new RegExp(key, 'g'), val);
  }
  
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
