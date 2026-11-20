// SPDX-License-Identifier: AGPL-3.0-or-later

export interface PersonalBestEntry {
  wpm: number;
  raw: number;
  acc: number;
  consistency: number;
  updatedAt: number;
}

const STORAGE_KEY = "erotype_pb_v1";

function loadMap(): Record<string, PersonalBestEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PersonalBestEntry>;
  } catch {
    return {};
  }
}

export function getModeKey(lang: string, mode: string, mode2: string | number): string {
  return `${lang}:${mode}:${mode2}`;
}

export function getPersonalBest(
  lang: string,
  mode: string,
  mode2: string | number
): PersonalBestEntry | null {
  const map = loadMap();
  return map[getModeKey(lang, mode, mode2)] ?? null;
}

export function recordResultForPb(
  lang: string,
  mode: string,
  mode2: string | number,
  entry: Omit<PersonalBestEntry, "updatedAt">
): { isNewBest: boolean; best: PersonalBestEntry } {
  const key = getModeKey(lang, mode, mode2);
  const map = loadMap();
  const prev = map[key];

  // Require at least 50% accuracy for a valid personal best
  if (entry.acc >= 50 && (!prev || entry.wpm > prev.wpm)) {
    const next: PersonalBestEntry = {
      ...entry,
      updatedAt: Date.now()
    };
    map[key] = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
      // Ignore storage quota errors
    }
    return { isNewBest: true, best: next };
  }

  return {
    isNewBest: false,
    best: prev ?? { ...entry, updatedAt: Date.now() }
  };
}
