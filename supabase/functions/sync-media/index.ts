/**
 * Supabase Edge Function: sync-media
 * Ingests audio files from Google Drive and video records from YouTube playlists,
 * detects Bible books, chapters, and teacher names, and persists them into Postgres.
 */

// @ts-ignore Deno npm import
import { createClient } from "npm:@supabase/supabase-js@2";
// @ts-ignore Deno npm import
import { google } from "npm:googleapis@^140.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map of Bible Book detection tokens to codes (Slovene/English keywords)
const BIBLE_BOOKS_PATTERNS = [
  { code: 'GEN', words: ['mojzesova', 'geneza', 'genesis', '1. mojzesova', '1.mojzesova'] },
  { code: 'EXO', words: ['mojzesova', 'eksodus', 'exodus', '2. mojzesova', '2.mojzesova'] },
  { code: 'LEV', words: ['mojzesova', 'levitik', 'leviticus', '3. mojzesova', '3.mojzesova'] },
  { code: 'NUM', words: ['mojzesova', 'numeri', 'numbers', '4. mojzesova', '4.mojzesova'] },
  { code: 'DEU', words: ['mojzesova', 'devteronomij', 'deuteronomy', '5. mojzesova', '5.mojzesova'] },
  { code: 'JOS', words: ['jozue', 'joshua', 'jos'] },
  { code: 'JDG', words: ['sodniki', 'judges'] },
  { code: 'RUT', words: ['ruta', 'ruth'] },
  { code: '1SA', words: ['samuelova', 'samuel', '1 samuel', '1. samuelova', '1.samuelova'] },
  { code: '2SA', words: ['samuelova', 'samuel', '2 samuel', '2. samuelova', '2.samuelova'] },
  { code: '1KI', words: ['kraljev', 'kings', '1 kings', '1. kraljev', '1.kraljev'] },
  { code: '2KI', words: ['kraljev', 'kings', '2 kings', '2. kraljev', '2.kraljev'] },
  { code: 'PSA', words: ['psalmi', 'psalms', 'psalm', 'ps'] },
  { code: 'PRO', words: ['pregovori', 'proverbs'] },
  { code: 'ISA', words: ['izaija', 'isaiah'] },
  { code: 'JER', words: ['jeremija', 'jeremiah'] },
  { code: 'DAN', words: ['daniel'] },
  { code: 'MAT', words: ['matej', 'matthew', 'mat'] },
  { code: 'MRK', words: ['marko', 'mark', 'mrk'] },
  { code: 'LUK', words: ['luka', 'luke', 'luk'] },
  { code: 'JHN', words: ['janez', 'john', 'jhn'] },
  { code: 'ACT', words: ['apostolska dela', 'acts', 'dejanja'] },
  { code: 'ROM', words: ['rimljanom', 'romans', 'rim'] },
  { code: '1CO', words: ['korinčanom', 'corinthians', '1 kor', '1. korinčanom', '1.korinčanom'] },
  { code: '2CO', words: ['korinčanom', 'corinthians', '2 kor', '2. korinčanom', '2.korinčanom'] },
  { code: 'GAL', words: ['galačanom', 'galatians', 'gal'] },
  { code: 'EFE', words: ['efežanom', 'ephesians', 'efe'] },
  { code: 'PHP', words: ['filipljanom', 'philippians', 'fil'] },
  { code: 'COL', words: ['kološanom', 'colossians', 'kol'] },
  { code: '1TH', words: ['tesaloničanom', 'thessalonians', '1 tes', '1. tesaloničanom', '1.tesaloničanom'] },
  { code: '2TH', words: ['tesaloničanom', 'thessalonians', '2 tes', '2. tesaloničanom', '2.tesaloničanom'] },
  { code: '1TI', words: ['timoteju', 'timothy', '1 tim', '1. timoteju', '1.timoteju'] },
  { code: '2TI', words: ['timoteju', 'timothy', '2 tim', '2. timoteju', '2.timoteju'] },
  { code: 'TIT', words: ['titu', 'titus', 'tit'] },
  { code: 'PHM', words: ['filemonu', 'philemon', 'film'] },
  { code: 'HEB', words: ['hebrejcem', 'hebrews', 'heb'] },
  { code: 'JAS', words: ['jakob', 'james', 'jak'] },
  { code: '1PE', words: ['petrovo', 'peter', '1 pet', '1. petrovo', '1.petrovo'] },
  { code: '2PE', words: ['petrovo', 'peter', '2 pet', '2. petrovo', '2.petrovo'] },
  { code: '1JN', words: ['janezovo', 'john', '1 jn', '1. janezovo', '1.janezovo'] },
  { code: 'REV', words: ['razodetje', 'revelation', 'raz'] }
];

function parseMetadataFromTitle(title: string) {
  const normalized = title.trim().toLowerCase();
  let bookCode = "";
  let chapter: number | null = null;
  let confidence = 0.3;

  for (const book of BIBLE_BOOKS_PATTERNS) {
    for (const word of book.words) {
      if (normalized.includes(word)) {
        if (word === "mojzesova") {
          if (normalized.includes("1. moj") || normalized.includes("1.moj") || normalized.includes("prva moj")) {
            bookCode = "GEN";
          } else if (normalized.includes("2. moj") || normalized.includes("2.moj") || normalized.includes("druga moj")) {
            bookCode = "EXO";
          } else if (normalized.includes("3. moj") || normalized.includes("3.moj") || normalized.includes("tretja moj")) {
            bookCode = "LEV";
          } else if (normalized.includes("4. moj") || normalized.includes("4.moj") || normalized.includes("četrta moj")) {
            bookCode = "NUM";
          } else if (normalized.includes("5. moj") || normalized.includes("5.moj") || normalized.includes("peta moj")) {
            bookCode = "DEU";
          } else {
            bookCode = "GEN";
          }
        } else {
          bookCode = book.code;
        }
        confidence += 0.3;
        break;
      }
    }
    if (bookCode) break;
  }

  const numbers = normalized.match(/\d+/g);
  if (numbers && numbers.length > 0) {
    let numberIndex = 0;
    if (bookCode && (bookCode.startsWith("1") || bookCode.startsWith("2") || bookCode.startsWith("3") || bookCode.startsWith("4") || bookCode.startsWith("5"))) {
      if (Number(numbers[0]) <= 5) {
        numberIndex = 1;
      }
    }

    const chapVal = numbers[numberIndex] || numbers[0];
    if (chapVal) {
      const parsedNum = parseInt(chapVal, 10);
      if (parsedNum > 0 && parsedNum <= 150) {
        chapter = parsedNum;
        confidence += 0.3;
      }
    }
  }

  if (bookCode && chapter) {
    confidence = Math.min(confidence, 0.95);
  }

  return { bookCode, chapter, confidence };
}

function normalizeDriveFolderId(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_\-]+)/);
  if (folderMatch) return folderMatch[1];
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_\-]+)/);
  if (idMatch) return idMatch[1];
  return trimmed;
}

function normalizeYoutubePlaylistId(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  const listMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_\-]+)/);
  if (listMatch) return listMatch[1];
  return trimmed;
}

// @ts-ignore Deno global
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Initialize Supabase Admin Client
    // @ts-ignore Deno env
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    // @ts-ignore Deno env
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable is missing.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Fetch Active Settings
    const { data: settingsData, error: settingsErr } = await supabase
      .from("admin_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();

    if (settingsErr) {
      throw new Error(`Failed to load admin settings: ${settingsErr.message}`);
    }

    const rawDriveFolderId = settingsData?.google_drive_folder_id || "";
    const rawYoutubePlaylistId = settingsData?.youtube_playlist_id || "";

    const driveFolderId = normalizeDriveFolderId(rawDriveFolderId);
    const youtubePlaylistId = normalizeYoutubePlaylistId(rawYoutubePlaylistId);

    if (!driveFolderId && !youtubePlaylistId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Neither Google Drive Folder ID nor YouTube Playlist ID is defined in Settings.",
          processed: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 3. Pre-load Teachers for heuristic mapping
    const { data: teachersData } = await supabase.from("teachers").select("id, full_name");
    const teachersList = teachersData || [];

    // 4. Initialize Google Auth from Service Account secret
    // @ts-ignore Deno env
    const serviceAccountJsonStr = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    let googleAuth: any;

    if (serviceAccountJsonStr) {
      const credentials = JSON.parse(serviceAccountJsonStr);
      googleAuth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          "https://www.googleapis.com/auth/drive.readonly",
          "https://www.googleapis.com/auth/youtube.readonly"
        ]
      });
    } else {
      // Fall back to Application Default Credentials
      googleAuth = new google.auth.GoogleAuth({
        scopes: [
          "https://www.googleapis.com/auth/drive.readonly",
          "https://www.googleapis.com/auth/youtube.readonly"
        ]
      });
    }

    let itemsIndexed: any[] = [];
    let apiErrors: string[] = [];

    // 5. Sync from Google Drive
    if (driveFolderId && driveFolderId !== "1A7b_G1p8D3g9P5h9Z6K_DriveFolderId") {
      try {
        const authClient = await googleAuth.getClient();
        const drive = google.drive({ version: "v3", auth: authClient });

        const driveRes = await drive.files.list({
          q: `'${driveFolderId}' in parents and mimeType contains 'audio' and trashed = false`,
          fields: "files(id, name, webViewLink, createdTime, description)",
          pageSize: 40
        });

        const files = driveRes.data.files || [];
        for (const file of files) {
          itemsIndexed.push({
            source: "google_drive",
            file_id_or_video_id: file.id,
            raw_title: file.name,
            raw_description: file.description || "",
            file_url: file.webViewLink || ""
          });
        }
      } catch (err: any) {
        console.error("Google Drive listing error:", err);
        apiErrors.push(`Google Drive Error: ${err.message || String(err)}`);
      }
    }

    // 6. Sync from YouTube
    if (youtubePlaylistId && youtubePlaylistId !== "PL_PLy_YTL_YoutubePlaylistId") {
      try {
        const authClient = await googleAuth.getClient();
        const youtube = google.youtube({ version: "v3", auth: authClient });

        const youtubeRes = await youtube.playlistItems.list({
          playlistId: youtubePlaylistId,
          part: ["snippet"],
          maxResults: 40
        });

        const videos = youtubeRes.data.items || [];
        for (const item of videos) {
          const snippet = item.snippet || {};
          const videoId = snippet.resourceId ? snippet.resourceId.videoId : "";
          if (videoId) {
            itemsIndexed.push({
              source: "youtube",
              file_id_or_video_id: videoId,
              raw_title: snippet.title || "",
              raw_description: snippet.description || "",
              file_url: `https://www.youtube.com/watch?v=${videoId}`
            });
          }
        }
      } catch (err: any) {
        console.error("YouTube Playlist listing error:", err);
        apiErrors.push(`YouTube Error: ${err.message || String(err)}`);
      }
    }

    if (apiErrors.length > 0 && itemsIndexed.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: apiErrors.join(" | "),
          processed: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 }
      );
    }

    // 7. Process and Upsert into `import_items`
    let processedCount = 0;
    const nowIso = new Date().toISOString();

    for (const item of itemsIndexed) {
      const cleanTitle = item.raw_title;
      const lowerTitle = cleanTitle.toLowerCase();
      const parsedBook = parseMetadataFromTitle(cleanTitle);

      let matchedTeacherId: string | null = null;
      for (const teacher of teachersList) {
        const nameNode = (teacher.full_name || "").toLowerCase();
        if (nameNode && lowerTitle.includes(nameNode)) {
          matchedTeacherId = teacher.id;
          break;
        }
      }

      const docId = `${item.source}_${item.file_id_or_video_id}`;
      const payload: any = {
        id: docId,
        source: item.source,
        title_sl: item.raw_title,
        media_type: item.source === "google_drive" ? "audio" : "video",
        confidence_score: Math.round(parsedBook.confidence * 100),
        status: "unreviewed",
        updated_at: nowIso
      };

      if (item.source === "google_drive") {
        payload.audio_url = item.file_url;
      } else {
        payload.youtube_url = item.file_url;
      }

      if (parsedBook.bookCode) {
        payload.bible_book_code = parsedBook.bookCode;
      }
      if (parsedBook.chapter) {
        payload.chapter_start = parsedBook.chapter;
      }
      if (matchedTeacherId) {
        payload.teacher_id = matchedTeacherId;
      }

      const { error: upsertErr } = await supabase
        .from("import_items")
        .upsert(payload, { onConflict: "id", ignoreDuplicates: false });

      if (!upsertErr) {
        processedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sync complete. ${processedCount} items indexed.`,
        processed: processedCount
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    console.error("Global sync function failure:", err);
    return new Response(
      JSON.stringify({
        success: false,
        message: err.message || String(err),
        processed: 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
