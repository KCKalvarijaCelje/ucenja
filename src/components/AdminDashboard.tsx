/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  ShieldAlert, LayoutDashboard, FileText, Users, RefreshCw, X, 
  Settings, LogOut, Plus, Edit2, Trash2, CheckCircle, 
  AlertCircle, Eye, EyeOff, Save, Trash, HelpCircle, 
  FileCheck, ArrowRight, Video, Volume2, Link2, Sparkles,
  Mail, Send, Upload, Camera, Images
} from "lucide-react";
import { supabase } from "../supabaseClient";
import type { User } from "@supabase/supabase-js";
import { Teacher, Teaching, AdminSettings, ImportedMediaItem, MatchSuggestion, BIBLE_BOOKS, BIBLE_BOOKS_MAP, ImportItem } from "../types";
import { TRANSLATIONS } from "../translations";
import { slugify, computeSuggestedMatches, parseMediaTitle } from "../utils";
import { sendResendEmail, buildNewTeachingEmailHtml } from "../services/emailService";
import { getAudioUrl, getMediaUrl } from "../lib/cdn";
import { optimizeImageToDataUrl, optimizeImageFile, createCleanStoragePath } from "../lib/imageOptimizer";

interface AdminDashboardProps {
  currentLang: 'sl' | 'en';
  teachers: Teacher[];
  teachings: Teaching[];
  onRefreshData: () => Promise<void>;
}

type AdminTab = 'dashboard' | 'teachings' | 'teachers' | 'imports' | 'settings';

export function AdminDashboard({ currentLang, teachers, teachings, onRefreshData }: AdminDashboardProps) {
  const t = TRANSLATIONS[currentLang];

  // Auth States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isDemoBypass, setIsDemoBypass] = useState(false);
  const [isAdminChecking, setIsAdminChecking] = useState(false);

  // General States
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [settings, setSettings] = useState<AdminSettings>({
    google_drive_folder_id: "1A7b_G1p8D3g9P5h9Z6K_DriveFolderId",
    youtube_playlist_id: "PL_PLy_YTL_YoutubePlaylistId",
    sync_interval_days: 7,
    auto_suggest_matching: true
  });
  
  // Pending Imports State
  const [pendingImports, setPendingImports] = useState<ImportedMediaItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Editing States
  const [isEditingTeaching, setIsEditingTeaching] = useState(false);
  const [editingTeaching, setEditingTeaching] = useState<Partial<Teaching> | null>(null);
  const [teachingFormHasChanges, setTeachingFormHasChanges] = useState(false);

  const [isEditingTeacher, setIsEditingTeacher] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Partial<Teacher> | null>(null);
  const [teacherFormHasChanges, setTeacherFormHasChanges] = useState(false);

  // Manual Import Link state
  const [linkingMedia, setLinkingMedia] = useState<ImportedMediaItem | null>(null);
  const [manualLinkTargetId, setManualLinkTargetId] = useState("");

  // Sub-tabs on imports workflow
  const [importSubTab, setImportSubTab] = useState<'matches' | 'unlinked'>('matches');

  // Form draft indicators
  const [teachingDraftSavedTime, setTeachingDraftSavedTime] = useState<string>("");
  const [teacherDraftSavedTime, setTeacherDraftSavedTime] = useState<string>("");

  // Searchable teacher dropdown
  const [teacherSearchQuery, setTeacherSearchQuery] = useState("");
  const [isTeacherDropdownOpen, setIsTeacherDropdownOpen] = useState(false);

  // Import review queue
  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [importFilterSource, setImportFilterSource] = useState<'all' | 'drive' | 'youtube'>('all');
  const [importFilterStatus, setImportFilterStatus] = useState<'all' | 'unreviewed' | 'linked' | 'new_teaching_created' | 'ignored'>('unreviewed');

  // Import actions & linking
  const [linkingItem, setLinkingItem] = useState<ImportItem | null>(null);
  const [linkTargetTeachingId, setLinkTargetTeachingId] = useState("");
  const [linkSearchQuery, setLinkSearchQuery] = useState("");

  // Email Broadcast State
  const [broadcastTeaching, setBroadcastTeaching] = useState<Teaching | null>(null);
  const [broadcastRecipientMode, setBroadcastRecipientMode] = useState<'all' | 'custom'>('all');
  const [broadcastCustomEmail, setBroadcastCustomEmail] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState<{ success: boolean; message: string } | null>(null);

  const handleSendTeachingBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTeaching) return;

    setIsSendingBroadcast(true);
    setBroadcastStatus(null);

    const teacher = teachers.find(tc => tc.id === broadcastTeaching.teacher_id);
    const teacherName = teacher?.full_name || 'KC Kalvarija';
    const listenUrl = `https://kalvarija.si/ucenja#/${broadcastTeaching.slug || broadcastTeaching.id}`;

    let recipients: string[] = [];
    if (broadcastRecipientMode === 'custom') {
      recipients = broadcastCustomEmail.split(',').map(em => em.trim()).filter(em => em && em.includes('@'));
    } else {
      // Pull registered members from supabase profiles
      try {
        const { data: profs } = await supabase.from('profiles').select('email');
        if (profs && profs.length > 0) {
          recipients = profs.map((p: any) => p.email).filter((em: any) => em && em.includes('@'));
        }
      } catch (err) {
        console.warn('Could not load profiles for broadcast:', err);
      }
      if (recipients.length === 0) {
        recipients = ['info@kalvarija.si'];
      }
    }

    if (recipients.length === 0) {
      alert('Ni veljavnih prejemnikov.');
      setIsSendingBroadcast(false);
      return;
    }

    const html = buildNewTeachingEmailHtml({
      title: broadcastTeaching.title_sl || broadcastTeaching.title_en || 'Novo učenje',
      teacherName,
      dateStr: broadcastTeaching.teaching_date,
      biblePassage: broadcastTeaching.bible_book_code ? `${broadcastTeaching.bible_book_code} ${broadcastTeaching.chapter_start || ''}` : undefined,
      description: broadcastTeaching.description_sl || broadcastTeaching.description_en,
      listenUrl,
      audioUrl: broadcastTeaching.audio_url,
      videoUrl: broadcastTeaching.youtube_url,
    });

    try {
      const res = await sendResendEmail({
        to: recipients,
        subject: `📖 Novo učenje: ${broadcastTeaching.title_sl || 'Nagovor'} (${teacherName}) • KC Kalvarija`,
        html,
      });

      if (res.success) {
        setBroadcastStatus({
          success: true,
          message: `✓ Obvestilo uspešno poslano ${recipients.length} prejemnikom preko Resend (@kalvarija.si)!`,
        });
      } else {
        setBroadcastStatus({
          success: false,
          message: `Napaka pri pošiljanju: ${res.error || 'Neznana napaka'}`,
        });
      }
    } catch (err: any) {
      setBroadcastStatus({
        success: false,
        message: `Napaka: ${err.message}`,
      });
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  // Synchronize activeTab based on location hash
  useEffect(() => {
    const handleHashSync = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#/admin/")) {
        const tab = hash.replace("#/admin/", "") as AdminTab;
        const validTabs: AdminTab[] = ['dashboard', 'teachings', 'teachers', 'imports', 'settings'];
        if (validTabs.includes(tab)) {
          setActiveTab(tab);
        }
      }
    };
    window.addEventListener('hashchange', handleHashSync);
    handleHashSync();
    return () => window.removeEventListener('hashchange', handleHashSync);
  }, []);

  // Update hash when tab changes
  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    window.location.hash = `#/admin/${tab}`;
  };

  // Helper to verify admin credentials
  const handleUserAuth = async (user: User | null) => {
    if (user) {
      if (isDemoBypass) {
        setCurrentUser(user);
        return;
      }

      setIsAdminChecking(true);
      try {
        const userEmail = user.email;
        if (userEmail) {
          const { data: adminUser } = await supabase
            .from("admin_users")
            .select("email, role")
            .eq("email", userEmail)
            .maybeSingle();

          if (adminUser) {
            setCurrentUser(user);
            setAuthError("");
          } else {
            setAuthError(currentLang === 'sl' 
              ? "Nimate dovoljenja za dostop do uredniškega sistema." 
              : "You do not have permission to access the admin area."
            );
            setCurrentUser(null);
            await supabase.auth.signOut();
          }
        } else {
          setAuthError(currentLang === 'sl' 
            ? "Nimate dovoljenja za dostop do uredniškega sistema." 
            : "You do not have permission to access the admin area."
          );
          setCurrentUser(null);
          await supabase.auth.signOut();
        }
      } catch (err) {
        console.error("Failed to verify admin status:", err);
        setAuthError(currentLang === 'sl'
          ? "Napaka pri preverjanju pooblastil."
          : "Error verifying admin authorization."
        );
        setCurrentUser(null);
        await supabase.auth.signOut();
      } finally {
        setIsAdminChecking(false);
      }
    } else {
      setCurrentUser(null);
      setIsAdminChecking(false);
    }
  };

  // Track user login state and check permissions
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleUserAuth(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      handleUserAuth(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [isDemoBypass, currentLang]);

  // Fetch settings & imported items
  useEffect(() => {
    if (currentUser || isDemoBypass) {
      loadSettings();
      loadPendingImports();
    }
  }, [currentUser, isDemoBypass]);

  // Load import items list with realtime synchronization
  useEffect(() => {
    if (currentUser || isDemoBypass) {
      const fetchImportItems = async () => {
        const { data } = await supabase
          .from("import_items")
          .select("*")
          .order("created_at", { ascending: false });
        if (data) {
          setImportItems(data as ImportItem[]);
        }
      };
      fetchImportItems();

      const channel = supabase
        .channel("admin-import-items-channel")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "import_items" },
          () => {
            fetchImportItems();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentUser, isDemoBypass]);

  // Sync the unsaved changes state to localStorage for the global hash guard
  useEffect(() => {
    localStorage.setItem("teaching_form_has_changes", teachingFormHasChanges ? "true" : "false");
  }, [teachingFormHasChanges]);

  useEffect(() => {
    localStorage.setItem("teacher_form_has_changes", teacherFormHasChanges ? "true" : "false");
  }, [teacherFormHasChanges]);

  // Draft Autosave Managers using specific key naming patterns
  useEffect(() => {
    if (isEditingTeaching && editingTeaching) {
      const key = `teaching_form_draft_${editingTeaching.id || 'new'}`;
      localStorage.setItem(key, JSON.stringify(editingTeaching));
      const now = new Date();
      const HH = String(now.getHours()).padStart(2, '0');
      const MM = String(now.getMinutes()).padStart(2, '0');
      setTeachingDraftSavedTime(`${HH}:${MM}`);
    }
  }, [editingTeaching, isEditingTeaching]);

  useEffect(() => {
    if (isEditingTeacher && editingTeacher) {
      const key = `teacher_form_draft_${editingTeacher.id || 'new'}`;
      localStorage.setItem(key, JSON.stringify(editingTeacher));
      const now = new Date();
      const HH = String(now.getHours()).padStart(2, '0');
      const MM = String(now.getMinutes()).padStart(2, '0');
      setTeacherDraftSavedTime(`${HH}:${MM}`);
    }
  }, [editingTeacher, isEditingTeacher]);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from("admin_settings")
        .select("*")
        .eq("id", "global")
        .maybeSingle();
      if (data) {
        setSettings(data as AdminSettings);
      }
    } catch (e) {
      console.error("Error loading settings:", e);
    }
  };

  const loadPendingImports = async () => {
    try {
      const { data } = await supabase
        .from("pending_imports")
        .select("*")
        .order("imported_at", { ascending: false });
      if (data) {
        setPendingImports(data as ImportedMediaItem[]);
      }
    } catch (e) {
      console.error("Error loading imports:", e);
    }
  };

  // Auth Handling
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setIsAdminChecking(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
    } catch (err: any) {
      console.error(err);
      setAuthError(`${t.login_error} (${err.message || err.code})`);
      setIsAdminChecking(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError("");
    setIsAdminChecking(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/#/admin`
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      setAuthError((currentLang === 'sl'
        ? "Prijava z Googlom ni uspela. Poskusite znova."
        : "Google sign-in failed. Please try again.") + ` (${err.message || err.code})`
      );
      setIsAdminChecking(false);
    }
  };

  const handleLogout = async () => {
    if (isDemoBypass) {
      setIsDemoBypass(false);
    } else {
      await supabase.auth.signOut();
    }
    handleTabChange('dashboard');
    window.location.hash = '#/';
  };

  // Settings Save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from("admin_settings")
        .upsert({ id: "global", ...settings, updated_at: new Date().toISOString() });
      if (error) throw error;
      triggerAlert(t.form_saved_success);
    } catch (err) {
      console.error(err);
    }
  };

  // Quick info alert trigger
  const triggerAlert = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  // Sync / Import Triggers via Supabase Edge Function
  const handleTriggerSync = async () => {
    setSyncing(true);
    triggerAlert(t.sync_starting);
    
    try {
      const { data, error } = await supabase.functions.invoke<{ success: boolean; message: string; processed: number }>(
        'sync-media',
        {
          body: { triggered_by: currentUser?.email || "admin@church.si" }
        }
      );
      
      if (error) throw error;
      
      const count = data?.processed ?? 0;
      
      // Reload on-screen reviews queue immediately
      await onRefreshData();
      await loadPendingImports();
      
      const successMsg = t.sync_success.replace('{count}', String(count));
      triggerAlert(successMsg);
    } catch (err: any) {
      console.error("Sync error:", err);
      const errMsg = err?.message || String(err);
      triggerAlert(t.sync_failed.replace('{error}', errMsg));
    } finally {
      setSyncing(false);
    }
  };

  // DISMISS ITEM FROM IMPORT Review Area
  const handleDismissImportItem = async (itemId: string) => {
    try {
      await supabase.from("pending_imports").delete().eq("id", itemId);
      setPendingImports(prev => prev.filter(i => i.id !== itemId));
      triggerAlert(currentLang === 'sl' ? "Element prezrt." : "Media item discarded.");
    } catch (e) {
      console.error(e);
    }
  };

  // LINK / ATTACH MEDIA TO EXISTING TEACHING PUBLICly
  const handleAttachMediaToExisting = async (itemId: string, targetTeachingId: string) => {
    try {
      const item = pendingImports.find(i => i.id === itemId);
      const target = teachings.find(t => t.id === targetTeachingId);
      if (!item || !target) return;

      const updatedFields: Partial<Teaching> = {};
      if (item.source === 'google_drive') {
        updatedFields.audio_url = item.media_url;
        updatedFields.google_drive_file_id = item.file_id_or_video_id;
        updatedFields.media_type = target.media_type === 'video' ? 'audio_video' : 'audio';
      } else {
        updatedFields.youtube_url = item.media_url;
        updatedFields.youtube_video_id = item.file_id_or_video_id;
        updatedFields.media_type = target.media_type === 'audio' ? 'audio_video' : 'video';
        if (item.thumbnail_url) updatedFields.thumbnail_url = item.thumbnail_url;
      }

      await supabase.from("teachings").update(updatedFields).eq("id", targetTeachingId);
      await supabase.from("pending_imports").delete().eq("id", itemId);

      setPendingImports(prev => prev.filter(i => i.id !== itemId));
      setLinkingMedia(null);
      setManualLinkTargetId("");
      triggerAlert(t.imported_item_success);
      await onRefreshData();
    } catch (e) {
      console.error(e);
    }
  };

  // CREATE NEW TEACHING RECORD DIRECTLY FROM IMPORT
  const handleCreateNewFromImport = async (item: ImportedMediaItem) => {
    const parsed = parseMediaTitle(item.title);
    
    // Find matching teacher id if teacher name found
    let teacherId = teachers[0]?.id || "";
    if (parsed.teacher_name) {
      const matchedTeacher = teachers.find(tr => 
        tr.full_name.toLowerCase().includes(parsed.teacher_name.toLowerCase())
      );
      if (matchedTeacher) {
        teacherId = matchedTeacher.id;
      }
    }

    // Set form draft to fill out
    const newDraft: Partial<Teaching> = {
      title_sl: parsed.title,
      title_en: "",
      slug: slugify(parsed.title),
      teacher_id: teacherId,
      teaching_date: new Date().toISOString().split('T')[0],
      bible_book_code: parsed.bible_book_code,
      chapter_start: parsed.chapter_start,
      chapter_end: parsed.chapter_start,
      media_type: item.source === 'google_drive' ? 'audio' : 'video',
      audio_url: item.source === 'google_drive' ? item.media_url : "",
      google_drive_file_id: item.source === 'google_drive' ? item.file_id_or_video_id : "",
      youtube_url: item.source === 'youtube' ? item.media_url : "",
      youtube_video_id: item.source === 'youtube' ? item.file_id_or_video_id : "",
      thumbnail_url: item.thumbnail_url || "",
      duration_text: item.duration_text || "",
      published: false,
      featured: false,
      summary_sl: "",
      summary_en: "",
      notes_sl: "",
      notes_en: "",
      transcript_sl: "",
      transcript_en: ""
    };

    // Pre-fill localStorage so form retains it
    setEditingTeaching(newDraft);
    setIsEditingTeaching(true);
    setTeachingFormHasChanges(true);

    // Auto delete item from pending stream upon load/prepare to publish
    setActiveTab('teachings');
    await handleDismissImportItem(item.id);
  };

  // MULTI ATTACH / FUZZY MATCH RESOLUTION
  const handleAcceptFuzzyMatch = async (match: MatchSuggestion) => {
    try {
      // 1. Create fully linked record
      const parsedAudio = parseMediaTitle(match.audio_item.title);
      let matchedTeacher = teachers.find(tr => 
        tr.full_name.toLowerCase().includes(parsedAudio.teacher_name.toLowerCase())
      );
      const teacherId = matchedTeacher ? matchedTeacher.id : (teachers[0]?.id || "");

      const newId = `t_linked_${Date.now()}`;
      const newTeaching: Teaching = {
        id: newId,
        title_sl: parsedAudio.title,
        title_en: "",
        slug: slugify(parsedAudio.title),
        teaching_date: new Date().toISOString().split('T')[0],
        teacher_id: teacherId,
        series_name_sl: "",
        series_name_en: "",
        summary_sl: "",
        summary_en: "",
        notes_sl: "",
        notes_en: "",
        transcript_sl: "",
        transcript_en: "",
        bible_book_code: parsedAudio.bible_book_code,
        chapter_start: parsedAudio.chapter_start,
        media_type: 'audio_video',
        audio_url: match.audio_item.media_url,
        google_drive_file_id: match.audio_item.file_id_or_video_id,
        youtube_url: match.video_item.media_url,
        youtube_video_id: match.video_item.file_id_or_video_id,
        thumbnail_url: match.video_item.thumbnail_url || "",
        duration_text: match.video_item.duration_text || match.audio_item.duration_text || "",
        published: true, // auto publish matched items securely
        featured: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await supabase.from("teachings").insert(newTeaching);

      // 2. Clear both files from pending lists
      await supabase.from("pending_imports").delete().in("id", [match.audio_item.id, match.video_item.id]);

      setPendingImports(prev => prev.filter(i => i.id !== match.audio_item.id && i.id !== match.video_item.id));
      triggerAlert(t.imported_item_success);
      await onRefreshData();
    } catch (e) {
      console.error(e);
    }
  };

  // Split pending list into audio and video streams
  const driveAudioStreams = pendingImports.filter(i => i.source === 'google_drive');
  const ytVideoStreams = pendingImports.filter(i => i.source === 'youtube');

  // Compute fuzzy similarity suggestions
  const computedSuggestions = useMemo(() => {
    return computeSuggestedMatches(driveAudioStreams, ytVideoStreams);
  }, [pendingImports]);

  // TEACHING FORM MANAGEMENT
  const handleAddNewTeachingTrigger = () => {
    const savedDraft = localStorage.getItem("teaching_form_draft_new");
    let initialForm: Partial<Teaching> = {
      title_sl: "",
      title_en: "",
      slug: "",
      teacher_id: teachers[0]?.id || "",
      bible_book_code: "ROM",
      chapter_start: 1,
      media_type: 'audio',
      teaching_date: new Date().toISOString().split('T')[0],
      published: false,
      featured: false,
      summary_sl: "",
      summary_en: "",
      notes_sl: "",
      notes_en: "",
      transcript_sl: "",
      transcript_en: "",
      audio_url: "",
      youtube_url: "",
      youtube_video_id: ""
    };

    if (savedDraft) {
      if (window.confirm(currentLang === 'sl' ? "Najden je bil shranjen osnutek. Želite nadaljevati z delom na osnutku?" : "A saved draft was found. Do you want to restore it?")) {
        initialForm = JSON.parse(savedDraft);
      } else {
        localStorage.removeItem("teaching_form_draft_new");
      }
    }

    setEditingTeaching(initialForm);
    setIsEditingTeaching(true);
    setTeachingFormHasChanges(false);
  };

  const handleEditTeachingTrigger = (item: Teaching) => {
    const savedDraft = localStorage.getItem(`teaching_form_draft_${item.id}`);
    let initialForm: Partial<Teaching> = item;

    if (savedDraft) {
      if (window.confirm(currentLang === 'sl' ? "Najden je bil shranjen osnutek za ta nauk. Želite nadaljevati z delom na osnutku?" : "A saved draft was found for this teaching. Do you want to restore it?")) {
        initialForm = JSON.parse(savedDraft);
      } else {
        localStorage.removeItem(`teaching_form_draft_${item.id}`);
      }
    }

    setEditingTeaching(initialForm);
    setIsEditingTeaching(true);
    setTeachingFormHasChanges(false);
  };

  const handleLeaveFormWithDiscard = () => {
    if (teachingFormHasChanges) {
      if (!window.confirm(t.unsaved_warning)) {
        return;
      }
    }
    setIsEditingTeaching(false);
    setEditingTeaching(null);
    setTeachingFormHasChanges(false);
  };

  const handleSaveTeaching = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeaching) return;

    // VALIDATION CHECKS
    const { title_sl, teacher_id, bible_book_code, chapter_start, media_type, youtube_url, audio_url, google_drive_file_id } = editingTeaching;
    if (!title_sl || !teacher_id || !bible_book_code || !chapter_start || !media_type) {
      alert(t.form_validation_error);
      return;
    }

    if (media_type === 'video' && !youtube_url) {
      alert(currentLang === 'sl' ? "Video predvajanje zahteva YouTube povezavo!" : "Video media choice requires a YouTube Link!");
      return;
    }

    if (media_type === 'audio' && !audio_url && !google_drive_file_id) {
      alert(currentLang === 'sl' ? "Avdio predvajanje zahteva povezavo do mp3 posnetka ali Google Drive File ID!" : "Audio choice requires an Audio URL or Google Drive file ID!");
      return;
    }

    try {
      const isNew = !editingTeaching.id;
      const parsedId = isNew ? `teaching_${Date.now()}` : editingTeaching.id!;

      // Duplicate slug resolution
      let baseSlug = slugify(editingTeaching.title_sl || "t");
      let uniqueSlug = baseSlug;
      let counter = 2;
      while (teachings.some(t => t.slug === uniqueSlug && t.id !== editingTeaching.id)) {
        uniqueSlug = `${baseSlug}-${counter}`;
        counter++;
      }
      if (uniqueSlug !== baseSlug) {
        alert(t.dup_slug_warning);
      }

      // Parse YouTube Video ID if youtube link is pasted
      let youtubeVideoId = editingTeaching.youtube_video_id || "";
      if (editingTeaching.youtube_url) {
        const urlMatch = editingTeaching.youtube_url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/);
        if (urlMatch) {
          youtubeVideoId = urlMatch[1];
        }
      }

      const savePayload: Teaching = {
        ...(editingTeaching as Teaching),
        id: parsedId,
        youtube_video_id: youtubeVideoId,
        slug: uniqueSlug,
        created_at: editingTeaching.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: saveErr } = await supabase.from("teachings").upsert(savePayload);
      if (saveErr) throw saveErr;

      // Handle linked import item status update
      const linkedImportId = localStorage.getItem("linked_import_item_id");
      if (linkedImportId) {
        await supabase.from("import_items").update({
          status: 'new_teaching_created',
          teaching_id: parsedId,
          updated_at: new Date().toISOString()
        }).eq("id", linkedImportId);
        localStorage.removeItem("linked_import_item_id");
      }
      
      triggerAlert(t.form_saved_success);
      setIsEditingTeaching(false);
      setEditingTeaching(null);
      localStorage.removeItem(`teaching_form_draft_${isNew ? 'new' : parsedId}`);
      setTeachingFormHasChanges(false);
      await onRefreshData();
    } catch (e) {
      console.error(e);
    }
  };

  // TEACHER LISTS SECTION
  const handleAddNewTeacherTrigger = () => {
    const savedDraft = localStorage.getItem("teacher_form_draft_new");
    let initialForm: Partial<Teacher> = {
      full_name: "",
      slug: "",
      short_bio_sl: "",
      short_bio_en: "",
      photo_url: "",
      active: true
    };

    if (savedDraft) {
      if (window.confirm(currentLang === 'sl' ? "Najden je bil shranjen osnutek za tega učitelja. Želite nadaljevati z delom?" : "A saved draft was found for this teacher. Do you want to restore it?")) {
        initialForm = JSON.parse(savedDraft);
      } else {
        localStorage.removeItem("teacher_form_draft_new");
      }
    }

    setEditingTeacher(initialForm);
    setIsEditingTeacher(true);
    setTeacherFormHasChanges(false);
  };

  const handleEditTeacherTrigger = (item: Teacher) => {
    const savedDraft = localStorage.getItem(`teacher_form_draft_${item.id}`);
    let initialForm: Partial<Teacher> = item;

    if (savedDraft) {
      if (window.confirm(currentLang === 'sl' ? "Najden je bil shranjen osnutek za tega učitelja. Želite nadaljevati z delom?" : "A saved draft was found for this teacher. Do you want to restore it?")) {
        initialForm = JSON.parse(savedDraft);
      } else {
        localStorage.removeItem(`teacher_form_draft_${item.id}`);
      }
    }

    setEditingTeacher(initialForm);
    setIsEditingTeacher(true);
    setTeacherFormHasChanges(false);
  };

  const handleLeaveTeacherWithDiscard = () => {
    if (teacherFormHasChanges) {
      if (!window.confirm(t.unsaved_warning)) {
        return;
      }
    }
    setIsEditingTeacher(false);
    setEditingTeacher(null);
    setTeacherFormHasChanges(false);
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher || !editingTeacher.full_name) {
      alert(t.form_validation_error);
      return;
    }

    // Check pre-existing duplicate full_name
    const lowercaseName = editingTeacher.full_name.trim().toLowerCase();
    const existingTeacherWithSameName = teachers.find(
      tr => tr.full_name.toLowerCase().trim() === lowercaseName && tr.id !== editingTeacher.id
    );
    if (existingTeacherWithSameName) {
      if (!window.confirm(t.dup_teacher_warning)) {
        return;
      }
    }

    try {
      const isNew = !editingTeacher.id;
      const parsedId = isNew ? `teacher_${Date.now()}` : editingTeacher.id!;

      // Slug with conflict check
      let baseSlug = slugify(editingTeacher.full_name);
      let uniqueSlug = baseSlug;
      let counter = 2;
      while (teachers.some(tr => tr.slug === uniqueSlug && tr.id !== editingTeacher.id)) {
        uniqueSlug = `${baseSlug}-${counter}`;
        counter++;
      }

      const savePayload: Teacher = {
        ...(editingTeacher as Teacher),
        id: parsedId,
        slug: uniqueSlug,
        active: editingTeacher.active !== false
      };

      const { error: trSaveErr } = await supabase.from("teachers").upsert(savePayload);
      if (trSaveErr) throw trSaveErr;

      triggerAlert(t.form_teacher_saved);
      setIsEditingTeacher(false);
      setEditingTeacher(null);
      localStorage.removeItem(`teacher_form_draft_${isNew ? 'new' : parsedId}`);
      setTeacherFormHasChanges(false);
      await onRefreshData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeactivateTeacher = async (teacherId: string, currentActive: boolean) => {
    try {
      await supabase.from("teachers").update({ active: !currentActive }).eq("id", teacherId);
      triggerAlert(currentLang === 'sl' ? "Status učitelja posodobljen" : "Teacher status updated");
      await onRefreshData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTeaching = async (id: string) => {
    if (window.confirm(currentLang === 'sl' ? "Ali res želite izbrisati to pridigo iz arhiva?" : "Are you sure you want to delete this sermon?")) {
      try {
        await supabase.from("teachings").delete().eq("id", id);
        triggerAlert(currentLang === 'sl' ? "Nauk uspešno odstranjen" : "Teaching deleted successfully");
        await onRefreshData();
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Seed 3 mock items to Supabase table `import_items` for review queue representation
  const handleSeedSampleImports = async () => {
    try {
      const mockItems: ImportItem[] = [
        {
          id: `import_drive_${Date.now()}_1`,
          title_sl: "Gora Jezusove spremenitve",
          title_en: "The Mount of Transfiguration",
          teacher_id: teachers[0]?.id || "t1",
          bible_book_code: "LUK",
          chapter_start: 9,
          verse_start: 28,
          verse_end: 36,
          media_type: "audio",
          audio_url: "https://example.com/audio/transfiguration.mp3",
          youtube_url: "",
          source: "google_drive",
          status: "unreviewed",
          confidence_score: 95,
          created_at: new Date().toISOString()
        },
        {
          id: `import_yt_${Date.now()}_2`,
          title_sl: "Hoja po vodi v veri",
          title_en: "Walking on Water in Faith",
          teacher_id: teachers[0]?.id || "t1",
          bible_book_code: "MAT",
          chapter_start: 14,
          verse_start: 22,
          verse_end: 33,
          media_type: "video",
          audio_url: "",
          youtube_url: "https://www.youtube.com/watch?v=mock_video_id_1",
          source: "youtube",
          status: "unreviewed",
          confidence_score: 64, // Needs review highlight! (< 70)
          created_at: new Date().toISOString()
        },
        {
          id: `import_drive_${Date.now()}_3`,
          title_sl: "Gospod je moj pastir",
          title_en: "The Lord is My Shepherd",
          teacher_id: teachers[0]?.id || "t1",
          bible_book_code: "PSA",
          chapter_start: 23,
          verse_start: 1,
          verse_end: 6,
          media_type: "audio",
          audio_url: "https://example.com/audio/psalm23.mp3",
          youtube_url: "",
          source: "google_drive",
          status: "unreviewed",
          confidence_score: 82,
          created_at: new Date().toISOString()
        }
      ];

      const { error: seedErr } = await supabase.from("import_items").upsert(mockItems);
      if (seedErr) throw seedErr;

      triggerAlert(currentLang === 'sl' ? "3 vzorčni uvoženi predmeti so bili ustvarjeni v bazi!" : "3 sample import items seeded successfully to Supabase!");
    } catch (e) {
      console.error("Error seeding import items:", e);
      triggerAlert("Error: " + String(e));
    }
  };

  const handleIgnoreImportItem = async (itemId: string) => {
    try {
      await supabase.from("import_items").update({
        status: 'ignored',
        updated_at: new Date().toISOString()
      }).eq("id", itemId);
      triggerAlert(currentLang === 'sl' ? "Predmet prezrt" : "Import item status set to ignored");
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerImportLinkDialog = (item: ImportItem) => {
    setLinkingItem(item);
    setLinkTargetTeachingId("");
    setLinkSearchQuery("");
  };

  const handleConfirmLinkImport = async () => {
    if (!linkingItem || !linkTargetTeachingId) return;

    try {
      const selectedTeaching = teachings.find(t => t.id === linkTargetTeachingId);
      if (!selectedTeaching) return;

      // Update the selected teaching doc with the new media streams (without replacing other fields)
      const updatePayload: Partial<Teaching> = {};
      if (linkingItem.media_type === 'audio') {
        updatePayload.audio_url = linkingItem.audio_url || selectedTeaching.audio_url;
      } else {
        updatePayload.youtube_url = linkingItem.youtube_url || selectedTeaching.youtube_url;
        // Also parse youtube video id if YouTube URL updated
        if (linkingItem.youtube_url) {
          const urlMatch = linkingItem.youtube_url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/);
          if (urlMatch) {
            updatePayload.youtube_video_id = urlMatch[1];
          }
        }
      }

      await supabase.from("teachings").update({
        ...updatePayload,
        updated_at: new Date().toISOString()
      }).eq("id", linkTargetTeachingId);

      // Update the status of import item to linked
      await supabase.from("import_items").update({
        status: 'linked',
        teaching_id: linkTargetTeachingId,
        updated_at: new Date().toISOString()
      }).eq("id", linkingItem.id);

      triggerAlert(currentLang === 'sl' ? "Uspešno povezano z obstoječim naukom!" : "Successfully linked media stream to teaching!");
      setLinkingItem(null);
      setLinkTargetTeachingId("");
      await onRefreshData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateNewTeachingFromImport = (item: ImportItem) => {
    // Save imported item ID to localStorage to associate once saved
    localStorage.setItem("linked_import_item_id", item.id);

    const mockDraft: Partial<Teaching> = {
      title_sl: item.title_sl || "",
      title_en: item.title_en || "",
      teacher_id: item.teacher_id || teachers[0]?.id || "",
      bible_book_code: item.bible_book_code || "ROM",
      chapter_start: item.chapter_start || 1,
      verse_start: item.verse_start || null,
      verse_end: item.verse_end || null,
      media_type: item.media_type || 'audio',
      audio_url: item.audio_url || "",
      youtube_url: item.youtube_url || "",
      published: false,
      featured: false,
      teaching_date: new Date().toISOString().split('T')[0],
      summary_sl: "",
      summary_en: "",
      notes_sl: "",
      notes_en: "",
      transcript_sl: "",
      transcript_en: ""
    };

    // Save draft and boot view
    localStorage.setItem("teaching_form_draft_new", JSON.stringify(mockDraft));
    setEditingTeaching(mockDraft);
    setIsEditingTeaching(true);
    setTeachingFormHasChanges(true);
    
    // Switch to teachings tab to fill details
    handleTabChange('teachings');
    triggerAlert(currentLang === 'sl' ? "Obrazec napolnjen iz predmeta uvoza!" : "Form pre-populated with import properties!");
  };

  // RENDER AUTHENTICATION PAGE FIRST IF NOT LOGGED IN
  if (!currentUser && !isDemoBypass) {
    return (
      <div id="admin-auth-portal" className="max-w-md mx-auto my-12 p-8 bg-white border border-gray-150 rounded-2xl shadow-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-sans font-bold text-gray-900">{t.admin_auth}</h2>
          <p className="text-xs text-gray-500">Sign in to publish teachings and oversee Google Drive/YouTube imports.</p>
        </div>

        {isAdminChecking && (
          <div id="auth-checking-indicator" className="flex items-center justify-center p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-mono tracking-wide gap-2">
            <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            <span>{currentLang === 'sl' ? "Preverjanje pooblastil..." : "Checking credentials..."}</span>
          </div>
        )}

        {authError && (
          <div id="login-error" className="flex items-center gap-2 p-3 bg-red-55/10 border border-red-200 rounded-xl text-xs text-red-650 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleLogin} id="login-form" className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">{t.email}</label>
            <input
              id="login-email"
              type="email"
              placeholder="e.g. pastor@church.si"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none"
              disabled={isAdminChecking}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">{t.password}</label>
            <input
              id="login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none"
              disabled={isAdminChecking}
            />
          </div>

          <button
            id="login-submit"
            type="submit"
            disabled={isAdminChecking}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-xs cursor-pointer transition disabled:opacity-50"
          >
            {t.submit_login}
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-150"></div>
            <span className="flex-shrink mx-3 text-[10px] text-gray-400 font-mono uppercase tracking-wider">{currentLang === 'sl' ? "ali" : "or"}</span>
            <div className="flex-grow border-t border-gray-150"></div>
          </div>

          <button
            id="google-signin-btn"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isAdminChecking}
            className="w-full py-2.5 bg-white hover:bg-gray-50 border border-gray-250 hover:border-gray-300 text-gray-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer transition disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path fillRule="evenodd" clipRule="evenodd" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path fillRule="evenodd" clipRule="evenodd" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22-.19-.62z" fill="#FBBC05" />
              <path fillRule="evenodd" clipRule="evenodd" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
            </svg>
            <span>{t.sign_in_google}</span>
          </button>
        </form>

        {/* Setup and Demo Auth info box (Only visible during local development) */}
        {import.meta.env.DEV && (
          <div id="demo-auth-box" className="border-t border-gray-50 pt-5 space-y-3">
            <div className="p-3 bg-emerald-50/50 rounded-xl text-[11px] text-emerald-850 space-y-1 border border-emerald-100/50">
              <p className="font-bold">🔐 Development Mode Mock Credentials</p>
              <p className="font-mono">Email: admin@kalvarija.si</p>
              <p className="font-mono">Password: church123</p>
            </div>

            <button
              id="btn-demo-bypass"
              onClick={() => setIsDemoBypass(true)}
              className="w-full py-2 border border-gray-200 hover:border-emerald-500 text-gray-600 hover:text-emerald-700 font-medium text-xs rounded-xl cursor-pointer transition bg-gray-50/50"
            >
              Bypass & Test Panel Directly (Local Dev Mode Only)
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div id="admin-workplace-container" className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-6">
      {/* SUCCESS FLASH ALERTS */}
      {successMessage && (
        <div id="flash-banner" className="fixed top-20 right-4 z-50 bg-emerald-600 text-white rounded-xl shadow-lg border border-emerald-500 p-4 shrink-0 flex items-center gap-2.5 max-w-sm">
          <CheckCircle className="w-5 h-5 text-emerald-100 shrink-0" />
          <span className="text-xs font-medium">{successMessage}</span>
        </div>
      )}

      {/* SIDEBAR TABS COMPONENT */}
      <div id="admin-side-navigation" className="lg:col-span-3 space-y-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="px-3 py-2 border-b border-gray-50">
            <p className="text-[10px] font-mono tracking-widest uppercase text-emerald-650 font-bold">{t.admin}</p>
            <h2 className="text-sm font-sans font-semibold text-gray-900 leading-snug">Editor Console</h2>
          </div>

          <button
            id="tab-dashboard"
            onClick={() => { handleTabChange('dashboard'); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition ${
              activeTab === 'dashboard' ? "bg-emerald-50 text-emerald-700" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-gray-400" />
            <span>Dashboard</span>
          </button>

          <button
            id="tab-teachings"
            onClick={() => { handleTabChange('teachings'); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition ${
              activeTab === 'teachings' ? "bg-emerald-50 text-emerald-700" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <FileText className="w-4 h-4 text-gray-400" />
            <span>{t.manage_teachings}</span>
          </button>

          <button
            id="tab-teachers"
            onClick={() => { handleTabChange('teachers'); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition ${
              activeTab === 'teachers' ? "bg-emerald-50 text-emerald-700" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Users className="w-4 h-4 text-gray-400" />
            <span>{t.manage_teachers}</span>
          </button>

          <button
            id="tab-imports"
            onClick={() => { handleTabChange('imports'); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition ${
              activeTab === 'imports' ? "bg-emerald-50 text-emerald-700" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <div className="relative">
              <RefreshCw className={`w-4 h-4 text-gray-400 ${syncing ? 'animate-spin' : ''}`} />
              {pendingImports.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500" />
              )}
            </div>
            <span>{t.review_imports}</span>
          </button>

          <button
            id="tab-settings"
            onClick={() => { handleTabChange('settings'); }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition ${
              activeTab === 'settings' ? "bg-emerald-50 text-emerald-700" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Settings className="w-4 h-4 text-gray-400" />
            <span>{t.settings}</span>
          </button>

          <button
            id="btn-logout"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-red-650 hover:bg-red-55/10 cursor-pointer transition pt-5 border-t border-gray-50"
          >
            <LogOut className="w-4 h-4" />
            <span>{t.log_out}</span>
          </button>
        </div>
      </div>

      {/* MAIN MODULE CONTENT VIEW (tab routing) */}
      <div id="admin-main-section" className="lg:col-span-9 space-y-6">

        {/* TAB 1: DASHBOARD METRICS */}
        {activeTab === 'dashboard' && !isEditingTeaching && !isEditingTeacher && (
          <div id="admin-dashboard-container" className="space-y-8">
            <h2 className="text-xl font-bold font-sans text-gray-950">{t.admin_title}</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div id="stat-total-teachings" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-1">
                <p className="text-xs text-gray-400 font-mono font-bold uppercase">{t.total_teachings}</p>
                <p className="text-3xl font-sans font-bold text-gray-950">{teachings.length}</p>
              </div>

              <div id="stat-unpublished" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-1">
                <p className="text-xs text-gray-400 font-mono font-bold uppercase">{t.unpublished_items}</p>
                <p className="text-3xl font-sans font-bold text-amber-600">{teachings.filter(t => !t.published).length}</p>
              </div>

              <div id="stat-total-teachers" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-1">
                <p className="text-xs text-gray-400 font-mono font-bold uppercase">{t.total_teachers}</p>
                <p className="text-3xl font-sans font-bold text-gray-900">{teachers.length}</p>
              </div>

              <div id="stat-reviews" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-1">
                <p className="text-xs text-gray-400 font-mono font-bold uppercase">Pending Sync Reviews</p>
                <p className="text-3xl font-sans font-bold text-emerald-600">{pendingImports.length}</p>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div id="dashboard-quick-actions" className="bg-emerald-50/20 border border-emerald-100/50 rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-emerald-800">{t.quick_actions}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  id="action-btn-new-teaching"
                  onClick={() => { handleTabChange('teachings'); handleAddNewTeachingTrigger(); }}
                  className="p-3 bg-white text-gray-800 border hover:border-emerald-500 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer hover:bg-emerald-55/10 transition-all text-center"
                >
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span>{t.add_new_teaching}</span>
                </button>

                <button
                  id="action-btn-new-teacher"
                  onClick={() => { handleTabChange('teachers'); handleAddNewTeacherTrigger(); }}
                  className="p-3 bg-white text-gray-800 border hover:border-emerald-500 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer hover:bg-emerald-55/10 transition-all text-center"
                >
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span>{t.add_new_teacher}</span>
                </button>

                <button
                  id="action-btn-sync"
                  onClick={handleTriggerSync}
                  className="p-3 bg-emerald-650 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all text-center"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  <span>Importer Sync Stream</span>
                </button>
              </div>
            </div>

            {/* Recent additions list */}
            <div id="dashboard-recents" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-sans font-semibold text-gray-950 border-b border-gray-50 pb-2.5">{t.recent_additions}</h3>
              
              <div className="space-y-3">
                {teachings.slice(0, 5).map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg text-xs leading-none">
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-900">{item.title_sl}</p>
                      <p className="text-gray-400 text-[10px]">{item.teaching_date} • {teachers.find(tr => tr.id === item.teacher_id)?.full_name}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider font-mono font-medium ${
                      item.published ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}>
                      {item.published ? t.status_published : t.status_draft}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TEACHINGS MANAGEMENT TAB */}
        {activeTab === 'teachings' && !isEditingTeaching && (
          <div id="admin-teachings-container" className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-950 font-sans">{t.manage_teachings}</h2>
              <button
                id="btn-add-teaching"
                onClick={handleAddNewTeachingTrigger}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 font-semibold text-xs text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>{t.add_new_teaching}</span>
              </button>
            </div>

            {/* List Table of Teachings */}
            <div id="teachings-table-container" className="overflow-x-auto bg-white rounded-2xl border border-gray-100 shadow-sm">
              <table className="w-full text-left text-xs text-gray-700">
                <thead className="bg-gray-50 text-gray-500 font-mono text-[10px] uppercase font-bold border-b border-gray-150">
                  <tr>
                    <th className="p-4">Title (Slovene)</th>
                    <th className="p-4">Teacher</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Ref/Series</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {teachings.map(item => {
                    const teacher = teachers.find(tr => tr.id === item.teacher_id);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50">
                        <td className="p-4 font-semibold text-gray-900 truncate max-w-xs">{item.title_sl}</td>
                        <td className="p-4">{teacher?.full_name || item.teacher_id}</td>
                        <td className="p-4 whitespace-nowrap font-mono">{item.teaching_date}</td>
                        <td className="p-4">
                          <span className="block font-medium">{item.bible_book_code} {item.chapter_start}</span>
                          <span className="block text-gray-400 text-[10px]">{item.series_name_sl || "-"}</span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                            item.published ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {item.published ? t.status_published : t.status_draft}
                          </span>
                        </td>
                        <td className="p-4 text-right flex justify-end gap-1.5 items-center">
                          <button
                            type="button"
                            onClick={() => {
                              setBroadcastTeaching(item);
                              setBroadcastStatus(null);
                            }}
                            className="p-1.5 border border-rose-200 hover:border-[#93032E] hover:bg-rose-50 text-[#93032E] rounded-lg cursor-pointer flex items-center gap-1 text-[11px] font-bold transition"
                            title="Pošlji e-poštno obvestilo o učenju članom cerkve"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Obvesti</span>
                          </button>
                          <button
                            id={`edit-teach-btn-${item.id}`}
                            onClick={() => handleEditTeachingTrigger(item)}
                            className="p-1.5 border border-gray-200 hover:border-emerald-600 hover:bg-emerald-50 text-gray-500 hover:text-emerald-700 rounded-lg cursor-pointer"
                            title={t.edit}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`delete-teach-btn-${item.id}`}
                            onClick={() => handleDeleteTeaching(item.id)}
                            className="p-1.5 border border-gray-200 hover:border-red-650 hover:bg-red-55/10 text-gray-500 hover:text-red-700 rounded-lg cursor-pointer"
                            title={t.delete}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TEACHING FORM EDITING EXPAND Panel */}
        {activeTab === 'teachings' && isEditingTeaching && editingTeaching && (
          <form onSubmit={handleSaveTeaching} id="teaching-editor-form" className="bg-white border border-gray-150 rounded-3xl p-6 shadow-md space-y-8">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-sans font-semibold text-gray-950">
                {editingTeaching.id ? (currentLang === 'sl' ? "Uredi nauk" : "Edit Teaching") : t.add_new_teaching}
              </h3>
              
              <div className="flex gap-2">
                <button
                  id="btn-form-cancel"
                  type="button"
                  onClick={handleLeaveFormWithDiscard}
                  className="px-4 py-2 bg-gray-50 text-gray-600 font-semibold text-xs rounded-xl hover:bg-gray-100 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  id="btn-form-save"
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-semibold text-xs rounded-xl hover:bg-emerald-700 cursor-pointer flex items-center gap-1"
                >
                  <Save className="w-4 h-4" />
                  <span>{t.save}</span>
                </button>
              </div>
            </div>

            {/* Autosave notice */}
            <div className="p-3 bg-emerald-50 text-emerald-800 text-xs border border-emerald-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-medium">
              <div className="flex items-center gap-1.5">
                <span>✍️ {t.form_draft_saved}</span>
                {teachingDraftSavedTime && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-950 px-1.5 py-0.5 rounded font-mono">
                    {TRANSLATIONS[currentLang].draft_saved_at.replace("{time}", teachingDraftSavedTime)}
                  </span>
                )}
              </div>
              <div className="flex gap-2 items-center">
                {teachingFormHasChanges && <span className="text-[10px] text-amber-700 font-mono italic">({currentLang === 'sl' ? "neshranjene spremembe" : "unsaved modifications"})</span>}
                <button
                  type="button"
                  id="btn-discard-teaching-draft"
                  onClick={() => {
                    if (window.confirm(currentLang === 'sl' ? "Ali res želite zavreči shranjeni osnutek?" : "Are you sure you want to discard this draft?")) {
                      localStorage.removeItem(`teaching_form_draft_${editingTeaching.id || 'new'}`);
                      setEditingTeaching(editingTeaching.id ? (teachings.find(tc => tc.id === editingTeaching.id) || null) : {
                        title_sl: "",
                        title_en: ""
                      });
                      setTeachingDraftSavedTime("");
                      setTeachingFormHasChanges(false);
                      triggerAlert(currentLang === 'sl' ? "Osnutek zavržen" : "Draft discarded");
                    }
                  }}
                  className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-750 text-[10px] font-bold rounded-lg transition border border-red-200 cursor-pointer"
                >
                  {t.discard_draft}
                </button>
              </div>
            </div>

            {/* FORM GRP 1: BASIC METADATA */}
            <div className="space-y-4">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wide text-gray-400 border-b border-gray-50 pb-1">{t.form_basic_info}</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-750">{t.form_title_sl}</label>
                  <input
                    id="teaching-title-sl"
                    type="text"
                    required
                    value={editingTeaching.title_sl || ""}
                    onChange={(e) => { setEditingTeaching({ ...editingTeaching, title_sl: e.target.value }); setTeachingFormHasChanges(true); }}
                    className="w-full text-xs p-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-750">{t.form_title_en}</label>
                  <input
                    id="teaching-title-en"
                    type="text"
                    value={editingTeaching.title_en || ""}
                    onChange={(e) => { setEditingTeaching({ ...editingTeaching, title_en: e.target.value }); setTeachingFormHasChanges(true); }}
                    className="w-full text-xs p-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1 relative" id="teacher-searchable-dropdown-container">
                  <label className="text-xs font-semibold text-gray-750">{t.form_teacher_choose}</label>
                  
                  {/* Select button triggering dropdown */}
                  <div 
                    id="teacher-dropdown-trigger"
                    onClick={() => setIsTeacherDropdownOpen(!isTeacherDropdownOpen)}
                    className="w-full text-xs p-2.5 bg-white border border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none flex justify-between items-center cursor-pointer min-h-[38px]"
                  >
                    <span>
                      {editingTeaching.teacher_id 
                        ? (teachers.find(tr => tr.id === editingTeaching.teacher_id)?.full_name || "") 
                        : (currentLang === 'sl' ? "-- Izberi Učitelja --" : "-- Choose Pastor --")}
                    </span>
                    <span className="text-gray-400">▼</span>
                  </div>

                  {isTeacherDropdownOpen && (
                    <div 
                      id="teacher-dropdown-floating"
                      className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-2.5 space-y-2 max-h-64 overflow-y-auto"
                    >
                      {/* Search box */}
                      <input
                        id="teacher-dropdown-search-input"
                        type="text"
                        placeholder={currentLang === 'sl' ? "Išči učitelja..." : "Search teacher..."}
                        value={teacherSearchQuery}
                        onChange={(e) => setTeacherSearchQuery(e.target.value)}
                        className="w-full text-xs p-2 bg-gray-50 border border-gray-150 rounded-lg focus:border-emerald-500 focus:outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                      
                      {/* Active Teachers List */}
                      <div className="space-y-1">
                        {teachers
                          .filter(tr => tr.active && tr.full_name.toLowerCase().includes(teacherSearchQuery.toLowerCase()))
                          .map(tr => (
                            <div
                              key={tr.id}
                              id={`teacher-option-${tr.id}`}
                              onClick={() => {
                                setEditingTeaching({ ...editingTeaching, teacher_id: tr.id });
                                setTeachingFormHasChanges(true);
                                setIsTeacherDropdownOpen(false);
                                setTeacherSearchQuery("");
                              }}
                              className="p-2 hover:bg-emerald-50 rounded-lg cursor-pointer text-xs flex flex-col transition text-left"
                            >
                              <span className="font-semibold text-gray-900">{tr.full_name}</span>
                              {tr.short_bio_sl && (
                                <span className="text-[10px] text-gray-400 line-clamp-1 italic">{tr.short_bio_sl}</span>
                              )}
                            </div>
                          ))}
                        
                        {teachers.filter(tr => tr.active && tr.full_name.toLowerCase().includes(teacherSearchQuery.toLowerCase())).length === 0 && (
                          <div className="text-center p-2 text-gray-400 text-xs font-mono">
                            {currentLang === 'sl' ? "Ni najdenih učiteljev" : "No teachers found"}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-750">{t.date} *</label>
                  <input
                    id="teaching-date-input"
                    type="date"
                    required
                    value={editingTeaching.teaching_date || ""}
                    onChange={(e) => { setEditingTeaching({ ...editingTeaching, teaching_date: e.target.value }); setTeachingFormHasChanges(true); }}
                    className="w-full text-xs p-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none focus:ring-0"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-750">{t.form_series_sl}</label>
                  <input
                    id="teaching-series-sl"
                    type="text"
                    value={editingTeaching.series_name_sl || ""}
                    onChange={(e) => { setEditingTeaching({ ...editingTeaching, series_name_sl: e.target.value }); setTeachingFormHasChanges(true); }}
                    className="w-full text-xs p-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-750">{t.form_series_en}</label>
                  <input
                    id="teaching-series-en"
                    type="text"
                    value={editingTeaching.series_name_en || ""}
                    onChange={(e) => { setEditingTeaching({ ...editingTeaching, series_name_en: e.target.value }); setTeachingFormHasChanges(true); }}
                    className="w-full text-xs p-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* FORM GRP 2: BIBLE REFERENCES */}
            <div className="space-y-4">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wide text-gray-400 border-b border-gray-50 pb-1">{t.form_bible_ref}</h4>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-gray-750">{t.form_book_choose}</label>
                  <select
                    id="teaching-book-select"
                    required
                    value={editingTeaching.bible_book_code || ""}
                    onChange={(e) => { setEditingTeaching({ ...editingTeaching, bible_book_code: e.target.value }); setTeachingFormHasChanges(true); }}
                    className="w-full text-xs p-2 bg-white border border-gray-200 rounded-lg focus:border-emerald-500"
                  >
                    {BIBLE_BOOKS.map(book => (
                      <option key={book.code} value={book.code}>
                        {currentLang === 'en' ? book.name_en : book.name_sl}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-750">{t.form_chapter_start}</label>
                  <input
                    id="teaching-chapter-start"
                    type="number"
                    min="1"
                    required
                    value={editingTeaching.chapter_start || ""}
                    onChange={(e) => { setEditingTeaching({ ...editingTeaching, chapter_start: parseInt(e.target.value, 10) }); setTeachingFormHasChanges(true); }}
                    className="w-full text-xs p-1.5 bg-gray-50/50 border border-gray-200 rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-750">{t.form_verse_start}</label>
                  <input
                    id="teaching-verse-start"
                    type="number"
                    min="1"
                    value={editingTeaching.verse_start || ""}
                    onChange={(e) => { setEditingTeaching({ ...editingTeaching, verse_start: parseInt(e.target.value, 10) }); setTeachingFormHasChanges(true); }}
                    className="w-full text-xs p-1.5 bg-gray-50/50 border border-gray-200 rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-750">{t.form_verse_end}</label>
                  <input
                    id="teaching-verse-end"
                    type="number"
                    min="1"
                    value={editingTeaching.verse_end || ""}
                    onChange={(e) => { setEditingTeaching({ ...editingTeaching, verse_end: parseInt(e.target.value, 10) }); setTeachingFormHasChanges(true); }}
                    className="w-full text-xs p-1.5 bg-gray-50/50 border border-gray-200 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* FORM GRP 3: MEDIA CONNECTIONS */}
            <div className="space-y-4">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wide text-gray-400 border-b border-gray-50 pb-1">{t.form_media_links}</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-750">{t.form_media_type}</label>
                  <select
                    id="teaching-mediatype-select"
                    required
                    value={editingTeaching.media_type || "audio"}
                    onChange={(e) => { setEditingTeaching({ ...editingTeaching, media_type: e.target.value as any }); setTeachingFormHasChanges(true); }}
                    className="w-full text-xs p-2.5 bg-white border border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="audio">🎙️ {t.audio}</option>
                    <option value="video">📺 {t.video}</option>
                    <option value="audio_video">🎙️ + 📺 {t.audio_video}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-750">{t.form_duration}</label>
                  <input
                    id="teaching-duration"
                    type="text"
                    placeholder="e.g. 42:15"
                    value={editingTeaching.duration_text || ""}
                    onChange={(e) => { setEditingTeaching({ ...editingTeaching, duration_text: e.target.value }); setTeachingFormHasChanges(true); }}
                    className="w-full text-xs p-2.5 bg-gray-50/50 border border-gray-200 rounded-xl"
                  />
                </div>

                {(editingTeaching.media_type === 'video' || editingTeaching.media_type === 'audio_video') && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-755 text-red-750">{t.form_youtube_url} *</label>
                    <input
                      id="teaching-youtube-url"
                      type="text"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={editingTeaching.youtube_url || ""}
                      onChange={(e) => { setEditingTeaching({ ...editingTeaching, youtube_url: e.target.value }); setTeachingFormHasChanges(true); }}
                      className="w-full text-xs p-2.5 bg-gray-50/50 border border-gray-200 rounded-xl"
                    />
                  </div>
                )}

                {(editingTeaching.media_type === 'audio' || editingTeaching.media_type === 'audio_video') && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-755 text-red-750">{t.form_audio_url} *</label>
                    <input
                      id="teaching-audio-url"
                      type="text"
                      placeholder="https://example.com/audio/sermon.mp3"
                      value={editingTeaching.audio_url || ""}
                      onChange={(e) => { setEditingTeaching({ ...editingTeaching, audio_url: e.target.value }); setTeachingFormHasChanges(true); }}
                      className="w-full text-xs p-2.5 bg-gray-50/50 border border-gray-200 rounded-xl"
                    />
                  </div>
                )}

                <div className="space-y-1 col-span-1 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-750">{t.form_thumbnail_url}</label>
                    <label className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      <span>{currentLang === 'sl' ? "Naloži naslovnico (.webp <400KB)" : "Upload Cover (.webp <400KB)"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const optimized = await optimizeImageToDataUrl(file, { maxSizeMB: 0.4, maxWidthOrHeight: 1920, mimeType: 'image/webp' });
                            const cleanPath = createCleanStoragePath('sermons', file.name, 'webp');
                            setEditingTeaching({ ...editingTeaching, thumbnail_url: optimized, thumbnail_path: cleanPath });
                            setTeachingFormHasChanges(true);
                          } catch (err) {
                            console.error('Image compression error:', err);
                          }
                        }}
                      />
                    </label>
                  </div>
                  <input
                    id="teaching-thumbnail"
                    type="text"
                    placeholder="https://images.unsplash.com/... ali /sermons/naslovnica.webp"
                    value={editingTeaching.thumbnail_path || editingTeaching.thumbnail_url || ""}
                    onChange={(e) => { setEditingTeaching({ ...editingTeaching, thumbnail_url: e.target.value, thumbnail_path: e.target.value }); setTeachingFormHasChanges(true); }}
                    className="w-full text-xs p-2.5 bg-gray-50/50 border border-gray-200 rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* FORM GRP 4: BILINGUAL CONTENT STREAMS */}
            <div className="space-y-6">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wide text-gray-400 border-b border-gray-50 pb-1">{t.form_bilingual_content}</h4>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-750">{t.form_summary_sl}</label>
                    <textarea
                      id="teaching-summary-sl"
                      rows={3}
                      value={editingTeaching.summary_sl || ""}
                      onChange={(e) => { setEditingTeaching({ ...editingTeaching, summary_sl: e.target.value }); setTeachingFormHasChanges(true); }}
                      className="w-full text-xs p-2.5 bg-gray-50/50 border border-gray-200 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-750">{t.form_summary_en}</label>
                    <textarea
                      id="teaching-summary-en"
                      rows={3}
                      value={editingTeaching.summary_en || ""}
                      onChange={(e) => { setEditingTeaching({ ...editingTeaching, summary_en: e.target.value }); setTeachingFormHasChanges(true); }}
                      className="w-full text-xs p-2.5 bg-gray-50/50 border border-gray-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-750">{t.form_notes_sl}</label>
                    <textarea
                      id="teaching-notes-sl"
                      rows={6}
                      value={editingTeaching.notes_sl || ""}
                      onChange={(e) => { setEditingTeaching({ ...editingTeaching, notes_sl: e.target.value }); setTeachingFormHasChanges(true); }}
                      className="w-full text-xs p-2.5 bg-gray-50/50 border border-gray-200 rounded-xl font-sans"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-755">{t.form_notes_en}</label>
                    <textarea
                      id="teaching-notes-en"
                      rows={6}
                      value={editingTeaching.notes_en || ""}
                      onChange={(e) => { setEditingTeaching({ ...editingTeaching, notes_en: e.target.value }); setTeachingFormHasChanges(true); }}
                      className="w-full text-xs p-2.5 bg-gray-50/50 border border-gray-200 rounded-xl font-sans"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-750">{t.form_transcript_sl}</label>
                    <textarea
                      id="teaching-transcript-sl"
                      rows={4}
                      value={editingTeaching.transcript_sl || ""}
                      onChange={(e) => { setEditingTeaching({ ...editingTeaching, transcript_sl: e.target.value }); setTeachingFormHasChanges(true); }}
                      className="w-full text-xs p-2.5 bg-gray-50/50 border border-gray-200 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-750">{t.form_transcript_en}</label>
                    <textarea
                      id="teaching-transcript-en"
                      rows={4}
                      value={editingTeaching.transcript_en || ""}
                      onChange={(e) => { setEditingTeaching({ ...editingTeaching, transcript_en: e.target.value }); setTeachingFormHasChanges(true); }}
                      className="w-full text-xs p-2.5 bg-gray-50/50 border border-gray-200 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* FORM GRP 5: PUBLISH STATE SETTINGS */}
            <div className="space-y-4 pt-4 border-t border-gray-50">
              <div className="flex flex-col sm:flex-row gap-6">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                  <input
                    id="teaching-is-featured"
                    type="checkbox"
                    checked={editingTeaching.featured || false}
                    onChange={(e) => { setEditingTeaching({ ...editingTeaching, featured: e.target.checked }); setTeachingFormHasChanges(true); }}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{t.form_is_featured}</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                  <input
                    id="teaching-is-published"
                    type="checkbox"
                    checked={editingTeaching.published || false}
                    onChange={(e) => { setEditingTeaching({ ...editingTeaching, published: e.target.checked }); setTeachingFormHasChanges(true); }}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{t.form_is_published}</span>
                </label>
              </div>
            </div>

            {/* Bottom Form Action Buttons */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-50">
              <button
                id="btn-form-bottom-cancel"
                type="button"
                onClick={handleLeaveFormWithDiscard}
                className="px-5 py-2.5 bg-gray-50 text-gray-600 font-semibold text-sm rounded-xl hover:bg-gray-100 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                id="btn-form-bottom-save"
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 font-semibold text-sm text-white rounded-xl hover:bg-emerald-700 shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{t.save}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: TEACHERS TAB */}
        {activeTab === 'teachers' && !isEditingTeacher && (
          <div id="admin-teachers-container" className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-950 font-sans">{t.manage_teachers}</h2>
              <button
                id="btn-add-teacher"
                onClick={handleAddNewTeacherTrigger}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 font-semibold text-xs text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>{t.add_new_teacher}</span>
              </button>
            </div>

            {/* Table layout of teachers */}
            <div id="teachers-table-container" className="overflow-x-auto bg-white rounded-2xl border border-gray-100 shadow-sm">
              <table className="w-full text-left text-xs text-gray-700">
                <thead className="bg-gray-50 text-gray-500 font-mono text-[10px] uppercase font-bold border-b border-gray-150">
                  <tr>
                    <th className="p-4">Photo</th>
                    <th className="p-4">Full Name</th>
                    <th className="p-4">Slug</th>
                    <th className="p-4">Bio snippet (SL)</th>
                    <th className="p-4">Active</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {teachers.map(teacher => (
                    <tr key={teacher.id} className="hover:bg-gray-50/50">
                      <td className="p-4">
                        <img 
                          src={teacher.photo_url || ""} 
                          alt={teacher.full_name} 
                          className="w-10 h-10 rounded-full object-cover border" 
                          referrerPolicy="no-referrer"
                        />
                      </td>
                      <td className="p-4 font-semibold text-gray-900">{teacher.full_name}</td>
                      <td className="p-4 font-mono text-[10px]">{teacher.slug}</td>
                      <td className="p-4 truncate max-w-xs">{teacher.short_bio_sl}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                          teacher.active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-750'
                        }`}>
                          {teacher.active ? t.active_status : t.inactive_status}
                        </span>
                      </td>
                      <td className="p-4 text-right flex justify-end gap-1.5 items-center">
                        <button
                          id={`btn-edit-tr-${teacher.id}`}
                          onClick={() => handleEditTeacherTrigger(teacher)}
                          className="p-1.5 border border-gray-200 hover:border-emerald-600 hover:bg-emerald-50 text-gray-500 hover:text-emerald-700 rounded-lg cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`btn-toggle-tr-status-${teacher.id}`}
                          onClick={() => handleDeactivateTeacher(teacher.id, teacher.active)}
                          className={`p-1.5 border rounded-lg cursor-pointer ${
                            teacher.active 
                              ? "border-red-150 hover:bg-red-50 text-red-650" 
                              : "border-emerald-150 hover:bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {teacher.active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TEACHERS FORM EDITING EXPAND Panel */}
        {activeTab === 'teachers' && isEditingTeacher && editingTeacher && (
          <form onSubmit={handleSaveTeacher} id="teacher-form" className="bg-white border border-gray-150 rounded-3xl p-6 shadow-md space-y-6">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-sans font-semibold text-gray-950">
                {editingTeacher.id ? (currentLang === 'sl' ? "Uredi učitelja" : "Edit Teacher Profile") : t.add_new_teacher}
              </h3>
              
              <div className="flex gap-2">
                <button
                  id="btn-tr-cancel"
                  type="button"
                  onClick={handleLeaveTeacherWithDiscard}
                  className="px-4 py-2 bg-gray-50 text-gray-600 font-semibold text-xs rounded-xl hover:bg-gray-100 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  id="btn-tr-save"
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-semibold text-xs rounded-xl hover:bg-emerald-700 cursor-pointer"
                >
                  {t.save}
                </button>
              </div>
            </div>

            {/* Teacher Autosave notice */}
            <div className="p-3 bg-emerald-50 text-emerald-800 text-xs border border-emerald-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-medium">
              <div className="flex items-center gap-1.5">
                <span>✍️ {t.form_draft_saved}</span>
                {teacherDraftSavedTime && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-950 px-1.5 py-0.5 rounded font-mono">
                    {TRANSLATIONS[currentLang].draft_saved_at.replace("{time}", teacherDraftSavedTime)}
                  </span>
                )}
              </div>
              <div className="flex gap-2 items-center">
                {teacherFormHasChanges && <span className="text-[10px] text-amber-700 font-mono italic">({currentLang === 'sl' ? "neshranjene spremembe" : "unsaved modifications"})</span>}
                <button
                  type="button"
                  id="btn-discard-teacher-draft"
                  onClick={() => {
                    if (window.confirm(currentLang === 'sl' ? "Ali res želite zavreči shranjeni osnutek?" : "Are you sure you want to discard this draft?")) {
                      localStorage.removeItem(`teacher_form_draft_${editingTeacher.id || 'new'}`);
                      setEditingTeacher(editingTeacher.id ? (teachers.find(tr => tr.id === editingTeacher.id) || null) : {
                        full_name: "",
                        slug: ""
                      });
                      setTeacherDraftSavedTime("");
                      setTeacherFormHasChanges(false);
                      triggerAlert(currentLang === 'sl' ? "Osnutek zavržen" : "Draft discarded");
                    }
                  }}
                  className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-750 text-[10px] font-bold rounded-lg transition border border-red-200 cursor-pointer"
                >
                  {t.discard_draft}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-755">{t.form_full_name}</label>
                  <input
                    id="teacher-fullname"
                    type="text"
                    required
                    value={editingTeacher.full_name || ""}
                    onChange={(e) => { setEditingTeacher({ ...editingTeacher, full_name: e.target.value }); setTeacherFormHasChanges(true); }}
                    className="w-full text-xs p-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-750">{t.form_photo_url}</label>
                    <label className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      <span>{currentLang === 'sl' ? "Naloži sliko (.webp <400KB)" : "Upload Photo (.webp <400KB)"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const optimized = await optimizeImageToDataUrl(file, { maxSizeMB: 0.4, maxWidthOrHeight: 1920, mimeType: 'image/webp' });
                            const cleanPath = createCleanStoragePath('teachers', file.name, 'webp');
                            setEditingTeacher({ ...editingTeacher, photo_url: optimized, photo_path: cleanPath });
                            setTeacherFormHasChanges(true);
                          } catch (err) {
                            console.error('Image compression error:', err);
                          }
                        }}
                      />
                    </label>
                  </div>
                  <input
                    id="teacher-photourl"
                    type="text"
                    placeholder="https://images.unsplash.com/... ali /teachers/ime.webp"
                    value={editingTeacher.photo_path || editingTeacher.photo_url || ""}
                    onChange={(e) => { setEditingTeacher({ ...editingTeacher, photo_url: e.target.value, photo_path: e.target.value }); setTeacherFormHasChanges(true); }}
                    className="w-full text-xs p-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-gray-750">{t.form_bio_sl}</label>
                  <textarea
                    id="teacher-biosl"
                    rows={4}
                    value={editingTeacher.short_bio_sl || ""}
                    onChange={(e) => { setEditingTeacher({ ...editingTeacher, short_bio_sl: e.target.value }); setTeacherFormHasChanges(true); }}
                    className="w-full text-xs p-2.5 bg-gray-50/50 border border-gray-200 rounded-xl"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-gray-750">{t.form_bio_en}</label>
                  <textarea
                    id="teacher-bioen"
                    rows={4}
                    value={editingTeacher.short_bio_en || ""}
                    onChange={(e) => { setEditingTeacher({ ...editingTeacher, short_bio_en: e.target.value }); setTeacherFormHasChanges(true); }}
                    className="w-full text-xs p-2.5 bg-gray-50/50 border border-gray-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                  <input
                    id="teacher-active-checkbox"
                    type="checkbox"
                    checked={editingTeacher.active !== false}
                    onChange={(e) => { setEditingTeacher({ ...editingTeacher, active: e.target.checked }); setTeacherFormHasChanges(true); }}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Active & visible in Teachers index list</span>
                </label>
              </div>
            </div>
          </form>
        )}

        {/* TAB 4: IMPORT REVIEW STREAMS WORKBOOK */}
        {activeTab === 'imports' && (
          <div id="admin-imports-workbook" className="space-y-6">
            <div className="border-b border-gray-150 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-bold font-sans text-gray-950">{t.import_title}</h2>
                <p className="text-xs text-gray-500 leading-normal">{t.import_desc}</p>
              </div>
              <button
                id="btn-seed-imports"
                type="button"
                onClick={handleSeedSampleImports}
                className="px-4 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-250 text-amber-900 font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shrink-0"
              >
                <Sparkles className="w-4 h-4 text-amber-700 animate-pulse" />
                <span>{currentLang === 'sl' ? "Naloži testne uvoze (SAMO MOCK / TEST)" : "Seed Sample Imports (MOCK / TEST ONLY)"}</span>
              </button>
            </div>

            {/* Sync connection bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 bg-emerald-50/30 border border-emerald-100 rounded-2xl">
              <div className="space-y-1 text-center sm:text-left">
                <p className="text-xs font-semibold text-emerald-850">Connected Source Streams</p>
                <p className="text-[10px] text-gray-400 font-mono select-all">Drive Folder: {settings.google_drive_folder_id} • Playlist: {settings.youtube_playlist_id}</p>
              </div>
              
              <button
                id="btn-sync-media"
                onClick={handleTriggerSync}
                disabled={syncing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                <span>Trigger API Sync Process</span>
              </button>
            </div>

            {/* ADVANCED MULTI-TIER FILTERS PANEL */}
            <div className="bg-gray-50/60 border border-gray-150 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
              
              {/* Filter 1: Source */}
              <div className="flex gap-2 w-full md:w-auto">
                <button
                  id="filter-source-all"
                  onClick={() => setImportFilterSource('all')}
                  className={`flex-1 md:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition ${
                    importFilterSource === 'all' ? "bg-white border border-gray-200 text-gray-900 shadow-xs" : "text-gray-550 hover:text-gray-900"
                  }`}
                >
                  {currentLang === 'sl' ? "Vsi viri" : "All Sources"}
                </button>
                <button
                  id="filter-source-drive"
                  onClick={() => setImportFilterSource('google_drive')}
                  className={`flex-1 md:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-1 justify-center ${
                    importFilterSource === 'google_drive' ? "bg-white border border-gray-200 text-gray-900 shadow-xs" : "text-gray-550 hover:text-gray-900"
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5 text-gray-400" />
                  <span>Google Drive ({importItems.filter(i => i.source === 'google_drive').length})</span>
                </button>
                <button
                  id="filter-source-youtube"
                  onClick={() => setImportFilterSource('youtube')}
                  className={`flex-1 md:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-1 justify-center ${
                    importFilterSource === 'youtube' ? "bg-white border border-gray-200 text-gray-900 shadow-xs" : "text-gray-550 hover:text-gray-900"
                  }`}
                >
                  <Video className="w-3.5 h-3.5 text-gray-400" />
                  <span>YouTube ({importItems.filter(i => i.source === 'youtube').length})</span>
                </button>
              </div>

              {/* Filter 2: Status selector */}
              <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                <span className="text-[11px] font-bold text-gray-550 whitespace-nowrap uppercase tracking-wider">{currentLang === 'sl' ? "Status pregleda" : "Review Status"}:</span>
                <select
                  id="import-filters-status-select"
                  value={importFilterStatus}
                  onChange={(e) => setImportFilterStatus(e.target.value as any)}
                  className="w-full md:w-48 text-xs p-2 bg-white border border-gray-250 rounded-xl focus:ring-0 focus:outline-none focus:border-emerald-500 cursor-pointer text-gray-800 font-semibold"
                >
                  <option value="unreviewed">{currentLang === 'sl' ? "Nepregledano (Čaka)" : "Pending Review"}</option>
                  <option value="linked">{currentLang === 'sl' ? "Povezano z obstoječim" : "Linked to Existing"}</option>
                  <option value="new_teaching_created">{currentLang === 'sl' ? "Nov nauk ustvarjen" : "New Teaching Created"}</option>
                  <option value="ignored">{currentLang === 'sl' ? "Prezrto / Arhivirano" : "Ignored / Archived"}</option>
                  <option value="all">{currentLang === 'sl' ? "Vsi statusi" : "All Statuses"}</option>
                </select>
              </div>
            </div>

            {/* QUEUE ITEMS VIEW */}
            <div className="space-y-4">
              {importItems.filter(item => {
                const matchSource = importFilterSource === 'all' || item.source === importFilterSource;
                const matchStatus = importFilterStatus === 'all' || item.status === importFilterStatus;
                return matchSource && matchStatus;
              }).length === 0 ? (
                <div className="p-16 text-center border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50 flex flex-col items-center justify-center space-y-3">
                  <Sparkles className="w-10 h-10 text-gray-300 animate-pulse" />
                  <p className="text-gray-550 font-sans text-xs font-semibold">
                    {currentLang === 'sl' ? "Ni najdenih uvoznih elementov za izbrane filtre." : "No imported queue items found matching these filters."}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {currentLang === 'sl' ? "Kliknite 'Naloži testne uvoze' za hitro simulacijo uvoznega procesa." : "Click 'Seed Sample Imports' at top right to populate queue with test cases."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4" id="imports-review-list">
                  {importItems
                    .filter(item => {
                      const matchSource = importFilterSource === 'all' || item.source === importFilterSource;
                      const matchStatus = importFilterStatus === 'all' || item.status === importFilterStatus;
                      return matchSource && matchStatus;
                    })
                    .map(item => {
                      const book = BIBLE_BOOKS.find(b => b.code === item.bible_book_code);
                      const displayRef = book ? `${currentLang === 'en' ? book.name_en : book.name_sl} ${item.chapter_start}${item.verse_start ? `:${item.verse_start}` : ""}${item.verse_end ? `-${item.verse_end}` : ""}` : "";
                      const keyTeacher = teachers.find(tr => tr.id === item.teacher_id)?.full_name || "Pastor";
                      const needsHighReview = item.confidence_score && item.confidence_score < 70;

                      return (
                        <div key={item.id} className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-xs hover:shadow-sm hover:border-emerald-250 transition duration-200">
                          
                          {/* Banner rating header */}
                          <div className={`p-3.5 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
                            needsHighReview ? "bg-amber-55/10 text-amber-900 border-amber-100" : "bg-emerald-55/5 text-emerald-950"
                          }`}>
                            <div className="flex items-center gap-2">
                              {needsHighReview ? (
                                <AlertCircle className="w-4 h-4 text-amber-700 animate-bounce" />
                              ) : (
                                <Sparkles className="w-4 h-4 text-emerald-600" />
                              )}
                              
                              <span className="font-bold">
                                {needsHighReview 
                                  ? (currentLang === 'sl' ? "⚠️ ZAHTEVA POZOREN PREGLED (Nizko ujemanje)" : "⚠️ REQUIRES CAREFUL REVIEW (Low matching rate)")
                                  : (currentLang === 'sl' ? `Dober uvoz (${item.confidence_score}% zanesljivost)` : `Good Import (${item.confidence_score}% confidence rate)`)}
                              </span>
                            </div>

                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-mono font-bold ${
                              item.confidence_score && item.confidence_score >= 90 
                                ? 'bg-emerald-100 text-emerald-950/90' 
                                : item.confidence_score && item.confidence_score >= 70 
                                  ? 'bg-amber-100 text-amber-950/90' 
                                  : 'bg-red-100 text-red-950/90'
                            }`}>
                              Score: {item.confidence_score}%
                            </span>
                          </div>

                          {/* Body details info */}
                          <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-4 text-xs items-center">
                            
                            {/* Med Icon */}
                            <div className="md:col-span-1 flex items-center justify-center">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                item.source === 'youtube' ? 'bg-red-50 text-red-650' : 'bg-emerald-50 text-emerald-700'
                              }`}>
                                {item.source === 'youtube' ? <Video className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                              </div>
                            </div>

                            {/* Core details titles */}
                            <div className="md:col-span-7 space-y-1">
                              <p className="font-semibold text-gray-900 text-sm leading-snug select-all">{currentLang === 'sl' ? item.title_sl : (item.title_en || item.title_sl)}</p>
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-550 font-mono">
                                <span>Ref:</span>
                                <span className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-mono font-bold">{displayRef || "N/A"}</span>
                                <span className="text-gray-300">•</span>
                                <span>Teacher:</span>
                                <span className="font-bold select-all">{keyTeacher}</span>
                                <span className="text-gray-300">•</span>
                                <span>Type:</span>
                                <span className="capitalize font-bold">{item.media_type}</span>
                              </div>
                              
                              {/* Raw file path log helper */}
                              <p className="text-[10px] text-gray-400 font-mono pt-1 select-all truncate max-w-lg">
                                Source Link: {item.audio_url || item.youtube_url}
                              </p>
                            </div>

                            {/* Info Status pills */}
                            <div className="md:col-span-2 text-left md:text-right">
                              <span className={`inline-block px-2 py-1 rounded-lg text-[10px] font-mono font-bold ${
                                item.status === 'unreviewed' ? 'bg-blue-50 text-blue-700 border border-blue-150' :
                                item.status === 'linked' ? 'bg-emerald-50 text-emerald-800 border border-emerald-150' :
                                item.status === 'new_teaching_created' ? 'bg-purple-50 text-purple-800 border border-purple-150' :
                                'bg-gray-100 text-gray-500'
                              }`}>
                                {item.status.toUpperCase()}
                              </span>
                            </div>

                            {/* Actions Group segment */}
                            <div className="md:col-span-2 flex md:flex-col gap-1.5 justify-end">
                              {item.status === 'unreviewed' && (
                                <>
                                  <button
                                    id={`btn-imports-link-${item.id}`}
                                    type="button"
                                    onClick={() => handleTriggerImportLinkDialog(item)}
                                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 font-bold text-[10px] text-center rounded-lg border border-emerald-200 transition cursor-pointer flex items-center gap-1 justify-center"
                                  >
                                    <Link2 className="w-3 h-3" />
                                    <span>{currentLang === 'sl' ? "Poveži z naukom" : "Link to Existing"}</span>
                                  </button>
                                  <button
                                    id={`btn-imports-create-new-${item.id}`}
                                    type="button"
                                    onClick={() => handleCreateNewTeachingFromImport(item)}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] text-center rounded-lg shadow-xs transition cursor-pointer flex items-center gap-1 justify-center"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>{currentLang === 'sl' ? "Nov nauk" : "Create New"}</span>
                                  </button>
                                  <button
                                    id={`btn-imports-ignore-${item.id}`}
                                    type="button"
                                    onClick={() => handleIgnoreImportItem(item.id)}
                                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-750 font-bold text-[10px] text-center rounded-lg border border-red-200 transition cursor-pointer"
                                  >
                                    {currentLang === 'sl' ? "Prezri" : "Ignore"}
                                  </button>
                                </>
                              )}
                              {item.status !== 'unreviewed' && (
                                <span className="text-[10px] text-gray-400 italic text-center uppercase font-bold tracking-wide">
                                  {currentLang === 'sl' ? "Končano" : "Confirmed"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* CONFIRM INLINE MANUAL LINK MODAL */}
            {linkingItem && (
              <div id="manual-linking-modal" className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <div className="bg-white border border-gray-150 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
                  
                  <div className="flex justify-between items-center border-b pb-2.5">
                    <h3 className="font-sans font-bold text-base text-gray-950">
                      {currentLang === 'sl' ? "Poveži z obstoječim naukom" : "Link Stream to Existing Sermon"}
                    </h3>
                    <button id="close-manual-link" onClick={() => { setLinkingItem(null); setLinkTargetTeachingId(""); }} className="p-1.5 hover:bg-gray-100 rounded-lg cursor-pointer">
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs bg-gray-50/70 p-3 rounded-xl border border-gray-150">
                    <p className="font-mono text-[9px] font-bold text-gray-500 uppercase tracking-widest leading-none">STREAM OBJECT DECLARED:</p>
                    <p className="font-bold text-gray-950 leading-snug select-all">
                      {currentLang === 'sl' ? linkingItem.title_sl : (linkingItem.title_en || linkingItem.title_sl)}
                    </p>
                    <p className="text-[10px] font-mono text-gray-400 select-all truncate">
                      Media Source: {linkingItem.audio_url || linkingItem.youtube_url}
                    </p>
                  </div>

                  <div className="space-y-3 text-xs">
                    <label className="block font-bold text-gray-750">
                      {currentLang === 'sl' ? "Izberite obstoječi zapis nauka" : "Select Target Sermon from Archive"} *
                    </label>
                    
                    {/* Search filter within teachings list */}
                    <input
                      id="link-search-teachings-input"
                      type="text"
                      placeholder={currentLang === 'sl' ? "Išči nauk po naslovu..." : "Search teachings by title..."}
                      value={linkSearchQuery}
                      onChange={(e) => setLinkSearchQuery(e.target.value)}
                      className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-emerald-500 focus:outline-none mb-2"
                    />

                    <select
                      id="manual-link-select-teaching"
                      value={linkTargetTeachingId}
                      onChange={(e) => setLinkTargetTeachingId(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white border border-gray-250 rounded-xl focus:outline-none focus:border-emerald-500 cursor-pointer font-semibold text-gray-800"
                    >
                      <option value="">-- {t.select_existing_teaching} --</option>
                      {teachings
                        .filter(t => t.title_sl.toLowerCase().includes(linkSearchQuery.toLowerCase()) || (t.title_en && t.title_en.toLowerCase().includes(linkSearchQuery.toLowerCase())))
                        .map(tc => (
                          <option key={tc.id} value={tc.id}>{tc.title_sl} ({tc.teaching_date})</option>
                        ))}
                    </select>
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t border-gray-100">
                    <button
                      id="manual-link-cancel"
                      onClick={() => { setLinkingItem(null); setLinkTargetTeachingId(""); }}
                      className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold text-xs rounded-xl cursor-pointer"
                    >
                      {t.cancel}
                    </button>
                    <button
                      id="manual-link-confirm"
                      disabled={!linkTargetTeachingId}
                      onClick={handleConfirmLinkImport}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl disabled:opacity-40 cursor-pointer shadow-xs"
                    >
                      {t.btn_attach_media}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: ARCHIVE SETTINGS CONFIGURATION */}
        {activeTab === 'settings' && (
          <div id="admin-settings-container" className="space-y-4">
            <div className="border-b border-gray-100 pb-2.5">
              <h2 className="text-xl font-bold font-sans text-gray-950">{t.settings}</h2>
              <p className="text-xs text-gray-500">Configure default cloud ingress IDs and playlist tracking sync intervals.</p>
            </div>

            <form onSubmit={handleSaveSettings} id="settings-form" className="bg-white border border-gray-150 rounded-2xl p-6 shadow-sm space-y-6 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-gray-700">Google Drive Folder ID *</label>
                  <p className="text-[10px] text-gray-400">Specifies the folder containing the MP3 sermons to parse and import.</p>
                  <input
                    id="settings-drive-folder"
                    type="text"
                    required
                    value={settings.google_drive_folder_id}
                    onChange={(e) => setSettings({ ...settings, google_drive_folder_id: e.target.value })}
                    className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-gray-700">YouTube Source Playlist ID *</label>
                  <p className="text-[10px] text-gray-400">The playlist containing the service videos to grab.</p>
                  <input
                    id="settings-yt-playlist"
                    type="text"
                    required
                    value={settings.youtube_playlist_id}
                    onChange={(e) => setSettings({ ...settings, youtube_playlist_id: e.target.value })}
                    className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-gray-700">Sync Interval (days)</label>
                  <input
                    id="settings-sync-interval"
                    type="number"
                    min="1"
                    value={settings.sync_interval_days}
                    onChange={(e) => setSettings({ ...settings, sync_interval_days: parseInt(e.target.value, 10) })}
                    className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
                  />
                </div>

                <div className="space-y-1 flex items-end pb-3">
                  <label className="flex items-center gap-2 font-semibold text-gray-700 cursor-pointer">
                    <input
                      id="settings-matching-toggle"
                      type="checkbox"
                      checked={settings.auto_suggest_matching}
                      onChange={(e) => setSettings({ ...settings, auto_suggest_matching: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Suggest fuzzy title match combinations during imports</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-50 flex justify-end">
                <button
                  id="settings-submit-btn"
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Broadcast Email Modal */}
      {broadcastTeaching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-gray-900 font-bold text-base">
                <Mail className="w-5 h-5 text-[#93032E]" />
                <span>Obvesti člane o novem učenju</span>
              </div>
              <button
                type="button"
                onClick={() => setBroadcastTeaching(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-100 space-y-1 text-xs">
              <div className="font-bold text-gray-900 text-sm">{broadcastTeaching.title_sl || broadcastTeaching.title_en}</div>
              <div className="text-gray-600">
                Govornik: <strong>{teachers.find(tc => tc.id === broadcastTeaching.teacher_id)?.full_name || 'KC Kalvarija'}</strong>
                {broadcastTeaching.teaching_date && <span> • Datum: <strong>{broadcastTeaching.teaching_date}</strong></span>}
              </div>
            </div>

            <form onSubmit={handleSendTeachingBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Ciljna skupina prejemnikov
                </label>
                <select
                  value={broadcastRecipientMode}
                  onChange={(e) => setBroadcastRecipientMode(e.target.value as any)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#93032E] focus:outline-none bg-white font-medium"
                >
                  <option value="all">👥 Vsi registrirani člani in obiskovalci cerkve</option>
                  <option value="custom">✉️ Posamezen e-poštni naslov (Test)</option>
                </select>
              </div>

              {broadcastRecipientMode === 'custom' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Vnesite e-poštni naslov *
                  </label>
                  <input
                    type="text"
                    required
                    value={broadcastCustomEmail}
                    onChange={(e) => setBroadcastCustomEmail(e.target.value)}
                    placeholder="npr. pastor@kalvarija.si, test@gmail.com"
                    className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#93032E] focus:outline-none"
                  />
                </div>
              )}

              {broadcastStatus && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    broadcastStatus.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {broadcastStatus.success ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{broadcastStatus.message}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBroadcastTeaching(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Zapri
                </button>
                <button
                  type="submit"
                  disabled={isSendingBroadcast}
                  className="px-5 py-2.5 rounded-xl bg-[#93032E] hover:bg-[#7a0225] disabled:opacity-50 text-white text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer transition active:scale-95"
                >
                  {isSendingBroadcast ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Pošiljanje...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Pošlji obvestilo preko Resend</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
