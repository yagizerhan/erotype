// SPDX-License-Identifier: AGPL-3.0-or-later
import React, { useEffect, useRef, useState } from "react";
import { UI_STRINGS, type UiLang } from "../i18n";
import { soundEngine, type SoundProfile } from "../typing/sound";
import type { FontSizeOption } from "./TypingArea";
import { parseVariantMode2 } from "../../shared/variant";

// "60:pn" -> "60 @ #" (@ punctuation, # numbers; matches toolbar icons)
function formatMode2(key: string): string {
  const v = parseVariantMode2(key);
  return `${v.base}${v.punctuation ? " @" : ""}${v.numbers ? " #" : ""}`;
}

// ---------------------------------------------------------------------------
// Monochrome minimalist SVG icons (currentColor)
// ---------------------------------------------------------------------------
export function MoreDotsIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
export function LeaderboardIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

export function GearIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function GlobeIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export function GithubLogo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0.3C5.37 0.3 0 5.67 0 12.3c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.58 0-.28-.01-1.04-.02-2.04-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.02 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.21.7.82.58C20.56 22.1 24 17.6 24 12.3 24 5.67 18.63 0.3 12 0.3z" />
    </svg>
  );
}

export function GoogleLogo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

export type DifficultyMode = "normal" | "expert" | "master";

export interface UserSettings {
  difficulty: DifficultyMode;
  blindMode: boolean;
  quickRestartTab: boolean;
  showLiveWpm: boolean;
  fontSize: FontSizeOption;
  volume: number;
}

export interface ServerUserData {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  } | null;
  profile: {
    username: string;
    bio?: string | null;
    racesTotal: number;
    racesWon: number;
    testsTotal: number;
    createdAt?: number;
  } | null;
  pbs: {
    mode: string;
    mode2: string;
    lang: string;
    wpm: number;
    acc: number;
    createdAt: number;
  }[];
  recentResults: {
    id: string;
    mode: string;
    mode2: string;
    lang: string;
    wpm: number;
    rawWpm: number;
    acc: number;
    consistency: number | null;
    createdAt: number;
  }[];
}

// Helper to resize and crop an uploaded image file to a 128x128 WebP/JPEG data URL
async function resizeImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Görsel yüklenemedi"));
      img.onload = () => {
        const size = 128;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas desteklenmiyor"));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const webp = canvas.toDataURL("image/webp", 0.85);
        if (webp.startsWith("data:image/webp")) {
          resolve(webp);
        } else {
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// 1) Leaderboard Modal — clicking a player row opens their public profile
// ---------------------------------------------------------------------------
export function LeaderboardModal({
  uiLang,
  onSelectUser,
  onClose
}: {
  uiLang: UiLang;
  onSelectUser: (username: string) => void;
  onClose: () => void;
}) {
  const t = UI_STRINGS[uiLang];
  const [lang, setLang] = useState<"tr" | "en">("tr");
  const [rows, setRows] = useState<
    {
      username: string;
      wpm: number;
      acc: number;
      createdAt: number;
      avatar?: string | null;
      fullName?: string | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?mode=time&mode2=60&lang=${lang}`)
      .then((r) =>
        r.json() as Promise<{
          rows?: {
            username: string;
            wpm: number;
            acc: number;
            createdAt: number;
            avatar?: string | null;
            fullName?: string | null;
          }[];
        }>
      )
      .then((d) => {
        setRows(d.rows ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [lang]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3
            className="modal-title"
            style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}
          >
            <LeaderboardIcon size={17} />
            <span>{t.leaderboardTitle}</span>
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
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
            </div>
            <button className="text-btn" onClick={onClose}>
              {t.closeEsc}
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ color: "var(--sub)", fontSize: "0.85rem" }}>{t.loading}</p>
        ) : rows.length === 0 ? (
          <p
            style={{
              color: "var(--sub)",
              fontSize: "0.85rem",
              padding: "1.5rem 0"
            }}
          >
            {t.emptyLeaderboard}
          </p>
        ) : (
          <div className="board-list">
            <div className="board-row board-head">
              <span>#</span>
              <span>{t.colPlayer}</span>
              <span>{t.colWpm}</span>
              <span>{t.colAcc}</span>
            </div>
            {rows.map((r, idx) => (
              <div
                key={`${r.username}-${idx}`}
                className="board-row clickable-row"
                onClick={() => onSelectUser(r.username)}
                title={t.clickToViewProfile}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectUser(r.username);
                  }
                }}
              >
                <span
                  style={{
                    color: idx < 3 ? "var(--main)" : "var(--sub)",
                    fontWeight: idx < 3 ? 600 : 400
                  }}
                >
                  #{idx + 1}
                </span>
                <span
                  style={{
                    color: "var(--text)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.45rem"
                  }}
                >
                  {r.avatar ? (
                    <img
                      src={r.avatar}
                      alt={r.username}
                      className="avatar-xs"
                    />
                  ) : (
                    <span className="avatar-xs avatar-fallback">
                      {r.username.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="player-handle-link">@{r.username}</span>
                  {r.fullName && (
                    <span style={{ color: "var(--sub)", fontSize: "0.75rem" }}>
                      ({r.fullName})
                    </span>
                  )}
                </span>
                <strong style={{ color: "var(--main)" }}>
                  {Math.round(r.wpm)}
                </strong>
                <span style={{ color: "var(--sub)" }}>%{Math.round(r.acc)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2) Settings Modal
// ---------------------------------------------------------------------------
export function SettingsModal({
  uiLang,
  settings,
  onChange,
  onClose
}: {
  uiLang: UiLang;
  settings: UserSettings;
  onChange: (next: UserSettings) => void;
  onClose: () => void;
}) {
  const t = UI_STRINGS[uiLang];
  const update = <K extends keyof UserSettings>(
    key: K,
    val: UserSettings[K]
  ) => {
    const next = { ...settings, [key]: val };
    onChange(next);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3
            className="modal-title"
            style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}
          >
            <GearIcon size={16} />
            <span>{t.settingsTitle}</span>
          </h3>
          <button className="text-btn" onClick={onClose}>
            {t.closeEsc}
          </button>
        </div>

        <div className="settings-list">
          <div className="setting-item">
            <div>
              <div className="setting-name">{t.diffTitle}</div>
              <div className="setting-desc">{t.diffDesc}</div>
            </div>
            <div className="config-bar">
              {(
                [
                  { id: "normal", label: t.diffNormal },
                  { id: "expert", label: t.diffExpert },
                  { id: "master", label: t.diffMaster }
                ] as const
              ).map((d) => (
                <button
                  key={d.id}
                  className={`text-btn ${
                    settings.difficulty === d.id ? "active" : ""
                  }`}
                  onClick={() => update("difficulty", d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="setting-item">
            <div>
              <div className="setting-name">{t.liveWpmTitle}</div>
              <div className="setting-desc">{t.liveWpmDesc}</div>
            </div>
            <div className="config-bar">
              <button
                className={`text-btn ${!settings.showLiveWpm ? "active" : ""}`}
                onClick={() => update("showLiveWpm", false)}
              >
                {t.offLabel}
              </button>
              <button
                className={`text-btn ${settings.showLiveWpm ? "active" : ""}`}
                onClick={() => update("showLiveWpm", true)}
              >
                {t.onLabel}
              </button>
            </div>
          </div>

          <div className="setting-item">
            <div>
              <div className="setting-name">{t.blindModeTitle}</div>
              <div className="setting-desc">{t.blindModeDesc}</div>
            </div>
            <div className="config-bar">
              <button
                className={`text-btn ${!settings.blindMode ? "active" : ""}`}
                onClick={() => update("blindMode", false)}
              >
                {t.offLabel}
              </button>
              <button
                className={`text-btn ${settings.blindMode ? "active" : ""}`}
                onClick={() => update("blindMode", true)}
              >
                {t.onLabel}
              </button>
            </div>
          </div>

          <div className="setting-item">
            <div>
              <div className="setting-name">{t.quickTabTitle}</div>
              <div className="setting-desc">{t.quickTabDesc}</div>
            </div>
            <div className="config-bar">
              <button
                className={`text-btn ${
                  !settings.quickRestartTab ? "active" : ""
                }`}
                onClick={() => update("quickRestartTab", false)}
              >
                tab + enter
              </button>
              <button
                className={`text-btn ${
                  settings.quickRestartTab ? "active" : ""
                }`}
                onClick={() => update("quickRestartTab", true)}
              >
                tab
              </button>
            </div>
          </div>

          <div className="setting-item">
            <div>
              <div className="setting-name">{t.fontSizeTitle}</div>
              <div className="setting-desc">{t.fontSizeDesc}</div>
            </div>
            <div className="config-bar">
              {(
                [
                  { id: "sm", label: t.fontSm },
                  { id: "md", label: t.fontMd },
                  { id: "lg", label: t.fontLg }
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  className={`text-btn ${
                    settings.fontSize === f.id ? "active" : ""
                  }`}
                  onClick={() => update("fontSize", f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="setting-item">
            <div>
              <div className="setting-name">{t.volumeTitle}</div>
              <div className="setting-desc">{t.volumeDesc}</div>
            </div>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  soundEngine.setVolume(v);
                  soundEngine.playKey("press");
                  update("volume", v);
                }}
                style={{ accentColor: "var(--main)", cursor: "pointer" }}
              />
              <span
                style={{
                  fontSize: "0.78rem",
                  color: "var(--sub)",
                  minWidth: "36px"
                }}
              >
                %{Math.round(settings.volume * 100)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared Public Profile Showcase (ProfileShowcaseView)
// Used both for viewing your own profile and when clicking a player on the leaderboard.
// ---------------------------------------------------------------------------
export interface PublicProfileData {
  profile: {
    username: string;
    fullName: string | null;
    avatar: string | null;
    bio: string | null;
    createdAt: number;
    testsTotal: number;
    racesTotal: number;
    racesWon: number;
  };
  pbs: {
    mode: string;
    mode2: string;
    lang: string;
    wpm: number;
    acc: number;
    createdAt: number;
  }[];
  recentResults: {
    id: string;
    mode: string;
    mode2: string;
    lang: string;
    wpm: number;
    rawWpm: number;
    acc: number;
    consistency: number | null;
    createdAt: number;
  }[];
}

function ProfileShowcaseView({
  uiLang,
  data,
  isOwnProfile = false,
  isEditing = false,
  onToggleEdit,
  onSignOut
}: {
  uiLang: UiLang;
  data: PublicProfileData;
  isOwnProfile?: boolean;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onSignOut?: () => void;
}) {
  const t = UI_STRINGS[uiLang];
  const [copiedLink, setCopiedLink] = useState(false);

  const { profile, pbs, recentResults } = data;
  const bestWpm =
    pbs.length > 0 ? Math.round(Math.max(...pbs.map((p) => p.wpm))) : 0;
  const avgAcc =
    recentResults.length > 0
      ? Math.round(
          recentResults.reduce((acc, r) => acc + r.acc, 0) /
            recentResults.length
        )
      : pbs.length > 0
      ? Math.round(pbs.reduce((acc, p) => acc + p.acc, 0) / pbs.length)
      : 0;

  const joinedDateStr = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(
        uiLang === "en" ? "en-US" : "tr-TR",
        { year: "numeric", month: "short", day: "numeric" }
      )
    : null;

  const handleCopyProfileLink = () => {
    const url = `${window.location.origin}/u/${encodeURIComponent(
      profile.username
    )}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="profile-showcase">
      {/* Hero Banner */}
      <div className="profile-hero-card">
        <div className="profile-hero-left">
          <div className="avatar-lg-wrap">
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt={profile.fullName || profile.username}
                className="avatar-lg"
              />
            ) : (
              <div className="avatar-lg avatar-fallback">
                {(profile.fullName || profile.username || "K")
                  .slice(0, 1)
                  .toUpperCase()}
              </div>
            )}
          </div>

          <div className="profile-identity">
            <div className="profile-name-row">
              <span className="profile-fullname">
                {profile.fullName || `@${profile.username}`}
              </span>
              <span className="profile-handle-badge">@{profile.username}</span>
            </div>

            {profile.bio && <p className="profile-bio-text">{profile.bio}</p>}

            <div className="profile-meta-row">
              {joinedDateStr && (
                <span>
                  {t.joinedPrefix}: {joinedDateStr}
                </span>
              )}
              <button
                type="button"
                className="text-btn"
                style={{ fontSize: "0.75rem", padding: 0 }}
                onClick={handleCopyProfileLink}
              >
                {copiedLink ? t.sharedProfileMsg : `🔗 ${t.shareProfileBtn}`}
              </button>
            </div>
          </div>
        </div>

        {isOwnProfile && (
          <div className="profile-hero-actions">
            {onToggleEdit && (
              <button
                type="button"
                className={`action-btn ${isEditing ? "primary" : ""}`}
                onClick={onToggleEdit}
              >
                {isEditing ? t.viewPublicProfileBtn : t.editProfileBtn}
              </button>
            )}
            {onSignOut && (
              <button type="button" className="text-btn" onClick={onSignOut}>
                {t.signOutBtn}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4-Stat Summary Grid */}
      <div className="profile-stats-grid">
        <div className="stat-block">
          <span className="stat-label">{t.statTests}</span>
          <span className="stat-val-sm">{profile.testsTotal}</span>
        </div>
        <div className="stat-block">
          <span className="stat-label">{t.statRaces}</span>
          <span className="stat-val-sm">
            {profile.racesTotal}{" "}
            <small style={{ color: "var(--sub)", fontSize: "0.75rem" }}>
              ({profile.racesWon} {t.statRacesWon})
            </small>
          </span>
        </div>
        <div className="stat-block">
          <span className="stat-label">{t.statBestWpm}</span>
          <span className="stat-val-sm" style={{ color: "var(--main)" }}>
            {bestWpm}
          </span>
        </div>
        <div className="stat-block">
          <span className="stat-label">{t.statAvgAcc}</span>
          <span className="stat-val-sm">%{avgAcc}</span>
        </div>
      </div>

      {/* Personal Bests Showcase Grid */}
      <div>
        <div className="section-caption">{t.pbSectionTitle}</div>
        {pbs.length === 0 ? (
          <p style={{ color: "var(--sub)", fontSize: "0.8rem" }}>
            {t.noServerPb}
          </p>
        ) : (
          <div className="pb-showcase-grid">
            {pbs.map((pb, i) => (
              <div key={i} className="pb-card">
                <div className="pb-card-top">
                  <span className="pb-card-mode">
                    {pb.mode} {formatMode2(pb.mode2)}
                  </span>
                  <span className="pb-card-lang">{pb.lang}</span>
                </div>
                <div className="pb-card-wpm">
                  {Math.round(pb.wpm)} <small>wpm</small>
                </div>
                <div className="pb-card-acc">%{Math.round(pb.acc)} acc</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Tests */}
      {recentResults.length > 0 && (
        <div>
          <div className="section-caption">{t.recentTestsTitle}</div>
          <div className="board-list">
            {recentResults.slice(0, 6).map((r) => (
              <div
                key={r.id}
                className="board-row"
                style={{ gridTemplateColumns: "1fr 90px 90px" }}
              >
                <span>
                  {r.mode} {formatMode2(r.mode2)} ({r.lang})
                </span>
                <strong style={{ color: "var(--text)" }}>
                  {Math.round(r.wpm)} wpm
                </strong>
                <span style={{ color: "var(--sub)" }}>%{Math.round(r.acc)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public Player Profile Modal (opened from Leaderboard or /u/:username)
// ---------------------------------------------------------------------------
export function PublicUserProfileModal({
  uiLang,
  username,
  onBackToLeaderboard,
  onClose
}: {
  uiLang: UiLang;
  username: string;
  onBackToLeaderboard?: () => void;
  onClose: () => void;
}) {
  const t = UI_STRINGS[uiLang];
  const [data, setData] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    fetch(`/api/users/${encodeURIComponent(username)}`)
      .then(async (r) => {
        if (!r.ok) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const d = (await r.json()) as PublicProfileData;
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [username]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: "680px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {onBackToLeaderboard && (
              <button
                type="button"
                className="text-btn"
                onClick={onBackToLeaderboard}
              >
                {t.backToLeaderboard}
              </button>
            )}
            <h3 className="modal-title">@{username}</h3>
          </div>
          <button className="text-btn" onClick={onClose}>
            {t.closeEsc}
          </button>
        </div>

        {loading ? (
          <p style={{ color: "var(--sub)", fontSize: "0.85rem" }}>{t.loading}</p>
        ) : notFound || !data ? (
          <p
            style={{
              color: "var(--sub)",
              fontSize: "0.85rem",
              padding: "1.5rem 0"
            }}
          >
            {t.userNotFound}
          </p>
        ) : (
          <ProfileShowcaseView uiLang={uiLang} data={data} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3) Auth Modal (Remember Me + OAuth) and Signed-in Profile Showcase / Customization
// ---------------------------------------------------------------------------
export function AuthProfileModal({
  uiLang,
  userData,
  onRefreshUser,
  onClose
}: {
  uiLang: UiLang;
  userData: ServerUserData;
  onRefreshUser: () => void;
  onClose: () => void;
}) {
  const t = UI_STRINGS[uiLang];
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState(
    () => localStorage.getItem("erotype_saved_email") || ""
  );
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Enabled auth methods on the server (email/password may be disabled in production)
  const [authConfig, setAuthConfig] = useState<{
    emailPassword: boolean;
    github: boolean;
    google: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth-config")
      .then((r) =>
        r.ok
          ? (r.json() as Promise<{ emailPassword: boolean; github: boolean; google: boolean }>)
          : null
      )
      .then((d) => {
        if (d) setAuthConfig(d);
      })
      .catch(() => {});
  }, []);

  // Account customization states (when logged in)
  const [isEditing, setIsEditing] = useState(false);
  const [editFullName, setEditFullName] = useState(
    userData.user?.name || ""
  );
  const [editUsername, setEditUsername] = useState(
    userData.profile?.username || ""
  );
  const [editBio, setEditBio] = useState(userData.profile?.bio || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    userData.user?.image ?? null
  );
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditFullName(userData.user?.name || "");
    setEditUsername(userData.profile?.username || "");
    setEditBio(userData.profile?.bio || "");
    setAvatarPreview(userData.user?.image ?? null);
  }, [
    userData.user?.name,
    userData.user?.image,
    userData.profile?.username,
    userData.profile?.bio
  ]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (email.trim()) {
        localStorage.setItem("erotype_saved_email", email.trim());
      }

      const endpoint =
        tab === "signup"
          ? "/api/auth/sign-up/email"
          : "/api/auth/sign-in/email";
      const payload =
        tab === "signup"
          ? { email, password, name: name || email.split("@")[0] }
          : { email, password, rememberMe: true };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(
          data.message ||
            data.error ||
            (uiLang === "en"
              ? "Sign in failed. Please check your credentials."
              : "Giriş yapılamadı, bilgilerinizi kontrol edin.")
        );
      } else {
        onRefreshUser();
      }
    } catch {
      setError(
        uiLang === "en" ? "Connection error occurred." : "Bağlantı hatası oluştu."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSocialLogin = async (provider: "github" | "google") => {
    setError(null);
    try {
      const res = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, callbackURL: window.location.origin })
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(
          uiLang === "en"
            ? `${provider} sign-in is not available right now.`
            : `${provider} ile giriş şu anda kullanılamıyor.`
        );
      }
    } catch {
      setError(
        uiLang === "en"
          ? "Could not start social sign-in."
          : "Sosyal giriş başlatılamadı."
      );
    }
  };

  const handleSignOut = async () => {
    // Better Auth requires a JSON body; bodyless POST returns 415 and fails to sign out.
    await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    onRefreshUser();
  };

  const handleDeleteAccount = async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: deleteConfirm })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setDeleteError(data.error || t.deleteAccountFailed);
        return;
      }
      // Session row is deleted; call sign-out to clear the cookie as well (errors ignored)
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      }).catch(() => {});
      onRefreshUser();
    } catch {
      setDeleteError(t.deleteAccountFailed);
    } finally {
      setDeleteBusy(false);
    }
  };

  const handlePhotoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileMsg(null);
    try {
      const dataUrl = await resizeImageFileToDataUrl(file);
      setAvatarPreview(dataUrl);
    } catch {
      setProfileMsg(
        uiLang === "en"
          ? "Could not process image file."
          : "Fotoğraf işlenemedi."
      );
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editFullName,
          username: editUsername,
          bio: editBio,
          image: avatarPreview
        })
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && d.ok) {
        setProfileMsg(t.profileSavedMsg);
        onRefreshUser();
        setIsEditing(false);
      } else {
        setProfileMsg(d.error || "Hata oluştu.");
      }
    } catch {
      setProfileMsg(
        uiLang === "en" ? "Connection error." : "Bağlantı hatası."
      );
    } finally {
      setBusy(false);
    }
  };

  const ownPublicData: PublicProfileData | null = userData.user
    ? {
        profile: {
          username:
            userData.profile?.username ||
            userData.user.email.split("@")[0] ||
            "oyuncu",
          fullName: userData.user.name || null,
          avatar: userData.user.image ?? null,
          bio: userData.profile?.bio ?? null,
          createdAt: userData.profile?.createdAt ?? Date.now(),
          testsTotal: userData.profile?.testsTotal ?? 0,
          racesTotal: userData.profile?.racesTotal ?? 0,
          racesWon: userData.profile?.racesWon ?? 0
        },
        pbs: userData.pbs,
        recentResults: userData.recentResults
      }
    : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: userData.user ? "680px" : "600px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">
            {userData.user ? t.profileTitle : t.loginModalTitle}
          </h3>
          <button className="text-btn" onClick={onClose}>
            {t.closeEsc}
          </button>
        </div>

        {!userData.user ? (
          <div>
            {authConfig?.emailPassword && (
            <>
            <div className="config-bar" style={{ marginBottom: "1rem" }}>
              <button
                className={`text-btn ${tab === "signin" ? "active" : ""}`}
                onClick={() => setTab("signin")}
              >
                {t.tabSignIn}
              </button>
              <button
                className={`text-btn ${tab === "signup" ? "active" : ""}`}
                onClick={() => setTab("signup")}
              >
                {t.tabSignUp}
              </button>
            </div>

            <form onSubmit={handleEmailAuth} className="auth-form">
              {tab === "signup" && (
                <input
                  className="modal-input"
                  placeholder={t.namePlaceholder}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              )}
              <input
                type="email"
                className="modal-input"
                placeholder={t.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                className="modal-input"
                placeholder={t.passwordPlaceholder}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />

              {error && (
                <div style={{ color: "var(--error)", fontSize: "0.8rem" }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="action-btn primary"
                disabled={busy}
              >
                {busy
                  ? t.pleaseWait
                  : tab === "signup"
                  ? t.createAccountBtn
                  : t.tabSignIn}
              </button>
            </form>

            <div className="social-divider">{t.orSocialLogin}</div>
            </>
            )}

            {!authConfig?.emailPassword && error && (
              <div
                style={{ color: "var(--error)", fontSize: "0.8rem", marginBottom: "0.75rem" }}
              >
                {error}
              </div>
            )}

            {/* Only larger centered monochrome logos for GitHub and Google */}
            <div className="oauth-logo-grid">
              <button
                type="button"
                className="action-btn oauth-logo-btn"
                onClick={() => handleSocialLogin("github")}
                title={t.githubLoginTitle}
                aria-label={t.githubLoginTitle}
              >
                <GithubLogo size={24} />
              </button>
              <button
                type="button"
                className="action-btn oauth-logo-btn"
                onClick={() => handleSocialLogin("google")}
                title={t.googleLoginTitle}
                aria-label={t.googleLoginTitle}
              >
                <GoogleLogo size={24} />
              </button>
            </div>
          </div>
        ) : (
          <div className="profile-view">
            {profileMsg && (
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--main)",
                  marginBottom: "0.75rem"
                }}
              >
                {profileMsg}
              </div>
            )}

            {/* Toggleable Account Customization Panel */}
            {isEditing && (
              <form onSubmit={handleSaveAccount} className="account-custom-box">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.85rem"
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "var(--main)"
                    }}
                  >
                    {t.customizeAccountHeading}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--sub)" }}>
                    {userData.user.email}
                  </span>
                </div>

                <div className="avatar-editor-row">
                  <div className="avatar-lg-wrap">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt={editFullName || editUsername}
                        className="avatar-lg"
                      />
                    ) : (
                      <div className="avatar-lg avatar-fallback">
                        {(editFullName || editUsername || "K")
                          .slice(0, 1)
                          .toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.35rem"
                    }}
                  >
                    <div style={{ fontSize: "0.8rem", color: "var(--text)" }}>
                      {t.photoLabel}
                    </div>
                    <div style={{ display: "flex", gap: "0.45rem" }}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        style={{ display: "none" }}
                        onChange={handlePhotoFileChange}
                      />
                      <button
                        type="button"
                        className="action-btn"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {t.uploadPhotoBtn}
                      </button>
                      {avatarPreview && (
                        <button
                          type="button"
                          className="text-btn"
                          onClick={() => setAvatarPreview(null)}
                        >
                          {t.removePhotoBtn}
                        </button>
                      )}
                    </div>
                    <span style={{ fontSize: "0.7rem", color: "var(--sub)" }}>
                      {t.photoHint}
                    </span>
                  </div>
                </div>

                <div className="account-fields-grid">
                  <div>
                    <label className="field-label">{t.fullNameLabel}</label>
                    <input
                      className="modal-input"
                      style={{ width: "100%" }}
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      placeholder={t.namePlaceholder}
                    />
                  </div>
                  <div>
                    <label className="field-label">{t.usernameLabel}</label>
                    <input
                      className="modal-input"
                      style={{ width: "100%" }}
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      placeholder="kullanici_adi"
                    />
                  </div>
                </div>

                <div style={{ marginTop: "0.65rem" }}>
                  <label className="field-label">{t.bioLabel}</label>
                  <input
                    className="modal-input"
                    style={{ width: "100%" }}
                    maxLength={160}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder={t.bioPlaceholder}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "0.6rem",
                    marginTop: "0.85rem"
                  }}
                >
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => setIsEditing(false)}
                  >
                    {t.viewPublicProfileBtn}
                  </button>
                  <button
                    type="submit"
                    className="action-btn primary"
                    disabled={busy}
                  >
                    {busy ? t.savingProfile : t.saveProfileBtn}
                  </button>
                </div>
              </form>
            )}

            {isEditing && userData.profile?.username && (
              <div className="danger-zone">
                <h4>{t.deleteAccountTitle}</h4>
                <p>{t.deleteAccountWarn}</p>
                <label className="field-label">
                  {t.deleteAccountConfirmLabel}: <code>{userData.profile.username}</code>
                </label>
                <div className="danger-zone-row">
                  <input
                    className="modal-input"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="action-btn danger"
                    disabled={
                      deleteBusy ||
                      deleteConfirm.trim().toLowerCase() !== userData.profile.username
                    }
                    onClick={handleDeleteAccount}
                  >
                    {deleteBusy ? t.deletingAccount : t.deleteAccountBtn}
                  </button>
                </div>
                {deleteError && (
                  <div style={{ color: "var(--error)", fontSize: "0.8rem", marginTop: "0.4rem" }}>
                    {deleteError}
                  </div>
                )}
              </div>
            )}

            {/* Same Public Profile Showcase View that other players see */}
            {ownPublicData && (
              <ProfileShowcaseView
                uiLang={uiLang}
                data={ownPublicData}
                isOwnProfile={true}
                isEditing={isEditing}
                onToggleEdit={() => {
                  setProfileMsg(null);
                  setIsEditing((prev) => !prev);
                }}
                onSignOut={handleSignOut}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4) Legal, Privacy Policy, Security Policy, and AGPL-3.0 License Modal
// ---------------------------------------------------------------------------
export type LegalTab = "privacy" | "security" | "license";

export function LegalModal({
  uiLang,
  initialTab = "privacy",
  onClose
}: {
  uiLang: UiLang;
  initialTab?: LegalTab;
  onClose: () => void;
}) {
  const t = UI_STRINGS[uiLang];
  const [tab, setTab] = useState<LegalTab>(initialTab);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: "740px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">{t.legalModalTitle}</h3>
          <button className="text-btn" onClick={onClose}>
            {t.closeEsc}
          </button>
        </div>

        <div className="config-bar" style={{ marginBottom: "1.1rem" }}>
          <button
            className={`text-btn ${tab === "privacy" ? "active" : ""}`}
            onClick={() => setTab("privacy")}
          >
            {t.legalTabPrivacy}
          </button>
          <button
            className={`text-btn ${tab === "security" ? "active" : ""}`}
            onClick={() => setTab("security")}
          >
            {t.legalTabSecurity}
          </button>
          <button
            className={`text-btn ${tab === "license" ? "active" : ""}`}
            onClick={() => setTab("license")}
          >
            {t.legalTabLicense}
          </button>
        </div>

        {tab === "privacy" && (
          <div className="legal-body">
            {uiLang === "tr" ? (
              <p>
                <strong>EroType</strong> yalnızca giriş (Google/GitHub), profil ve test sonuçları için gereken en az
                veriyi işler; reklam veya takip çerezi kullanmaz. KVKK aydınlatma metninin tamamı, haklarınız ve
                hesap silme için: <a href="/gizlilik">gizlilik politikası</a>.
              </p>
            ) : (
              <p>
                <strong>EroType</strong> processes only the minimal data needed for sign-in (Google/GitHub), profiles
                and test results, with no ads or tracking cookies. Full policy, your rights and account deletion:{" "}
                <a href="/gizlilik#en">privacy policy</a>.
              </p>
            )}
          </div>
        )}

        {tab === "security" && (
          <div className="legal-body">
            {uiLang === "tr" ? (
              <>
                <h4>1. Sorumlu Güvenlik Bildirimi (Responsible Disclosure)</h4>
                <p>
                  Sistemin gizliliğini, bütünlüğünü veya erişilebilirliğini etkileyen bir güvenlik açığı bulursanız,
                  bunu herkese açık paylaşmadan önce proje deposu (GitHub Security Advisories) üzerinden bize
                  bildirmenizi rica ederiz.
                </p>

                <h4>2. Güvenlik Araştırması Kuralları</h4>
                <ul>
                  <li>
                    Hizmet kesintisine (DoS / DDoS), spam oda açılmasına veya Cloudflare ücretsiz plan limitlerinin
                    kasıtlı tüketilmesine yol açacak otomatik saldırı araçları kullanmayın.
                  </li>
                  <li>
                    Başka kullanıcıların hesaplarına veya oturumlarına izinsiz erişmeye çalışmayın.
                  </li>
                </ul>

                <h4>3. Sunucu Otoriter Mimari ve Hile Önleme (Anti-Cheat)</h4>
                <ul>
                  <li>
                    <strong>Tek Kişilik Skor Doğrulama:</strong> Her test başlangıcında sunucu tarafından
                    <code>HMAC-SHA256</code> ile imzalanmış tek kullanımlık bir test bileti (<code>ticket</code>)
                    üretilir. Test sonunda sunucu, kelimeleri tohumdan (<code>seed</code>) yeniden üretir ve gerçek
                    süreyi/WPM değerini sunucuda hesaplar.
                  </li>
                  <li>
                    <strong>Çok Oyunculu Yarışlar:</strong> Yarış metni, başlangıç zamanı (<code>sStartAt</code>) ve
                    kelime bazlı ilerleme doğrulaması tamamen Cloudflare Durable Objects üzerinde sunucu otoriter
                    olarak yürütülür. Otomatik bot/script ile skor tablosuna müdahale edilmesi yasaktır.
                  </li>
                </ul>
              </>
            ) : (
              <>
                <h4>1. Responsible Vulnerability Disclosure</h4>
                <p>
                  If you discover a security vulnerability affecting the confidentiality, integrity, or availability of
                  EroType, please report it responsibly via our project repository before disclosing it publicly.
                </p>

                <h4>2. Security Research Guidelines</h4>
                <ul>
                  <li>
                    Do not perform Denial of Service (DoS/DDoS) attacks, automated room spamming, or actions that
                    exhaust infrastructure quotas.
                  </li>
                  <li>
                    Do not attempt to access or modify other users&apos; accounts or sessions.
                  </li>
                </ul>

                <h4>3. Authoritative Server & Anti-Cheat Architecture</h4>
                <ul>
                  <li>
                    <strong>Solo Score Verification:</strong> Every test starts with an <code>HMAC-SHA256</code> signed
                    stateless ticket. Upon completion, the server reconstructs the exact word sequence from the seed and
                    re-verifies elapsed wall-clock time and WPM on the server.
                  </li>
                  <li>
                    <strong>Multiplayer Races:</strong> Race text generation, countdown synchronization
                    (<code>sStartAt</code>), and per-word progress validation are executed authoritatively inside
                    Cloudflare Durable Objects. Automated typing scripts/bots on public leaderboards are prohibited.
                  </li>
                </ul>
              </>
            )}
          </div>
        )}

        {tab === "license" && (
          <div className="legal-body">
            {uiLang === "tr" ? (
              <>
                <h4>1. Açık Kaynak Lisansı — GNU AGPL-3.0</h4>
                <p>
                  Bu projenin kaynak kodu <strong>GNU Affero General Public License v3.0 (AGPL-3.0)</strong> altında
                  lisanslanmıştır (bkz. kök dizindeki <code>LICENSE</code> dosyası). AGPL-3.0 Madde 13 uyarınca, bu
                  yazılımı değiştirerek bir ağ/web sunucusu üzerinden kullanıcılara sunan herkes, değiştirilmiş tam
                  kaynak kodunu da aynı lisansla kullanıcılara açık olarak sunmak zorundadır.
                </p>

                <h4>2. Marka ve İsim Hakları (TRADEMARKS.md)</h4>
                <p>
                  AGPL-3.0 lisansı yalnızca kaynak kodunu kapsar; <strong>EroType</strong> adını, logosunu ve marka
                  kimliğini kapsamaz. Projeyi çatallayan (fork) kişiler kendi yayınlarında farklı bir isim ve logo
                  kullanmalıdır.
                </p>

                <h4>3. Üçüncü Parti Bildirimleri ve Hukuki Uyumluluk (THIRD_PARTY_NOTICES.md)</h4>
                <ul>
                  <li>
                    <strong>Monkeytype (GPL-3.0) ile İlişki:</strong> Projemizin yazma motoru, sunucu mimarisi ve
                    arayüz kodu sıfırdan yazılmıştır. <code>creams</code>, <code>click</code>, <code>typewriter</code>,
                    <code>osu</code> ses örnekleri ve <code>karbon</code> renk paleti ilhamı GPL-3.0 Madde 13 (AGPL-3.0
                    uyumluluğu) kapsamında kaynak gösterilerek kullanılmıştır. Monkeytype&apos;tan telifli alıntı metni,
                    marka adı veya logo kullanılmamıştır.
                  </li>
                  <li>
                    <strong>Alıntı Metinleri:</strong> Türkçe ve İngilizce alıntı modundaki tüm metinler 5846 sayılı FSEK
                    md. 27 uyarınca koruma süresi dolmuş kamu malı (<em>public domain</em>) eserlerden veya proje
                    ekibinin özgün metinlerinden (<code>CC0-1.0</code>) oluşur; her metnin kaynağı veri dosyasında
                    belirtilmiştir.
                  </li>
                </ul>
              </>
            ) : (
              <>
                <h4>1. Open Source License — GNU AGPL-3.0</h4>
                <p>
                  The source code of this project is licensed under the{" "}
                  <strong>GNU Affero General Public License v3.0 (AGPL-3.0)</strong> (see <code>LICENSE</code>). Under
                  AGPL-3.0 Section 13, anyone who modifies and runs this software as a network/web service must make the
                  complete modified source code available to users under the same license.
                </p>

                <h4>2. Trademarks & Branding (TRADEMARKS.md)</h4>
                <p>
                  The AGPL-3.0 license covers source code only and does not grant rights to the{" "}
                  <strong>EroType</strong> name, logo, or brand identity. Forks and derivative deployments must use a
                  distinct project name and logo.
                </p>

                <h4>3. Third-Party Notices & Legal Compliance (THIRD_PARTY_NOTICES.md)</h4>
                <ul>
                  <li>
                    <strong>Relationship with Monkeytype (GPL-3.0):</strong> Our typing engine, Durable Objects server
                    architecture, and UI code are written from scratch. Sound samples (<code>creams</code>,{" "}
                    <code>click</code>, <code>typewriter</code>, <code>osu</code>) and the <code>karbon</code> color
                    palette inspiration are used with attribution under GPL-3.0 Section 13 (AGPL-3.0 compatibility). No
                    copyrighted quotes, brand names, or logos from Monkeytype are used.
                  </li>
                  <li>
                    <strong>Quotes & Word Lists:</strong> All literary quotes are verified public-domain works or
                    original CC0-1.0 texts with explicit source and license metadata in <code>data/languages/</code>.
                  </li>
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Theme and Sound Picker Modal (Monkeytype-inspired comprehensive palette)
// ---------------------------------------------------------------------------

export interface ThemeInfo {
  id: string;
  name: string;
  bg: string;
  main: string;
  sub: string;
  text: string;
}

export const ALL_THEMES: ThemeInfo[] = [
  { id: "kor", name: "kor", bg: "#121010", main: "#ff5a1f", sub: "#756867", text: "#f3ece7" },
  { id: "lav", name: "lav", bg: "#170b0f", main: "#ff7b29", sub: "#8c626d", text: "#fceef2" },
  { id: "gece", name: "gece", bg: "#0f0b18", main: "#a855f7", sub: "#6c5b8b", text: "#ece6f7" },
  { id: "karbon", name: "karbon", bg: "#323437", main: "#e2b714", sub: "#646669", text: "#d1d0c5" },
  { id: "kagit", name: "kâğıt", bg: "#f4f0e8", main: "#d94617", sub: "#8f8474", text: "#241e1a" },
  { id: "nord", name: "nord", bg: "#2e3440", main: "#88c0d0", sub: "#616e88", text: "#d8dee9" },
  { id: "dracula", name: "dracula", bg: "#282a36", main: "#bd93f9", sub: "#6272a4", text: "#f8f8f2" },
  { id: "gruvbox", name: "gruvbox", bg: "#282828", main: "#d79921", sub: "#665c54", text: "#ebdbb2" },
  { id: "tokyo", name: "tokyo night", bg: "#1a1b26", main: "#7aa2f7", sub: "#565f89", text: "#c0caf5" },
  { id: "catppuccin", name: "catppuccin", bg: "#1e1e2e", main: "#cba6f7", sub: "#6c7086", text: "#cdd6f4" },
  { id: "cyberpunk", name: "cyberpunk", bg: "#0d0221", main: "#ff007f", sub: "#5c3c92", text: "#00ffcc" },
  { id: "matcha", name: "matcha", bg: "#1b241e", main: "#7bc96f", sub: "#576f60", text: "#dce7df" },
  { id: "okyanus", name: "okyanus", bg: "#0b192c", main: "#38bdf8", sub: "#4b6587", text: "#e2f1ff" },
  { id: "sakura", name: "sakura", bg: "#261822", main: "#f472b6", sub: "#7d566d", text: "#fae3ee" },
  { id: "terminal", name: "terminal", bg: "#090d0a", main: "#22c55e", sub: "#2c5e3b", text: "#a3f7b5" },
  { id: "solarized", name: "solarized", bg: "#002b36", main: "#b58900", sub: "#586e75", text: "#93a1a1" },
  { id: "buzul", name: "buzul", bg: "#eef2f6", main: "#0284c7", sub: "#64748b", text: "#0f172a" },
  { id: "retro", name: "retro 80s", bg: "#d8cbb5", main: "#d97706", sub: "#786b59", text: "#2b261f" }
];

export interface SoundInfo {
  id: SoundProfile;
  name: string;
  desc: string;
}

export const ALL_SOUND_INFOS: SoundInfo[] = [
  { id: "creams", name: "nk creams", desc: "Doğal yağlı lineer thock" },
  { id: "typewriter", name: "daktilo", desc: "Mekanik metal daktilo tuşu" },
  { id: "click", name: "click", desc: "Hafif ve çevik tıklama" },
  { id: "osu", name: "osu!", desc: "Tempolu ritim tuş hissi" },
  { id: "holy_panda", name: "holy panda", desc: "Derin ve tok tactile patlama" },
  { id: "mx_blue", name: "cherry mx blue", desc: "Yüksek sesli keskin klikli anahtar" },
  { id: "mx_brown", name: "cherry mx brown", desc: "Dengeli dokunsal hafif tactile" },
  { id: "mx_black", name: "cherry mx black", desc: "Ağır ve sessiz lineer basım" },
  { id: "topre", name: "topre 45g", desc: "Kapasitif elektro-kubbe damlası" },
  { id: "model_m", name: "ibm model m", desc: "Efsanevi buckling spring metalik yay" },
  { id: "pop", name: "pop kabarcık", desc: "Tatmin edici akustik baloncuk" },
  { id: "pentatonic", name: "pentatonik melodi", desc: "Her tuşta armonik müzikal ton" },
  { id: "hitmarker", name: "hitmarker", desc: "Taktik nişancı onay vuruşu" },
  { id: "beep", name: "8-bit terminal", desc: "Retro bilgisayar sinyali" },
  { id: "off", name: "kapalı", desc: "Sessiz mod" }
];

interface ThemeSoundPickerModalProps {
  initialTab: "themes" | "sounds";
  currentTheme: string;
  onSelectTheme: (t: string) => void;
  currentSound: SoundProfile;
  onSelectSound: (s: SoundProfile) => void;
  onClose: () => void;
  uiLang: UiLang;
}

export function ThemeSoundPickerModal({
  initialTab,
  currentTheme,
  onSelectTheme,
  currentSound,
  onSelectSound,
  onClose,
  uiLang
}: ThemeSoundPickerModalProps) {
  const [tab, setTab] = useState<"themes" | "sounds">(initialTab);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const t = UI_STRINGS[uiLang];

  useEffect(() => {
    inputRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const q = query.trim().toLowerCase();

  const filteredThemes = ALL_THEMES.filter(
    (th) => th.name.toLowerCase().includes(q) || th.id.toLowerCase().includes(q)
  );

  const filteredSounds = ALL_SOUND_INFOS.filter(
    (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q)
  );

  const handleSoundCardClick = (soundId: SoundProfile) => {
    onSelectSound(soundId);
    if (soundId !== "off") {
      soundEngine.playKey("press");
    }
  };

  return (
    <div className="picker-modal-overlay" onClick={onClose}>
      <div className="picker-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="picker-modal-header">
          <div className="picker-tabs">
            <button
              className={`picker-tab-btn ${tab === "themes" ? "active" : ""}`}
              onClick={() => {
                setTab("themes");
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              {t.pickerThemesTab} ({ALL_THEMES.length})
            </button>
            <button
              className={`picker-tab-btn ${tab === "sounds" ? "active" : ""}`}
              onClick={() => {
                setTab("sounds");
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              {t.pickerSoundsTab} ({ALL_SOUND_INFOS.length})
            </button>
          </div>
          <button className="text-btn" onClick={onClose}>
            {t.closeEsc}
          </button>
        </div>

        <div className="picker-search-container">
          <input
            ref={inputRef}
            type="text"
            className="picker-search-input"
            placeholder={t.pickerSearchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="picker-content-scroll">
          {tab === "themes" ? (
            filteredThemes.map((th) => {
              const isActive = currentTheme === th.id;
              return (
                <button
                  key={th.id}
                  className={`picker-theme-card ${isActive ? "active" : ""}`}
                  onClick={() => onSelectTheme(th.id)}
                >
                  <div className="picker-theme-card-top">
                    <span className="picker-theme-name">{th.name}</span>
                    {isActive && (
                      <span className="picker-theme-active-tag">{t.pickerActiveBadge}</span>
                    )}
                  </div>
                  <div className="picker-theme-swatches">
                    <span className="picker-swatch" style={{ background: th.bg }} title="bg" />
                    <span className="picker-swatch" style={{ background: th.main }} title="main" />
                    <span className="picker-swatch" style={{ background: th.sub }} title="sub" />
                    <span className="picker-swatch" style={{ background: th.text }} title="text" />
                  </div>
                </button>
              );
            })
          ) : (
            filteredSounds.map((s) => {
              const isActive = currentSound === s.id;
              return (
                <button
                  key={s.id}
                  className={`picker-sound-card ${isActive ? "active" : ""}`}
                  onClick={() => handleSoundCardClick(s.id)}
                >
                  <div className="picker-sound-name">
                    <span>{s.name}</span>
                    {isActive && (
                      <span className="picker-theme-active-tag">{t.pickerActiveBadge}</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
