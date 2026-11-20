// SPDX-License-Identifier: AGPL-3.0-or-later
import React, { useEffect, useMemo, useRef, useState } from "react";
import { PROTOCOL_VERSION, RACE_DURATION_MS } from "../shared/constants";
import type {
  ClientMessage,
  PublicRoomSnapshot,
  ResultRow,
  ServerMessage
} from "../shared/protocol";
import {
  calculateWpm,
  computePrefixChars,
  generateWordSequence,
  normalizeText,
  normalizeWord,
  splitWords,
  wordCountForTimeMode
} from "../shared/text";
import trWords from "../../data/languages/tr/words-1k.json";
import enWords from "../../data/languages/en/words-1k.json";
import trQuotes from "../../data/languages/tr/quotes.json";
import enQuotes from "../../data/languages/en/quotes.json";
import { randomSeed } from "../shared/rng";
import { variantMode2 } from "../shared/variant";
import { calculateConsistency, type SecondSample } from "../shared/stats";
import {
  createRemoteRacer,
  onRemoteProgress,
  type RemoteRacerState,
  stepRemoteRacer
} from "./race/interp";
import { type BotConnection, connectPracticeBot } from "./race/bot";
import {
  ALL_THEMES,
  AuthProfileModal,
  GearIcon,
  GlobeIcon,
  LeaderboardIcon,
  LeaderboardModal,
  LegalModal,
  type LegalTab,
  MoreDotsIcon,
  PublicUserProfileModal,
  type ServerUserData,
  SettingsModal,
  ThemeSoundPickerModal,
  type UserSettings
} from "./components/Modals";
import { ResultChart } from "./components/ResultChart";
import { type CaretStyle, TypingArea } from "./components/TypingArea";
import { getInitialUiLang, UI_STRINGS, type UiLang } from "./i18n";
import {
  getPersonalBest,
  type PersonalBestEntry,
  recordResultForPb
} from "./typing/pb";
import { soundEngine, type SoundProfile } from "./typing/sound";

type ThemeName = string;
const QUICK_THEMES: string[] = ["kor", "gece", "karbon"];

type TestMode = "time" | "words" | "quote";
const TIME_OPTIONS = [15, 30, 60, 120] as const;
const WORD_OPTIONS = [10, 25, 50, 100] as const;

function getRoomIdFromPath(): string | null {
  const m = window.location.pathname.match(/^\/r\/([A-Za-z0-9]{4,10})/);
  return m ? m[1].toUpperCase() : null;
}

function getUsernameFromPath(): string | null {
  const m = window.location.pathname.match(/^\/u\/([A-Za-z0-9_]{3,20})/);
  return m ? m[1].toLowerCase() : null;
}

export function App() {
  const [uiLang, setUiLang] = useState<UiLang>(getInitialUiLang);
  const t = UI_STRINGS[uiLang];

  const [theme, setTheme] = useState<ThemeName>(() => {
    const raw = localStorage.getItem("theme");
    if (raw === "monkeytype") return "karbon";
    const saved = raw as ThemeName | null;
    return saved && ALL_THEMES.some((th) => th.id === saved) ? saved : "kor";
  });
  const [caretStyle, setCaretStyle] = useState<CaretStyle>(
    () => (localStorage.getItem("caretStyle") as CaretStyle) || "line"
  );
  const [soundProfile, setSoundProfile] = useState<SoundProfile>(() =>
    soundEngine.getProfile()
  );
  const [roomId, setRoomId] = useState<string | null>(getRoomIdFromPath);
  const [lang, setLang] = useState<"tr" | "en">("tr");
  const [playerName, setPlayerName] = useState<string>(
    () => localStorage.getItem("playerName") || "oyuncu"
  );

  // Solo test mode configuration (defaults to time 60s)
  const [mode, setMode] = useState<TestMode>("time");
  const [timeLimitSec, setTimeLimitSec] = useState<number>(60);
  const [wordLimit, setWordLimit] = useState<number>(25);
  const [punctuation, setPunctuation] = useState<boolean>(false);
  const [numbers, setNumbers] = useState<boolean>(false);
  const [isFocusTyping, setIsFocusTyping] = useState<boolean>(false);

  // Modals & User / Settings state
  const [viewedUsername, setViewedUsername] = useState<string | null>(
    getUsernameFromPath
  );
  const [openedFromLeaderboard, setOpenedFromLeaderboard] =
    useState<boolean>(false);
  const [activeModal, setActiveModal] = useState<
    "leaderboard" | "settings" | "auth" | "legal" | "userProfile" | "picker" | null
  >(() => (getUsernameFromPath() ? "userProfile" : null));
  const [pickerTab, setPickerTab] = useState<"themes" | "sounds">("themes");
  const [legalTab, setLegalTab] = useState<LegalTab>("privacy");
  const [userData, setUserData] = useState<ServerUserData>({
    user: null,
    profile: null,
    pbs: [],
    recentResults: []
  });
  const [settings, setSettings] = useState<UserSettings>(() => {
    const defaults: UserSettings = {
      difficulty: "normal",
      blindMode: false,
      quickRestartTab: false,
      showLiveWpm: false,
      fontSize: "md",
      volume: soundEngine.getVolume()
    };
    try {
      const saved =
        localStorage.getItem("erotype_settings_v1") ||
        localStorage.getItem("erotype_settings_v1");
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<UserSettings>;
        return {
          ...defaults,
          ...parsed,
          showLiveWpm: parsed.showLiveWpm ?? false
        };
      }
    } catch {
      // ignore
    }
    return defaults;
  });

  const refreshUser = async () => {
    try {
      const res = await fetch("/api/me");
      if (res.ok) {
        const d = (await res.json()) as ServerUserData;
        setUserData(d);
        if (d.profile?.username) {
          setPlayerName(d.profile.username);
          localStorage.setItem("playerName", d.profile.username);
        }
      }
    } catch {
      // ignore offline
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const handleSettingsChange = (next: UserSettings) => {
    setSettings(next);
    try {
      localStorage.setItem("erotype_settings_v1", JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeModal) {
        setActiveModal(null);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [activeModal]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("caretStyle", caretStyle);
  }, [caretStyle]);

  useEffect(() => {
    const onPop = () => setRoomId(getRoomIdFromPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigateToRoom = (id: string | null) => {
    const target = id ? `/r/${id}` : "/";
    window.history.pushState({}, "", target);
    setRoomId(id);
  };

  const createRoom = async () => {
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang, maxPlayers: 5 })
    });
    if (res.ok) {
      const data = (await res.json()) as { roomId: string };
      navigateToRoom(data.roomId);
    }
  };

  const handleSoundChange = (p: SoundProfile) => {
    soundEngine.setProfile(p);
    setSoundProfile(p);
  };

  const toggleUiLang = () => {
    const next: UiLang = uiLang === "tr" ? "en" : "tr";
    setUiLang(next);
    try {
      localStorage.setItem("erotype_ui_lang", next);
    } catch {
      // ignore
    }
  };

  const openLegal = (tab: LegalTab) => {
    setLegalTab(tab);
    setActiveModal("legal");
  };

  const carets: { id: CaretStyle; label: string }[] = [
    { id: "line", label: t.caretLine },
    { id: "block", label: t.caretBlock },
    { id: "underline", label: t.caretUnderline }
  ];

  const quickSounds: { id: SoundProfile; label: string }[] = [
    { id: "creams", label: "creams" },
    { id: "typewriter", label: t.soundTypewriter },
    { id: "click", label: "click" }
  ];

  const isExtendedSoundActive =
    soundProfile !== "off" && !quickSounds.some((s) => s.id === soundProfile);
  const isExtendedThemeActive = !QUICK_THEMES.includes(theme);

  return (
    <div
      className={`app-shell ${isFocusTyping ? "is-focus-typing" : ""}`}
      onMouseMove={() => {
        if (isFocusTyping) setIsFocusTyping(false);
      }}
    >
      <header className="topbar">
        <div className="topbar-main-row">
          <div className="brand" onClick={() => navigateToRoom(null)}>
            <span>ero</span>
            <span className="brand-accent">type</span>
          </div>

          <div className="topbar-right-actions">
            {!userData.user && (
              <input
                className="user-input"
                value={playerName}
                onChange={(e) => {
                  setPlayerName(e.target.value);
                  localStorage.setItem("playerName", e.target.value);
                }}
                placeholder={t.guestPlaceholder}
              />
            )}
            {!roomId ? (
              <button className="action-btn primary" onClick={createRoom}>
                {t.createRoom}
              </button>
            ) : (
              <button className="action-btn" onClick={() => navigateToRoom(null)}>
                {t.soloMode}
              </button>
            )}
            <button
              type="button"
              className="action-btn icon-btn"
              onClick={toggleUiLang}
              title={t.uiLangTooltip}
              aria-label={t.uiLangTooltip}
            >
              <GlobeIcon size={14} />
              <span>{uiLang.toUpperCase()}</span>
            </button>
            <button
              className="action-btn icon-btn"
              onClick={() => setActiveModal("auth")}
            >
              {userData.user && (
                userData.user.image ? (
                  <img
                    src={userData.user.image}
                    alt={userData.profile?.username || userData.user.name}
                    className="avatar-xs"
                  />
                ) : (
                  <span className="avatar-xs avatar-fallback">
                    {(userData.user.name || userData.profile?.username || "K")
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>
                )
              )}
              <span>
                {userData.profile?.username
                  ? `@${userData.profile.username}`
                  : t.loginBtn}
              </span>
            </button>
          </div>
        </div>

        {/* Sound, Caret, and Theme bar under erotype + Leaderboard button at its bottom-right */}
        <div className="topbar-custom-group">
          <div className="config-bar">
            <span className="config-label">{t.soundLabel}</span>
            {quickSounds.map((s) => (
              <button
                key={s.id}
                className={`text-btn ${soundProfile === s.id ? "active" : ""}`}
                onClick={() => handleSoundChange(s.id)}
              >
                {s.label}
              </button>
            ))}

            {/* 3 dots icon right before 'off' */}
            <button
              className={`text-btn more-dots-btn ${isExtendedSoundActive ? "active" : ""}`}
              onClick={() => {
                setPickerTab("sounds");
                setActiveModal("picker");
              }}
              title={soundProfile}
              aria-label={t.pickerSoundsTab}
            >
              <MoreDotsIcon size={14} />
            </button>

            {/* Off */}
            <button
              className={`text-btn ${soundProfile === "off" ? "active" : ""}`}
              onClick={() => handleSoundChange("off")}
            >
              {t.soundOff}
            </button>

            <span className="config-sep" />
            <span className="config-label">{t.caretLabel}</span>
            {carets.map((c) => (
              <button
                key={c.id}
                className={`text-btn ${caretStyle === c.id ? "active" : ""}`}
                onClick={() => setCaretStyle(c.id)}
              >
                {c.label}
              </button>
            ))}

            <span className="config-sep" />
            <span className="config-label">{t.themeLabel}</span>
            {QUICK_THEMES.map((th) => (
              <button
                key={th}
                className={`text-btn ${theme === th ? "active" : ""}`}
                onClick={() => setTheme(th)}
              >
                {th}
              </button>
            ))}

            {/* 3 dots icon at the very end of themes */}
            <button
              className={`text-btn more-dots-btn ${isExtendedThemeActive ? "active" : ""}`}
              onClick={() => {
                setPickerTab("themes");
                setActiveModal("picker");
              }}
              title={theme}
              aria-label={t.pickerThemesTab}
            >
              <MoreDotsIcon size={14} />
            </button>
          </div>

          <div className="topbar-custom-sub">
            <button
              className="action-btn icon-btn"
              onClick={() => setActiveModal("leaderboard")}
            >
              <LeaderboardIcon size={14} />
              <span>{t.leaderboardBtn}</span>
            </button>
          </div>
        </div>
      </header>

      {activeModal === "leaderboard" && (
        <LeaderboardModal
          uiLang={uiLang}
          onSelectUser={(u) => {
            setViewedUsername(u);
            setOpenedFromLeaderboard(true);
            setActiveModal("userProfile");
          }}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "userProfile" && viewedUsername && (
        <PublicUserProfileModal
          uiLang={uiLang}
          username={viewedUsername}
          onBackToLeaderboard={
            openedFromLeaderboard
              ? () => {
                  setOpenedFromLeaderboard(false);
                  setActiveModal("leaderboard");
                }
              : undefined
          }
          onClose={() => {
            setOpenedFromLeaderboard(false);
            setActiveModal(null);
            if (window.location.pathname.startsWith("/u/")) {
              window.history.pushState({}, "", "/");
            }
          }}
        />
      )}
      {activeModal === "settings" && (
        <SettingsModal
          uiLang={uiLang}
          settings={settings}
          onChange={handleSettingsChange}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "auth" && (
        <AuthProfileModal
          uiLang={uiLang}
          userData={userData}
          onRefreshUser={refreshUser}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "legal" && (
        <LegalModal
          uiLang={uiLang}
          initialTab={legalTab}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "picker" && (
        <ThemeSoundPickerModal
          initialTab={pickerTab}
          currentTheme={theme}
          onSelectTheme={(t) => {
            setTheme(t);
            localStorage.setItem("theme", t);
            document.documentElement.setAttribute("data-theme", t);
          }}
          currentSound={soundProfile}
          onSelectSound={(s) => handleSoundChange(s)}
          onClose={() => setActiveModal(null)}
          uiLang={uiLang}
        />
      )}

      {roomId ? (
        <MultiplayerRoomView
          uiLang={uiLang}
          roomId={roomId}
          playerName={playerName}
          caretStyle={caretStyle}
          settings={settings}
          onOpenSettings={() => setActiveModal("settings")}
          onExit={() => navigateToRoom(null)}
        />
      ) : (
        <SoloPracticeView
          uiLang={uiLang}
          lang={lang}
          setLang={setLang}
          mode={mode}
          setMode={setMode}
          timeLimitSec={timeLimitSec}
          setTimeLimitSec={setTimeLimitSec}
          wordLimit={wordLimit}
          setWordLimit={setWordLimit}
          punctuation={punctuation}
          setPunctuation={setPunctuation}
          numbers={numbers}
          setNumbers={setNumbers}
          setIsFocusTyping={setIsFocusTyping}
          caretStyle={caretStyle}
          settings={settings}
          isLoggedIn={Boolean(userData.user)}
          onResultSaved={refreshUser}
          onOpenSettings={() => setActiveModal("settings")}
        />
      )}

      <footer className="footer">
        <span>{t.footerRestartHint}</span>
        <div className="footer-links">
          <a className="footer-link-btn" href="/gizlilik">
            {t.footerPrivacy}
          </a>
          <span>·</span>
          <button
            type="button"
            className="footer-link-btn"
            onClick={() => openLegal("security")}
          >
            {t.footerSecurity}
          </button>
          <span>·</span>
          <button
            type="button"
            className="footer-link-btn"
            onClick={() => openLegal("license")}
          >
            {t.footerLicense}
          </button>
          <span>·</span>
          <a
            className="footer-link-btn"
            href="https://github.com/yagizerhan/erotype"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1) Solo Practice View (centered mode bar, result chart, PB, Tab+Enter)
// ---------------------------------------------------------------------------
function SoloPracticeView({
  uiLang,
  lang,
  setLang,
  mode,
  setMode,
  timeLimitSec,
  setTimeLimitSec,
  wordLimit,
  setWordLimit,
  punctuation,
  setPunctuation,
  numbers,
  setNumbers,
  setIsFocusTyping,
  caretStyle,
  settings,
  isLoggedIn,
  onResultSaved,
  onOpenSettings
}: {
  uiLang: UiLang;
  lang: "tr" | "en";
  setLang: (l: "tr" | "en") => void;
  mode: TestMode;
  setMode: (m: TestMode) => void;
  timeLimitSec: number;
  setTimeLimitSec: (s: number) => void;
  wordLimit: number;
  setWordLimit: (w: number) => void;
  punctuation: boolean;
  setPunctuation: (p: boolean | ((prev: boolean) => boolean)) => void;
  numbers: boolean;
  setNumbers: (n: boolean | ((prev: boolean) => boolean)) => void;
  setIsFocusTyping: (f: boolean) => void;
  caretStyle: CaretStyle;
  settings: UserSettings;
  isLoggedIn: boolean;
  onResultSaved: () => void;
  onOpenSettings: () => void;
}) {
  const t = UI_STRINGS[uiLang];
  const [seed, setSeed] = useState<number>(() => randomSeed());
  const [wordIndex, setWordIndex] = useState(0);
  const [typedWords, setTypedWords] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedMs, setFinishedMs] = useState<number | null>(null);
  const [failedReason, setFailedReason] = useState<string | null>(null);
  const [keystrokes, setKeystrokes] = useState(0);
  const [errors, setErrors] = useState(0);
  const [nowMs, setNowMs] = useState<number>(() => performance.now());
  const [samples, setSamples] = useState<SecondSample[]>([]);
  const [pbState, setPbState] = useState<{
    isNewBest: boolean;
    best: PersonalBestEntry | null;
  }>({ isNewBest: false, best: null });
  const [serverSavedMsg, setServerSavedMsg] = useState<string | null>(null);

  const restartBtnRef = useRef<HTMLButtonElement>(null);
  const ticketRef = useRef<unknown>(null);
  // Sequence ticket requests so stale responses never overwrite a newer test
  const ticketReqIdRef = useRef(0);
  const startedRef = useRef(false);

  // Refs for per-second chart sampling without resetting intervals
  const statsRef = useRef({
    typedChars: 0,
    keystrokes: 0,
    errors: 0,
    lastSampledErrors: 0,
    lastSampleSec: 0
  });

  const activeQuote = useMemo(() => {
    if (mode !== "quote") return null;
    const pool = lang === "en" ? enQuotes : trQuotes;
    return pool[(seed - 1) % pool.length] ?? pool[0];
  }, [lang, mode, seed]);

  const totalGeneratedWords =
    mode === "time" ? wordCountForTimeMode(timeLimitSec) : wordLimit;

  const words = useMemo(() => {
    if (mode === "quote" && activeQuote) {
      return splitWords(activeQuote.text);
    }
    const pool = lang === "en" ? enWords : trWords;
    return generateWordSequence(pool, totalGeneratedWords, seed, lang, {
      punctuation,
      numbers
    });
  }, [lang, mode, activeQuote, totalGeneratedWords, seed, punctuation, numbers]);

  const prefixChars = useMemo(() => computePrefixChars(words), [words]);

  const mode2Key = variantMode2(
    mode,
    mode === "time"
      ? String(timeLimitSec)
      : mode === "words"
      ? String(wordLimit)
      : activeQuote?.id ?? "quote",
    punctuation,
    numbers
  );

  // Server picks the seed. Until the ticket arrives we show words from a local
  // random seed; if the ticket arrives before the user starts typing, we switch to
  // its seed. If typing already began before the ticket arrived, the result isn't saved.
  const requestTicket = () => {
    ticketRef.current = null;
    const reqId = ++ticketReqIdRef.current;
    if (!isLoggedIn) return; // guest results are never saved to the server
    fetch("/api/tests/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        mode2: mode === "time" ? String(timeLimitSec) : String(wordLimit),
        lang,
        punctuation,
        numbers
      })
    })
      .then((r) =>
        r.ok ? (r.json() as Promise<{ ticket?: { seed?: number } }>) : null
      )
      .then((d) => {
        if (reqId !== ticketReqIdRef.current || startedRef.current) return;
        if (d?.ticket && typeof d.ticket.seed === "number") {
          ticketRef.current = d.ticket;
          setSeed(d.ticket.seed);
        }
      })
      .catch(() => {});
  };

  const submitResultToServer = (
    typed: string[],
    partial: string,
    durationMs: number,
    finalKeys: number,
    finalErrs: number,
    cons: number
  ) => {
    if (!isLoggedIn || !ticketRef.current) return;
    fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticket: ticketRef.current,
        typed,
        partial,
        durationMs,
        keystrokes: finalKeys,
        errors: finalErrs,
        consistency: cons
      })
    })
      .then((r) => r.json() as Promise<{ ok?: boolean; isNewBest?: boolean }>)
      .then((d) => {
        if (d.ok) {
          setServerSavedMsg(d.isNewBest ? t.savedNewBest : t.savedResult);
          onResultSaved();
        }
      })
      .catch(() => {});
  };

  const restart = () => {
    setSeed(randomSeed());
    startedRef.current = false;
    setWordIndex(0);
    setTypedWords([]);
    setInput("");
    setStartedAt(null);
    setFinishedMs(null);
    setFailedReason(null);
    setServerSavedMsg(null);
    setKeystrokes(0);
    setErrors(0);
    setSamples([]);
    setNowMs(performance.now());
    setIsFocusTyping(false);
    statsRef.current = {
      typedChars: 0,
      keystrokes: 0,
      errors: 0,
      lastSampledErrors: 0,
      lastSampleSec: 0
    };
    setPbState({
      isNewBest: false,
      best: getPersonalBest(lang, mode, mode2Key)
    });
    requestTicket();
  };

  useEffect(() => {
    restart();
  }, [lang, mode, timeLimitSec, wordLimit, punctuation, numbers, isLoggedIn]);

  const completedCorrectChars = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < wordIndex; i++) {
      const expected = words[i] ?? "";
      const actual = typedWords[i] ?? "";
      if (actual === expected) {
        sum += expected.length + (i < words.length - 1 ? 1 : 0);
      } else {
        for (let c = 0; c < Math.min(expected.length, actual.length); c++) {
          if (actual[c] === expected[c]) sum += 1;
        }
      }
    }
    return sum;
  }, [wordIndex, words, typedWords]);

  const currentWord = words[wordIndex] ?? "";
  const correctCharsInCurrent = Array.from(normalizeWord(input)).filter(
    (ch, i) => ch === currentWord[i]
  ).length;
  const typedCharsTotal = completedCorrectChars + correctCharsInCurrent;

  // Keep statsRef synced for the 100ms timer
  statsRef.current.typedChars = typedCharsTotal;
  statsRef.current.keystrokes = keystrokes;
  statsRef.current.errors = errors;

  useEffect(() => {
    if (!startedAt || finishedMs !== null) return;
    const id = setInterval(() => {
      const current = performance.now();
      setNowMs(current);
      const elapsed = current - startedAt;
      const wholeSec = Math.floor(elapsed / 1000);

      if (wholeSec >= 1 && wholeSec > statsRef.current.lastSampleSec) {
        statsRef.current.lastSampleSec = wholeSec;
        const secErrors =
          statsRef.current.errors - statsRef.current.lastSampledErrors;
        statsRef.current.lastSampledErrors = statsRef.current.errors;

        const wpmAtSec = calculateWpm(statsRef.current.typedChars, elapsed);
        const rawAtSec = calculateWpm(statsRef.current.keystrokes, elapsed);

        setSamples((prev) => [
          ...prev,
          {
            sec: wholeSec,
            wpm: wpmAtSec,
            raw: rawAtSec,
            errors: secErrors
          }
        ]);
      }

      if (mode === "time" && elapsed >= timeLimitSec * 1000) {
        setFinishedMs(timeLimitSec * 1000);
        setIsFocusTyping(false);
      }
    }, 100);
    return () => clearInterval(id);
  }, [startedAt, finishedMs, mode, timeLimitSec]);

  const completeTest = (
    durationMs: number,
    finalChars: number,
    finalKeys: number,
    finalErrs: number,
    finalTyped: string[]
  ) => {
    const clampedMs = Math.max(100, Math.round(durationMs));
    setFinishedMs(clampedMs);
    setIsFocusTyping(false);

    const finalWpm = calculateWpm(finalChars, clampedMs);
    const finalRaw = calculateWpm(finalKeys, clampedMs);
    const finalAcc =
      finalKeys > 0
        ? Math.max(0, Math.round(((finalKeys - finalErrs) / finalKeys) * 100))
        : 100;

    const finalSec = Math.max(1, Math.ceil(clampedMs / 1000));
    // Keep side effects (PB save, server submission) OUTSIDE the state updater:
    // React updaters must stay pure since StrictMode invokes them twice.
    const prev = samples;
    const next =
      prev.length > 0 && prev[prev.length - 1].sec === finalSec
        ? prev
        : [
            ...prev,
            {
              sec: finalSec,
              wpm: finalWpm,
              raw: finalRaw,
              errors: Math.max(0, finalErrs - statsRef.current.lastSampledErrors)
            }
          ];
    setSamples(next);
    const cons = calculateConsistency(next.map((s) => s.wpm));
    const pbOutcome = recordResultForPb(lang, mode, mode2Key, {
      wpm: finalWpm,
      raw: finalRaw,
      acc: finalAcc,
      consistency: cons
    });
    setPbState(pbOutcome);
    submitResultToServer(finalTyped, "", clampedMs, finalKeys, finalErrs, cons);
  };

  // Also record PB when time mode finishes via interval
  useEffect(() => {
    if (finishedMs !== null && mode === "time" && !failedReason) {
      const finalWpm = calculateWpm(typedCharsTotal, finishedMs);
      const finalRaw = calculateWpm(keystrokes, finishedMs);
      const finalAcc =
        keystrokes > 0
          ? Math.max(0, Math.round(((keystrokes - errors) / keystrokes) * 100))
          : 100;
      const cons = calculateConsistency(samples.map((s) => s.wpm));
      const pbOutcome = recordResultForPb(lang, mode, mode2Key, {
        wpm: finalWpm,
        raw: finalRaw,
        acc: finalAcc,
        consistency: cons
      });
      setPbState(pbOutcome);
      submitResultToServer(
        typedWords.slice(0, wordIndex),
        input,
        finishedMs,
        keystrokes,
        errors,
        cons
      );
    }
  }, [finishedMs]);

  // Pressing Tab anywhere on the page (even if typing area lost focus) ONLY focuses the restart button
  useEffect(() => {
    const onGlobalTabKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        if (document.querySelector(".modal-backdrop")) return;
        e.preventDefault();
        if (settings.quickRestartTab && finishedMs === null) {
          restart();
        } else {
          restartBtnRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", onGlobalTabKeyDown);
    return () => window.removeEventListener("keydown", onGlobalTabKeyDown);
  }, [finishedMs, settings.quickRestartTab, seed, lang, mode, timeLimitSec, wordLimit, punctuation, numbers]);

  const handleInputChange = (val: string, isKeyError: boolean) => {
    if (finishedMs !== null) return;
    const now = performance.now();
    const activeStart = startedAt ?? now;
    if (startedAt === null) {
      startedRef.current = true;
      setStartedAt(now);
      setNowMs(now);
    }
    setIsFocusTyping(true);

    const nextKeys = keystrokes + 1;
    const nextErrs = isKeyError ? errors + 1 : errors;
    setKeystrokes(nextKeys);
    if (isKeyError) {
      setErrors(nextErrs);
      if (settings.difficulty === "master") {
        setFailedReason(t.failMasterChar);
        setFinishedMs(Math.max(100, Math.round(now - activeStart)));
        setIsFocusTyping(false);
        return;
      }
    }

    const isSpace = val.endsWith(" ");
    const candidate = normalizeWord(isSpace ? val.slice(0, -1) : val);

    if (isSpace) {
      // Do not skip an empty word on leading/double space
      if (candidate.length === 0) return;

      const isWordCorrect = candidate === currentWord;
      if (!isWordCorrect && settings.difficulty === "master") {
        setFailedReason(t.failMasterWord);
        setFinishedMs(Math.max(100, Math.round(now - activeStart)));
        setIsFocusTyping(false);
        return;
      }

      // Count missed/untyped characters as errors when skipping an incomplete word
      const missedPenalty = isWordCorrect
        ? 0
        : Math.max(1, currentWord.length - candidate.length);
      const totalErrsAfterWord = nextErrs + missedPenalty;
      if (missedPenalty > 0) {
        setErrors(totalErrsAfterWord);
      }

      const nextTypedWords = [...typedWords, candidate];
      const nextIdx = wordIndex + 1;
      setTypedWords(nextTypedWords);
      setWordIndex(nextIdx);
      setInput("");

      if ((mode === "words" || mode === "quote") && nextIdx >= words.length) {
        const addedCorrect = isWordCorrect
          ? currentWord.length
          : Array.from(candidate).filter((ch, i) => ch === currentWord[i]).length;
        completeTest(
          now - activeStart,
          completedCorrectChars + addedCorrect,
          nextKeys,
          totalErrsAfterWord,
          nextTypedWords
        );
      }
      return;
    }

    if (
      !isSpace &&
      (mode === "words" || mode === "quote") &&
      wordIndex === words.length - 1 &&
      candidate === currentWord
    ) {
      const nextTypedWords = [...typedWords, candidate];
      const nextIdx = wordIndex + 1;
      setTypedWords(nextTypedWords);
      setWordIndex(nextIdx);
      setInput("");
      completeTest(
        now - activeStart,
        completedCorrectChars + currentWord.length,
        nextKeys,
        nextErrs,
        nextTypedWords
      );
      return;
    }

    setInput(val);
  };

  const handleBackToPreviousWord = (clearWord: boolean) => {
    if (finishedMs !== null || wordIndex <= 0) return;
    // Only normal mode allows going back to previous words with Backspace
    if (settings.difficulty !== "normal") return;

    const prevIdx = wordIndex - 1;
    const prevTyped = typedWords[prevIdx] ?? "";
    const prevTarget = words[prevIdx] ?? "";

    // If the previous word was skipped with an error, refund the missed-char penalty
    // so the user isn't double-penalized while fixing it
    if (prevTyped !== prevTarget) {
      const missedPenalty = Math.max(1, prevTarget.length - prevTyped.length);
      setErrors((e) => Math.max(0, e - missedPenalty));
    }

    setTypedWords((prev) => prev.slice(0, prevIdx));
    setWordIndex(prevIdx);
    setInput(clearWord ? "" : prevTyped);
  };

  const elapsedMs =
    finishedMs ?? (startedAt ? Math.max(100, nowMs - startedAt) : 0);
  const liveWpm = calculateWpm(typedCharsTotal, elapsedMs);
  const rawWpm = calculateWpm(keystrokes, elapsedMs);
  const acc =
    keystrokes > 0
      ? Math.max(0, Math.round(((keystrokes - errors) / keystrokes) * 100))
      : 100;
  const consistency = useMemo(
    () => calculateConsistency(samples.map((s) => s.wpm)),
    [samples]
  );

  const remainingSec =
    mode === "time"
      ? Math.max(0, Math.ceil((timeLimitSec * 1000 - elapsedMs) / 1000))
      : 0;

  return (
    <main className="center-stage">
      {/* Mode / Time selector placed in the middle right above the typing stage */}
      <div className="mode-selector-center">
        <div className="config-bar">
          {(["tr", "en"] as const).map((l) => (
            <button
              key={l}
              className={`text-btn ${lang === l ? "active" : ""}`}
              onClick={() => setLang(l)}
            >
              {l}
            </button>
          ))}

          {mode !== "quote" && (
            <>
              <span className="config-sep" />
              <button
                className={`text-btn ${punctuation ? "active" : ""}`}
                onClick={() => setPunctuation((p) => !p)}
              >
                {t.punctuation}
              </button>
              <button
                className={`text-btn ${numbers ? "active" : ""}`}
                onClick={() => setNumbers((n) => !n)}
              >
                {t.numbers}
              </button>
            </>
          )}

          <span className="config-sep" />

          <button
            className={`text-btn ${mode === "time" ? "active" : ""}`}
            onClick={() => setMode("time")}
          >
            {t.modeTime}
          </button>
          <button
            className={`text-btn ${mode === "words" ? "active" : ""}`}
            onClick={() => setMode("words")}
          >
            {t.modeWords}
          </button>
          <button
            className={`text-btn ${mode === "quote" ? "active" : ""}`}
            onClick={() => setMode("quote")}
          >
            {t.modeQuote}
          </button>

          {mode !== "quote" && <span className="config-sep" />}

          {mode === "time" &&
            TIME_OPTIONS.map((sec) => (
              <button
                key={sec}
                className={`text-btn ${timeLimitSec === sec ? "active" : ""}`}
                onClick={() => setTimeLimitSec(sec)}
              >
                {sec}
              </button>
            ))}

          {mode === "words" &&
            WORD_OPTIONS.map((cnt) => (
              <button
                key={cnt}
                className={`text-btn ${wordLimit === cnt ? "active" : ""}`}
                onClick={() => setWordLimit(cnt)}
              >
                {cnt}
              </button>
            ))}

          <span className="config-sep" />
          <button
            type="button"
            className="text-btn icon-only-btn"
            onClick={onOpenSettings}
            title={t.settingsTooltip}
            aria-label={t.settingsTooltip}
          >
            <GearIcon size={14} />
          </button>
        </div>
      </div>

      {finishedMs === null ? (
        <>
          <div className="live-counter-row">
            <div className="big-counter">
              {mode === "time" ? remainingSec : `${wordIndex}/${words.length}`}
            </div>
            {startedAt !== null ? (
              settings.showLiveWpm ? (
                <div className="sub-counter">
                  {liveWpm} wpm · %{acc}
                </div>
              ) : null
            ) : (
              pbState.best && (
                <div className="sub-counter">
                  {t.pbPrefix} {pbState.best.wpm} wpm (%{pbState.best.acc})
                </div>
              )
            )}
          </div>

          <TypingArea
            words={words}
            wordIndex={wordIndex}
            currentInput={input}
            typedWords={typedWords}
            blindMode={settings.blindMode}
            fontSize={settings.fontSize}
            quickRestartTab={settings.quickRestartTab}
            caretStyle={caretStyle}
            onInputChange={handleInputChange}
            onBackToPreviousWord={
              settings.difficulty === "normal"
                ? handleBackToPreviousWord
                : undefined
            }
            onTabToRestart={() => restartBtnRef.current?.focus()}
            onQuickRestart={restart}
          />

          {mode === "quote" && activeQuote && (
            <div className="quote-source-line">
              — {activeQuote.source} ({activeQuote.id})
            </div>
          )}

          <div className="restart-row">
            <button
              ref={restartBtnRef}
              type="button"
              className="restart-btn"
              onClick={restart}
              onKeyDown={(e) => {
                if (e.key === " ") e.preventDefault();
              }}
              title={t.restartShortcutHint}
            >
              {t.restartBtn}
            </button>
          </div>
        </>
      ) : (
        <div className="results-container">
          {failedReason && (
            <div style={{ color: "var(--error)", fontSize: "0.9rem" }}>
              {t.testFailedPrefix} ({failedReason})
            </div>
          )}
          {serverSavedMsg && (
            <div style={{ color: "var(--main)", fontSize: "0.82rem" }}>
              ✓ {serverSavedMsg}
            </div>
          )}
          <div className="results-top-layout">
            <div className="results-primary-stats">
              <div className="stat-block">
                <span className="stat-label">
                  wpm{" "}
                  {pbState.isNewBest && (
                    <span className="pb-badge">{t.newBestBadge}</span>
                  )}
                </span>
                <span className="stat-val">{liveWpm}</span>
              </div>
              <div className="stat-block">
                <span className="stat-label">{t.accuracy}</span>
                <span className="stat-val">%{acc}</span>
              </div>
            </div>

            <ResultChart samples={samples} uiLang={uiLang} />
          </div>

          <div className="results-secondary-grid">
            <div className="stat-block">
              <span className="stat-label">{t.modeStat}</span>
              <span className="stat-val-sm">
                {mode === "time"
                  ? `${t.modeTime} ${timeLimitSec}s`
                  : mode === "words"
                  ? `${wordLimit} ${t.modeWords}`
                  : t.modeQuote}{" "}
                ({lang})
              </span>
            </div>
            <div className="stat-block">
              <span className="stat-label">{t.rawWpm}</span>
              <span className="stat-val-sm">{rawWpm}</span>
            </div>
            <div className="stat-block">
              <span className="stat-label">{t.consistency}</span>
              <span className="stat-val-sm">%{consistency}</span>
            </div>
            <div className="stat-block">
              <span className="stat-label">{t.characters}</span>
              <span className="stat-val-sm" title={t.charactersTooltip}>
                {keystrokes - errors}/{errors}
              </span>
            </div>
            <div className="stat-block">
              <span className="stat-label">{t.durationStat}</span>
              <span className="stat-val-sm">{(elapsedMs / 1000).toFixed(1)}s</span>
            </div>
            {pbState.best && (
              <div className="stat-block">
                <span className="stat-label">{t.personalBestStat}</span>
                <span className="stat-val-sm">{pbState.best.wpm} wpm</span>
              </div>
            )}
          </div>

          <div className="restart-row" style={{ justifyContent: "center", marginTop: "0.75rem" }}>
            <button
              ref={restartBtnRef}
              type="button"
              className="restart-btn"
              onClick={restart}
              onKeyDown={(e) => {
                if (e.key === " ") e.preventDefault();
              }}
            >
              {t.nextTestBtn}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// 2) Multiplayer Race Room View
// ---------------------------------------------------------------------------
function MultiplayerRoomView({
  uiLang,
  roomId,
  playerName,
  caretStyle,
  settings,
  onOpenSettings,
  onExit
}: {
  uiLang: UiLang;
  roomId: string;
  playerName: string;
  caretStyle: CaretStyle;
  settings: UserSettings;
  onOpenSettings: () => void;
  onExit: () => void;
}) {
  const t = UI_STRINGS[uiLang];
  const [room, setRoom] = useState<PublicRoomSnapshot | null>(null);
  const [youId, setYouId] = useState<string | null>(null);
  const [raceText, setRaceText] = useState<string>("");
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [wordIndex, setWordIndex] = useState(0);
  const [input, setInput] = useState("");
  const [keystrokes, setKeystrokes] = useState(0);
  const [totalErrors, setTotalErrors] = useState(0);
  const [wordErrors, setWordErrors] = useState(0);
  const [countdownLeftMs, setCountdownLeftMs] = useState<number>(0);
  const [raceTimeLeftMs, setRaceTimeLeftMs] = useState<number>(RACE_DURATION_MS);
  const [raceSamples, setRaceSamples] = useState<SecondSample[]>([]);
  const [bots, setBots] = useState<BotConnection[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const botsRef = useRef<BotConnection[]>([]);
  const startBtnRef = useRef<HTMLButtonElement>(null);
  const rematchBtnRef = useRef<HTMLButtonElement>(null);
  const clockOffsetRef = useRef<number>(0);
  const bestRttRef = useRef<number>(Infinity);
  const finishSentForRaceRef = useRef<number>(0);
  const racersRef = useRef<Record<string, RemoteRacerState>>({});
  const [renderedRatios, setRenderedRatios] = useState<Record<string, number>>({});

  const raceStatsRef = useRef({
    typedChars: 0,
    keystrokes: 0,
    errors: 0,
    lastSampledErrors: 0,
    lastSampleSec: 0
  });

  const words = useMemo(() => splitWords(raceText), [raceText]);
  // Show the quote's attribution in quote races (moral rights / author credit).
  // The server sends only the text; look up the source from the matching client quote list.
  const raceQuote = useMemo(() => {
    if (room?.raceMode !== "quote" || !raceText) return null;
    const target = normalizeText(raceText);
    const pool = room.lang === "en" ? enQuotes : trQuotes;
    return pool.find((q) => normalizeText(q.text) === target) ?? null;
  }, [raceText, room?.raceMode, room?.lang]);
  const previewWords = useMemo(() => {
    const pool = room?.lang === "en" ? enWords : trWords;
    return generateWordSequence(pool, 45, 7, room?.lang ?? "tr");
  }, [room?.lang]);
  const displayWords = words.length > 0 ? words : previewWords;

  const prefixChars = useMemo(() => computePrefixChars(words), [words]);
  const prefixCharsRef = useRef<number[]>(prefixChars);
  prefixCharsRef.current = prefixChars;

  const sendMsg = (msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  const addBot = () => {
    if (!room || room.players.length >= room.maxPlayers) return;
    const bot = connectPracticeBot(roomId, botsRef.current.length);
    botsRef.current = [...botsRef.current, bot];
    setBots(botsRef.current);
  };

  const clearBots = () => {
    for (const b of botsRef.current) b.close();
    botsRef.current = [];
    setBots([]);
  };

  useEffect(() => {
    return () => {
      for (const b of botsRef.current) b.close();
      botsRef.current = [];
    };
  }, []);

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${window.location.host}/api/rooms/${roomId}/ws`;
    let stopped = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    // Reconnect with the same playerId + token on disconnect.
    // The server holds the player's slot until the race ends.
    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const savedId = sessionStorage.getItem(`pid_${roomId}`) || undefined;
        const savedToken = sessionStorage.getItem(`ptok_${roomId}`) || undefined;
        sendMsg({
          t: "hello",
          v: PROTOCOL_VERSION,
          name: playerName,
          playerId: savedId,
          token: savedToken
        });
        for (let i = 0; i < 3; i++) {
          setTimeout(() => sendMsg({ t: "ping", c: Date.now() }), i * 250);
        }
      };

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data) as ServerMessage;
        switch (msg.t) {
          case "welcome":
            attempt = 0;
            setErrorMsg(null);
            setYouId(msg.you);
            sessionStorage.setItem(`pid_${roomId}`, msg.you);
            sessionStorage.setItem(`ptok_${roomId}`, msg.token);
            setRoom(msg.room);
            break;

          case "pong": {
            const t1 = Date.now();
            const rtt = t1 - msg.c;
            if (rtt < bestRttRef.current) {
              bestRttRef.current = rtt;
              clockOffsetRef.current = msg.s - (msg.c + rtt / 2);
            }
            break;
          }

          case "room_state":
            setRoom(msg.room);
            if (msg.room.phase === "LOBBY") {
              setResults(null);
              setRaceText("");
              setWordIndex(0);
              setInput("");
              setRaceSamples([]);
              setRaceTimeLeftMs((msg.room.timeOption ?? 60) * 1_000);
            }
            break;

          case "player_joined":
            setErrorMsg(null);
            setRoom((prev) =>
              prev
                ? {
                    ...prev,
                    players: [
                      ...prev.players.filter((p) => p.id !== msg.player.id),
                      msg.player
                    ]
                  }
                : prev
            );
            break;

          case "player_left":
            setRoom((prev) =>
              prev
                ? {
                    ...prev,
                    hostId: msg.hostId,
                    players: prev.players.filter((p) => p.id !== msg.id)
                  }
                : prev
            );
            break;

          case "countdown":
            setErrorMsg(null);
            setResults(null);
            setRaceText("");
            setWordIndex(0);
            setInput("");
            setKeystrokes(0);
            setTotalErrors(0);
            setWordErrors(0);
            setRaceSamples([]);
            setRaceTimeLeftMs(RACE_DURATION_MS);
            finishSentForRaceRef.current = 0;
            raceStatsRef.current = {
              typedChars: 0,
              keystrokes: 0,
              errors: 0,
              lastSampledErrors: 0,
              lastSampleSec: 0
            };
            racersRef.current = {};
            setRenderedRatios({});
            setRoom((prev) =>
              prev
                ? {
                    ...prev,
                    phase: "COUNTDOWN",
                    raceId: msg.r,
                    sStartAt: msg.sStartAt,
                    wordCount: msg.wordCount,
                    charCount: msg.charCount
                  }
                : prev
            );
            break;

          case "race_text":
            prefixCharsRef.current = computePrefixChars(splitWords(msg.text));
            setRaceText(msg.text);
            break;

          case "progress_broadcast": {
            if (!racersRef.current[msg.id]) {
              racersRef.current[msg.id] = createRemoteRacer(
                performance.now(),
                prefixCharsRef.current
              );
            }
            onRemoteProgress(
              racersRef.current[msg.id],
              msg.w,
              msg.wpm,
              prefixCharsRef.current
            );
            setRoom((prev) =>
              prev
                ? {
                    ...prev,
                    players: prev.players.map((p) =>
                      p.id === msg.id ? { ...p, wordIndex: msg.w, wpm: msg.wpm } : p
                    )
                  }
                : prev
            );
            break;
          }

          case "player_finished":
            if (!racersRef.current[msg.id]) {
              racersRef.current[msg.id] = createRemoteRacer(
                performance.now(),
                prefixCharsRef.current
              );
            }
            racersRef.current[msg.id].finished = true;
            setRoom((prev) =>
              prev
                ? {
                    ...prev,
                    players: prev.players.map((p) =>
                      p.id === msg.id
                        ? {
                            ...p,
                            place: msg.place,
                            finishMs: msg.ms,
                            wpm: msg.wpm,
                            acc: msg.acc,
                            status: "finished"
                          }
                        : p
                    )
                  }
                : prev
            );
            break;

          case "results":
            setResults(msg.rows);
            break;

          case "error":
            setErrorMsg(msg.msg);
            break;
        }
      };

      ws.onclose = (ev) => {
        if (stopped || wsRef.current !== ws) return;
        // 1002 version mismatch, 1003 invalid message, 1008 room full/not found/rate-limited,
        // 4000 another tab took over this player: retrying won't help.
        if (ev.code === 1002 || ev.code === 1003 || ev.code === 1008 || ev.code === 4000) return;
        setErrorMsg(t.reconnecting);
        const delay = Math.min(10_000, 500 * 2 ** attempt);
        attempt += 1;
        retryTimer = setTimeout(connect, delay);
      };
    };
    connect();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, [roomId]);

  useEffect(() => {
    let rafId = 0;
    let lastNow = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(100, now - lastNow);
      lastNow = now;

      const roomDurationMs = (room?.timeOption ?? 60) * 1_000;

      if (room?.sStartAt) {
        const localServerNow = Date.now() + clockOffsetRef.current;
        const left = Math.max(0, room.sStartAt - localServerNow);
        setCountdownLeftMs(left);

        const elapsedSinceStart = Math.max(0, localServerNow - room.sStartAt);
        const timeLeft = Math.max(0, roomDurationMs - elapsedSinceStart);
        setRaceTimeLeftMs(timeLeft);

        // Auto-finish when timed race reaches 0s
        if (
          left <= 0 &&
          room.raceMode !== "quote" &&
          timeLeft <= 0 &&
          (room.phase === "RACING" || room.phase === "COUNTDOWN") &&
          finishSentForRaceRef.current !== room.raceId
        ) {
          finishSentForRaceRef.current = room.raceId;
          sendMsg({
            t: "finish",
            r: room.raceId,
            x: "",
            ce: roomDurationMs,
            keys: raceStatsRef.current.keystrokes,
            errs: raceStatsRef.current.errors
          });
        }

        // Once countdown ends, ensure every remote racer is initialized so their bar glides smoothly from t=0
        if (
          left <= 0 &&
          (room.phase === "RACING" || room.phase === "COUNTDOWN") &&
          prefixCharsRef.current.length > 1
        ) {
          for (const p of room.players) {
            if (p.id !== youId && !racersRef.current[p.id]) {
              racersRef.current[p.id] = createRemoteRacer(
                now,
                prefixCharsRef.current
              );
            }
          }
        }
      } else {
        setCountdownLeftMs(0);
        setRaceTimeLeftMs(roomDurationMs);
      }

      const nextRatios: Record<string, number> = {};
      for (const [id, r] of Object.entries(racersRef.current)) {
        nextRatios[id] = stepRemoteRacer(r, dt, now);
      }
      setRenderedRatios(nextRatios);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [room?.sStartAt, room?.phase, room?.raceMode, room?.timeOption, room?.raceId, room?.players, youId, prefixChars]);

  const youPlayer = room?.players.find((p) => p.id === youId);
  const canType = Boolean(
    room &&
      (room.phase === "RACING" || (room.phase === "COUNTDOWN" && countdownLeftMs <= 0)) &&
      youPlayer?.status !== "finished" &&
      (room.raceMode === "quote" || raceTimeLeftMs > 0) &&
      words.length > 0 &&
      wordIndex < words.length
  );

  const currentWord = words[wordIndex] ?? "";
  const correctCharsInCurrent = Array.from(normalizeWord(input)).filter(
    (ch, i) => ch === currentWord[i]
  ).length;
  const myTypedChars = (prefixChars[wordIndex] ?? 0) + correctCharsInCurrent;

  raceStatsRef.current.typedChars = myTypedChars;
  raceStatsRef.current.keystrokes = keystrokes;
  raceStatsRef.current.errors = totalErrors;

  // Sample per-second WPM during multiplayer race for the post-race chart
  useEffect(() => {
    if (!room?.sStartAt || (room.phase !== "RACING" && room.phase !== "COUNTDOWN")) {
      return;
    }
    const id = setInterval(() => {
      if (wordIndex >= words.length && words.length > 0) return;
      const localServerNow = Date.now() + clockOffsetRef.current;
      const elapsed = localServerNow - (room.sStartAt ?? localServerNow);
      if (elapsed < 1000) return;
      const wholeSec = Math.floor(elapsed / 1000);
      if (wholeSec > raceStatsRef.current.lastSampleSec) {
        raceStatsRef.current.lastSampleSec = wholeSec;
        const secErrors =
          raceStatsRef.current.errors - raceStatsRef.current.lastSampledErrors;
        raceStatsRef.current.lastSampledErrors = raceStatsRef.current.errors;
        setRaceSamples((prev) => [
          ...prev,
          {
            sec: wholeSec,
            wpm: calculateWpm(raceStatsRef.current.typedChars, elapsed),
            raw: calculateWpm(raceStatsRef.current.keystrokes, elapsed),
            errors: secErrors
          }
        ]);
      }
    }, 150);
    return () => clearInterval(id);
  }, [room?.sStartAt, room?.phase, wordIndex, words.length]);

  // Pressing Tab anywhere in multiplayer room only focuses rematch/start button (never top header buttons)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        if (document.querySelector(".modal-backdrop")) return;
        e.preventDefault();
        if (room?.phase === "FINISHED") {
          rematchBtnRef.current?.focus();
        } else if (room?.phase === "LOBBY") {
          startBtnRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [room?.phase]);

  const handleRaceInput = (val: string, isKeyError: boolean) => {
    if (!canType || !room || !room.sStartAt) return;
    setKeystrokes((k) => k + 1);
    if (isKeyError) {
      setTotalErrors((e) => e + 1);
      setWordErrors((e) => e + 1);
    }

    const isSpace = val.endsWith(" ");
    const candidate = normalizeWord(isSpace ? val.slice(0, -1) : val);
    const localServerNow = Date.now() + clockOffsetRef.current;
    const clientElapsed = Math.max(100, Math.round(localServerNow - room.sStartAt));

    if (
      (isSpace && candidate === currentWord) ||
      (!isSpace && wordIndex === words.length - 1 && candidate === currentWord)
    ) {
      const nextWordIdx = wordIndex + 1;
      setWordIndex(nextWordIdx);
      setInput("");

      if (nextWordIdx >= words.length) {
        finishSentForRaceRef.current = room.raceId;
        sendMsg({
          t: "finish",
          r: room.raceId,
          x: candidate,
          ce: clientElapsed,
          keys: keystrokes + 1,
          errs: totalErrors
        });
      } else {
        sendMsg({
          t: "progress",
          r: room.raceId,
          w: nextWordIdx,
          x: candidate,
          e: wordErrors,
          ce: clientElapsed
        });
        setWordErrors(0);
      }
      return;
    }

    if (isSpace) return;
    setInput(val);
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!room) {
    return (
      <div className="center-stage">
        {errorMsg ? (
          <div>
            <p style={{ color: "var(--error)", marginBottom: "1rem" }}>{errorMsg}</p>
            <button className="action-btn" onClick={onExit}>
              {t.backToHome}
            </button>
          </div>
        ) : (
          <p style={{ color: "var(--sub)" }}>
            {t.connectingRoom} ({roomId})...
          </p>
        )}
      </div>
    );
  }

  const isHost = room.hostId === youId;
  const totalChars = prefixChars[prefixChars.length - 1] || 1;
  const myRatio =
    words.length > 0
      ? Math.min(1, myTypedChars / totalChars)
      : 0;
  const canEditRoomConfig =
    isHost && (room.phase === "LOBBY" || room.phase === "FINISHED");

  return (
    <main className="center-stage">
      {/* Room Mode / Language bar in the middle — always keeps reserved height so typing box never shifts */}
      <div
        className="mode-selector-center"
        style={{
          marginBottom: "0.5rem",
          visibility:
            room.phase === "LOBBY" || room.phase === "FINISHED"
              ? "visible"
              : "hidden",
          pointerEvents:
            room.phase === "LOBBY" || room.phase === "FINISHED"
              ? "auto"
              : "none"
        }}
      >
        <div className="config-bar">
          {(["tr", "en"] as const).map((l) => (
            <button
              key={l}
              className={`text-btn ${room.lang === l ? "active" : ""}`}
              disabled={!canEditRoomConfig}
              onClick={() => sendMsg({ t: "config", lang: l })}
            >
              {l}
            </button>
          ))}

          <span className="config-sep" />

          <button
            className={`text-btn ${room.raceMode !== "quote" ? "active" : ""}`}
            disabled={!canEditRoomConfig}
            onClick={() => sendMsg({ t: "config", raceMode: "time" })}
          >
            {t.modeTime}
          </button>
          <button
            className={`text-btn ${room.raceMode === "quote" ? "active" : ""}`}
            disabled={!canEditRoomConfig}
            onClick={() => sendMsg({ t: "config", raceMode: "quote" })}
          >
            {t.modeQuote}
          </button>

          {room.raceMode !== "quote" && (
            <>
              <span className="config-sep" />
              {([15, 30, 60, 120] as const).map((sec) => (
                <button
                  key={sec}
                  className={`text-btn ${
                    (room.timeOption ?? 60) === sec ? "active" : ""
                  }`}
                  disabled={!canEditRoomConfig}
                  onClick={() => sendMsg({ t: "config", timeOption: sec })}
                >
                  {sec}
                </button>
              ))}
            </>
          )}

          <span className="config-sep" />
          <button
            type="button"
            className="text-btn icon-only-btn"
            onClick={onOpenSettings}
            title={t.settingsTooltip}
            aria-label={t.settingsTooltip}
          >
            <GearIcon size={14} />
          </button>
        </div>
      </div>

      {/* Room header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          minHeight: "36px"
        }}
      >
        <div>
          <span style={{ color: "var(--sub)", fontSize: "0.85rem" }}>
            {t.roomWord} <strong style={{ color: "var(--text)" }}>#{room.roomId}</strong> ·{" "}
            {room.players.length}/{room.maxPlayers} {t.playersWord}
          </span>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button className="action-btn" onClick={copyInviteLink}>
            {copied ? t.copiedInvite : t.copyInvite}
          </button>

          {(room.phase === "LOBBY" || room.phase === "FINISHED") && isHost && (
            <>
              {room.players.length < room.maxPlayers && (
                <button className="action-btn" onClick={addBot}>
                  {t.addBot}
                </button>
              )}
              {bots.length > 0 && (
                <button className="action-btn" onClick={clearBots}>
                  {t.removeBots} ({bots.length})
                </button>
              )}
            </>
          )}

          {room.phase === "LOBBY" && isHost && (
            <button
              ref={startBtnRef}
              className="action-btn primary"
              onClick={() => sendMsg({ t: "start" })}
              onKeyDown={(e) => {
                if (e.key === " ") e.preventDefault();
              }}
            >
              {t.startRace}
            </button>
          )}

          {room.phase === "FINISHED" && isHost && (
            <button
              ref={rematchBtnRef}
              className="action-btn primary"
              onClick={() => sendMsg({ t: "rematch" })}
              onKeyDown={(e) => {
                if (e.key === " ") e.preventDefault();
              }}
            >
              {t.rematchBtn}
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div style={{ color: "var(--error)", fontSize: "0.85rem" }}>{errorMsg}</div>
      )}

      <div className="lanes">
        {room.players.map((p) => {
          const ratio =
            p.id === youId
              ? p.status === "finished" && room.raceMode === "quote"
                ? 1
                : myRatio
              : renderedRatios[p.id] ??
                (p.status === "finished" && room.raceMode === "quote"
                  ? 1
                  : room.wordCount > 0
                  ? p.wordIndex / room.wordCount
                  : 0);
          const pct = Math.min(100, Math.max(0, ratio * 100));

          return (
            <div key={p.id} className={`lane ${p.id === youId ? "you" : ""}`}>
              <div className="lane-name">
                {p.place ? (
                  <span style={{ color: "var(--main)", fontWeight: 600 }}>
                    #{p.place}{" "}
                  </span>
                ) : null}
                {p.name}
                {p.id === youId ? t.youSuffix : ""}
                {p.id === room.hostId ? t.hostSuffix : ""}
              </div>
              <div className="lane-track">
                <div className="lane-fill" style={{ width: `${pct}%` }} />
                <div className="lane-marker" style={{ left: `${pct}%` }} />
              </div>
              <div className="lane-stats">
                <strong style={{ color: "var(--text)" }}>
                  {Math.round(p.wpm)}
                </strong>{" "}
                wpm
                {p.finishMs ? ` · ${(p.finishMs / 1000).toFixed(1)}s` : ""}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fixed-position, fixed-size typing box across all phases so its size and place never change */}
      <div className="race-typing-shell">
        <div className="live-counter-row">
          {room.phase === "LOBBY" ? (
            <div className="big-counter">
              {room.raceMode !== "quote"
                ? `${room.timeOption ?? 60}s`
                : t.modeQuote}
            </div>
          ) : countdownLeftMs > 0 ? (
            <div className="big-counter">
              {(countdownLeftMs / 1000).toFixed(1)}s
            </div>
          ) : room.raceMode !== "quote" ? (
            <div className="big-counter">
              {Math.ceil(raceTimeLeftMs / 1000)}s
            </div>
          ) : (
            <div className="big-counter">
              {wordIndex}/{words.length}
            </div>
          )}

          <div className="sub-counter">
            {room.phase === "LOBBY"
              ? room.players.length < 2
                ? t.lobbyNeedMore
                : isHost
                ? t.lobbyReadyHost
                : t.lobbyWaitingHost
              : room.raceMode !== "quote" && words.length > 0
              ? `${wordIndex} ${t.modeWords}`
              : ""}
          </div>
        </div>

        <TypingArea
          words={displayWords}
          wordIndex={words.length > 0 ? wordIndex : 0}
          currentInput={words.length > 0 ? input : ""}
          disabled={!canType}
          blurred={
            room.phase === "LOBBY" ||
            room.phase === "FINISHED" ||
            countdownLeftMs > 0 ||
            words.length === 0
          }
          blindMode={settings.blindMode}
          fontSize={settings.fontSize}
          caretStyle={caretStyle}
          onInputChange={handleRaceInput}
        />

        {raceQuote && room.phase !== "LOBBY" && (
          <div className="quote-source-line">
            — {raceQuote.source} ({raceQuote.id})
          </div>
        )}
      </div>

      {results && (
        <div className="results-container" style={{ paddingTop: "0.5rem" }}>
          <div>
            <div
              style={{
                color: "var(--sub)",
                fontSize: "0.85rem",
                marginBottom: "0.5rem"
              }}
            >
              {t.raceStandings}
            </div>
            {results.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.55rem 0.75rem",
                  fontSize: "0.9rem",
                  background: r.id === youId ? "var(--sub-alt)" : "transparent",
                  borderRadius: "5px",
                  marginBottom: "0.25rem"
                }}
              >
                <span>
                  <strong style={{ color: "var(--main)" }}>
                    {r.place ? `#${r.place}` : r.status}
                  </strong>{" "}
                  — {r.name}
                  {r.id === youId ? t.youSuffix : ""}
                </span>
                <span style={{ color: "var(--sub)" }}>
                  <strong style={{ color: "var(--text)" }}>{r.wpm} wpm</strong> · %
                  {r.acc} · {r.ms ? `${(r.ms / 1000).toFixed(1)}s` : "-"}
                </span>
              </div>
            ))}
          </div>

          {raceSamples.length > 0 && (
            <ResultChart samples={raceSamples} uiLang={uiLang} />
          )}
        </div>
      )}
    </main>
  );
}
