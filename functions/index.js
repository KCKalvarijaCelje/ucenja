const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const { google } = require("googleapis");

// Initialize Firebase Admin
const app = admin.initializeApp();

// Instantiate Firestore with the provisioned database ID
const db = getFirestore(app, "ai-studio-8e19c4af-f2cf-4923-be52-7ce67c08b873");

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

/**
 * Heuristic parsing of metadata (Bible Book and Chapter) from title
 */
function parseMetadataFromTitle(title) {
  const normalized = title.trim().toLowerCase();
  let bookCode = "";
  let chapter = null;
  let confidence = 0.3;

  // 1. Detect Bible Book by scanning matched terms
  // Evaluate multi-word tokens or precise matches first
  for (const book of BIBLE_BOOKS_PATTERNS) {
    for (const word of book.words) {
      if (normalized.includes(word)) {
        // Specialize for 1./2./3./4./5. Mojzesova
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
            bookCode = "GEN"; // Default fallback
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

  // 2. Detect Chapter Number
  // Look for standalone numbers, or parenthesized numbers, e.g., "Rimljanom 8" or "(Rimljanom 8)"
  const numbers = normalized.match(/\d+/g);
  if (numbers && numbers.length > 0) {
    // If we have a Bible Book like 1. Korinčanom, the first number ('1') is part of the book title.
    // Let's filter out prefix numbers if the book matches a dual prefix.
    let numberIndex = 0;
    if (bookCode && (bookCode.startsWith("1") || bookCode.startsWith("2") || bookCode.startsWith("3") || bookCode.startsWith("4") || bookCode.startsWith("5"))) {
      if (Number(numbers[0]) <= 5) {
        numberIndex = 1; // Skippable first digit
      }
    }

    const chapVal = numbers[numberIndex] || numbers[0];
    if (chapVal) {
      const parsedNum = parseInt(chapVal, 10);
      if (parsedNum > 0 && parsedNum <= 150) { // Chapters are generally within 150
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

/**
 * Helper to normalize and extract Drive folder ID if user accidentally enters a complete url.
 */
function normalizeDriveFolderId(input) {
  if (!input) return "";
  const trimmed = input.trim();
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_\-]+)/);
  if (folderMatch) {
    console.log(`Extracted Google Drive Folder ID "${folderMatch[1]}" from URL.`);
    return folderMatch[1];
  }
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_\-]+)/);
  if (idMatch) {
    console.log(`Extracted Google Drive Folder ID "${idMatch[1]}" from open/ID URL.`);
    return idMatch[1];
  }
  return trimmed;
}

/**
 * Helper to normalize and extract YouTube playlist ID from raw input or full playlist URL.
 */
function normalizeYoutubePlaylistId(input) {
  if (!input) return "";
  const trimmed = input.trim();
  const listMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_\-]+)/);
  if (listMatch) {
    console.log(`Extracted YouTube Playlist ID "${listMatch[1]}" from URL.`);
    return listMatch[1];
  }
  return trimmed;
}

/**
 * Callable Web endpoint to trigger Google Drive and YouTube synchronized fetches
 */
exports.syncMediaSources = onCall({ region: "europe-west3" }, async (request) => {
  try {
    // 1. Authenticate and enforce Admin privileges
    let userEmail = "";
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      userEmail = request.auth?.token?.email || "ales.lajlar@gmail.com";
      console.log(`[Sync] Running in emulator mode. Bypassing auth check, using user email: ${userEmail}`);
    } else {
      if (!request.auth || !request.auth.token || !request.auth.token.email) {
        throw new HttpsError("unauthenticated", "Zahteva mora izvirati iz overjene administratorske seje. / Request must arise from an authenticated admin session.");
      }
      userEmail = request.auth.token.email;
    }
    console.log(`[Sync] Starting source synchronization triggered by admin user: ${userEmail}`);

    try {
      console.log(`[Sync] Checking administrative permission whitelist in document: admin_users/${userEmail}`);
      const adminDocRef = db.collection("admin_users").doc(userEmail);
      const adminDocSnap = await adminDocRef.get();
      if (!adminDocSnap.exists) {
        console.error(`[Sync] Access Denied: User "${userEmail}" is not listed in the "admin_users" collection.`);
        throw new HttpsError("permission-denied", `Vaš račun (${userEmail}) nima administratorskih pravic. / Your account does not possess administrator permissions.`);
      }
      console.log(`[Sync] Administrator clearance confirmed for: ${userEmail}`);
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("[Sync] Database read error during administrative clearance check:", err);
      throw new HttpsError("failed-precondition", `Preverjanje skrbniških pooblastil v Firestore ni uspelo / Verification of credentials in Firestore failed: ${err.message || String(err)}`);
    }

  // 2. Fetch current active configuration from settings document
  let settings = {};
  try {
    console.log("[Sync] Fetching settings configuration documents from Firestore...");
    // Try both global and general path locations to be perfectly safe
    const globalSettingsRef = db.collection("settings").doc("global");
    const globalSnap = await globalSettingsRef.get();
    if (globalSnap.exists) {
      settings = globalSnap.data();
      console.log("[Sync] Loaded settings from collection 'settings/global':", JSON.stringify(settings));
    } else {
      console.log("[Sync] Document 'settings/global' not found. Trying fallback 'settings/general'...");
      const generalSettingsRef = db.collection("settings").doc("general");
      const generalSnap = await generalSettingsRef.get();
      if (generalSnap.exists) {
        settings = generalSnap.data();
        console.log("[Sync] Loaded settings from collection 'settings/generalFallback':", JSON.stringify(settings));
      } else {
        console.warn("[Sync] Neither 'settings/global' nor 'settings/general' was found in Firestore! Initialization of settings is empty.");
      }
    }
  } catch (e) {
    console.error("[Sync] Failed to query settings structure from Firestore:", e);
    throw new HttpsError("failed-precondition", `Konfiguracijskih nastavitev ni bilo mogoče pridobiti / Configuration settings could not be retrieved from Firestore database: ${e.message || String(e)}`);
  }

  const rawDriveFolderId = settings.google_drive_folder_id;
  const rawYoutubePlaylistId = settings.youtube_playlist_id;

  const driveFolderId = normalizeDriveFolderId(rawDriveFolderId);
  const youtubePlaylistId = normalizeYoutubePlaylistId(rawYoutubePlaylistId);

  console.log(`[Sync] Normalized inputs - Drive Folder ID: "${driveFolderId}", YouTube Playlist ID: "${youtubePlaylistId}"`);

  if (!driveFolderId && !youtubePlaylistId) {
    console.error("[Sync] Configuration Error: Both Google Drive Folder ID and YouTube Playlist ID are empty.");
    throw new HttpsError("failed-precondition", "V nastavitvah ni določena ne mapa Google Drive ne YouTube seznam predvajanja. / Neither Google Drive Folder ID nor YouTube Source Playlist ID is defined in Settings.");
  }

  // Fetch the existing teachers to map them by name
  let teachersList = [];
  try {
    console.log("[Sync] Pre-loading Slovene Teachers metadata list for name matching heuristics...");
    const teachersSnap = await db.collection("teachers").get();
    teachersSnap.forEach((doc) => {
      teachersList.push({ id: doc.id, ...doc.data() });
    });
    console.log(`[Sync] Loaded ${teachersList.length} teacher(s) successfully for matching mapping.`);
  } catch (err) {
    console.error("[Sync] Failed to fetch teachers list for parser mapping:", err);
  }

  // Form helper auth client
  let googleAuth;
  try {
    console.log("[Sync] Initializing Google Application Default Credentials auth with drive/youtube scopes...");
    googleAuth = new google.auth.GoogleAuth({
      scopes: [
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/youtube.readonly"
      ]
    });
  } catch (err) {
    console.error("[Sync] Google Auth discovery initialization failed:", err);
    throw new HttpsError("failed-precondition", `Napaka pri inicializaciji Google overjanja / Google Auth initialization failed: ${err.message || String(err)}`);
  }

  let processedCount = 0;
  let itemsIndexed = [];
  let apiErrors = [];

  // 3. Sync from Google Drive if folder ID configured
  if (driveFolderId && driveFolderId !== "1A7b_G1p8D3g9P5h9Z6K_DriveFolderId") {
    console.log(`[Sync] Connecting to Google Drive API... Folder: ${driveFolderId}`);
    try {
      const authClient = await googleAuth.getClient();
      const drive = google.drive({ version: "v3", auth: authClient });
      
      console.log(`[Sync] Executing Drive files list lookups inside parent folder: "${driveFolderId}"`);
      const driveRes = await drive.files.list({
        q: `'${driveFolderId}' in parents and mimeType contains 'audio' and trashed = false`,
        fields: "files(id, name, webViewLink, createdTime, description)",
        pageSize: 40
      });

      const files = driveRes.data.files || [];
      console.log(`[Sync] Discovered ${files.length} audio file(s) in Drive Folder.`);

      for (const file of files) {
        itemsIndexed.push({
          source: "google_drive",
          file_id_or_video_id: file.id,
          raw_title: file.name,
          raw_description: file.description || "",
          file_url: file.webViewLink || ""
        });
      }
    } catch (err) {
      let friendlyMsg = "";
      const errMsgLc = (err.message || "").toLowerCase();
      if (errMsgLc.includes("not enabled") || errMsgLc.includes("not been used")) {
        friendlyMsg = "Google Drive API ni omogočen v Cloud projektu. Vklopite ga v Google Cloud Console. / Google Drive API is not enabled in the Cloud project. Enable it in the Google Cloud Console.";
      } else if (errMsgLc.includes("permission") || errMsgLc.includes("access denied") || errMsgLc.includes("forbidden")) {
        friendlyMsg = "Dostop zavrnjen za Google Drive. Prepričajte se, da ste mapo delili z e-poštnim naslovom storitvenega računa (service account) ali pa jo označili kot javno v skupni rabi. / Google Drive access denied. Confirm the folder shared permissions for the service account email or make it public.";
      } else if (errMsgLc.includes("not found")) {
        friendlyMsg = "Google Drive mapa ni bila najdena. Preverite ID mape v nastavitvah. / Google Drive folder ID was not found. Verify the folder ID matches.";
      } else {
        friendlyMsg = `Google Drive napaka / Google Drive error: ${err.message || String(err)}`;
      }
      console.error(`[Sync] Google Drive listing encountered an error:`, err);
      apiErrors.push(friendlyMsg);
    }
  } else {
    console.log("[Sync] Google Drive sync is disabled (folder ID not configured or is default template)");
  }

  // 4. Sync from YouTube if playlist ID configured
  if (youtubePlaylistId && youtubePlaylistId !== "PL_PLy_YTL_YoutubePlaylistId") {
    console.log(`[Sync] Connecting to YouTube Playlist v3 API... Playlist: ${youtubePlaylistId}`);
    try {
      const authClient = await googleAuth.getClient();
      const youtube = google.youtube({ version: "v3", auth: authClient });

      console.log(`[Sync] Executing YouTube playlistItems list query for Playlist: "${youtubePlaylistId}"`);
      const youtubeRes = await youtube.playlistItems.list({
        playlistId: youtubePlaylistId,
        part: "snippet",
        maxResults: 40
      });

      const videos = youtubeRes.data.items || [];
      console.log(`[Sync] Discovered ${videos.length} video item(s) in YouTube Playlist.`);

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
    } catch (err) {
      let friendlyMsg = "";
      const errMsgLc = (err.message || "").toLowerCase();
      if (errMsgLc.includes("not enabled") || errMsgLc.includes("not been used")) {
        friendlyMsg = "YouTube Data API v3 ni omogočen v Cloud projektu. Vklopite ga v Google Cloud Console. / YouTube Data API v3 is not enabled in the Cloud project. Enable it in the Google Cloud Console.";
      } else if (errMsgLc.includes("permission") || errMsgLc.includes("access denied") || errMsgLc.includes("forbidden") || errMsgLc.includes("private")) {
        friendlyMsg = "Dostop zavrnjen za YouTube Playlist. Prepričajte se, da je seznam predvajanja nastavljen kot 'Javen' (Public) ali 'Negledečen' (Unlisted). / YouTube playlist access denied. Make sure the playlist is set to 'Public' or 'Unlisted'.";
      } else if (errMsgLc.includes("not found") || errMsgLc.includes("playlistnotfound")) {
        friendlyMsg = "YouTube predvajalni seznam ni bil najden. Preverite ID seznama v nastavitvah. / YouTube playlist was not found. Confirm the ID in Settings matches.";
      } else {
        friendlyMsg = `YouTube napaka / YouTube error: ${err.message || String(err)}`;
      }
      console.error(`[Sync] YouTube Playlist listing encountered an error:`, err);
      apiErrors.push(friendlyMsg);
    }
  } else {
    console.log("[Sync] YouTube Playlist sync is disabled (playlist ID not configured or is default template)");
  }

  // If both configurations failed or returned API errors, we abort and report the API errors directly
  if (apiErrors.length > 0 && itemsIndexed.length === 0) {
    console.error(`[Sync] Synchronization aborted. No successful media streams listed, and following API errors occurred: ${apiErrors.join(" | ")}`);
    throw new HttpsError("unavailable", `Sinhronizacija ni uspela zaradi napak API-jev / API synchronization failed: ${apiErrors.join(" • ")}`);
  }

  if (itemsIndexed.length === 0) {
    console.log("[Sync] Synchronization completed safely with 0 documents discovered.");
    return {
      success: true,
      message: "Usklajevanje je končano. Nobeno novo gradivo ni bilo najdeno. Preverite nastavitve ali deljenje. / Sync completed. No new items discovered. Verify settings or permissions.",
      processed: 0
    };
  }

  console.log(`[Sync] Successfully parsed ${itemsIndexed.length} streams from source endpoints. Proceeding to persist into Firestore...`);

  // 5. Build, parser write records into Firestore 'import_items'
  for (const item of itemsIndexed) {
    const cleanTitle = item.raw_title;
    try {
      const lowerTitle = cleanTitle.toLowerCase();
      
      // Parse heuristic bible details
      const parsedBook = parseMetadataFromTitle(cleanTitle);

      // Parse heuristic teacher match
      let matchedTeacherId = "";
      let matchedTeacherName = "";
      for (const teacher of teachersList) {
        const nameNode = (teacher.full_name || teacher.name || "").toLowerCase();
        if (nameNode && lowerTitle.includes(nameNode)) {
          matchedTeacherId = teacher.id;
          matchedTeacherName = teacher.full_name || teacher.name || "";
          break;
        }
      }

      // Read existing item to prevent overwriting 'status' and custom selections
      const docId = `${item.source}_${item.file_id_or_video_id}`;
      const itemDocRef = db.collection("import_items").doc(docId);
      const existingSnap = await itemDocRef.get();

      const timestamp = new Date().toISOString();
      const payload = {
        id: docId,
        source: item.source,
        file_id_or_video_id: item.file_id_or_video_id,
        raw_title: item.raw_title,
        raw_description: item.raw_description,
        file_url: item.file_url,
        title_sl: item.raw_title, // Map fallback
        media_type: item.source === "google_drive" ? "audio" : "video",
        // Align score to percentage (0 - 100)
        confidence_score: Math.round(parsedBook.confidence * 100),
        updated_at: timestamp
      };

      // Add conditional schemas
      if (item.source === "google_drive") {
        payload.audio_url = item.file_url;
      } else {
        payload.youtube_url = item.file_url;
      }

      if (parsedBook.bookCode) {
        payload.bible_book_code = parsedBook.bookCode;
        payload.detected_bible_book_name = parsedBook.bookCode;
      }
      if (parsedBook.chapter) {
        payload.chapter_start = parsedBook.chapter;
        payload.detected_chapter = parsedBook.chapter;
      }
      if (matchedTeacherId) {
        payload.teacher_id = matchedTeacherId;
        payload.detected_teacher_name = matchedTeacherName;
      }

      if (existingSnap.exists) {
        // Update keeping status and teaching_id unchanged
        const currentData = existingSnap.data();
        payload.status = currentData.status || "unreviewed";
        if (currentData.teaching_id) {
          payload.teaching_id = currentData.teaching_id;
        }
        await itemDocRef.update(payload);
        console.log(`[Sync] Updated existing imported stream record in 'import_items': ${docId} ("${cleanTitle}")`);
      } else {
        // Set new unreviewed item
        payload.status = "unreviewed";
        payload.created_at = timestamp;
        await itemDocRef.set(payload);
        processedCount++;
        console.log(`[Sync] Created new imported stream record in 'import_items': ${docId} ("${cleanTitle}")`);
      }
    } catch (err) {
      console.error(`[Sync] Failed to handle individual item sync for stream "${cleanTitle}":`, err);
    }
  }

  const successMessageMsg = `Sync complete. ${processedCount} new, unique items registered, total ${itemsIndexed.length} processed of existing entries.`;
  console.log(`[Sync] Success! ${successMessageMsg}`);
  if (apiErrors.length > 0) {
    console.warn(`[Sync] Partial warning API errors detected during indexing: ${apiErrors.join(" | ")}`);
  }

  return {
    success: true,
    message: successMessageMsg,
    processed: processedCount
  };
} catch (globalError) {
  console.error("[Sync] Global error inside syncMediaSources function:", globalError);
  try {
    await db.collection("debug_logs").doc("sync_error").set({
      message: globalError.message || String(globalError),
      stack: globalError.stack || "No stack",
      timestamp: new Date().toISOString()
    });
  } catch (dbErr) {
    console.error("[Sync] Failed to write error log to Firestore:", dbErr);
  }
  if (globalError instanceof HttpsError) {
    throw globalError;
  }
  throw new HttpsError("failed-precondition", `Global sync failure: ${globalError.message || String(globalError)}\nStack: ${globalError.stack || "No stack"}`);
}
});
