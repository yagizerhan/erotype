// SPDX-License-Identifier: AGPL-3.0-or-later
// Data integrity checks for language packs.
import { describe, expect, it } from "vitest";
import trWords from "../../data/languages/tr/words-1k.json";
import enWords from "../../data/languages/en/words-1k.json";
import trQuotes from "../../data/languages/tr/quotes.json";
import enQuotes from "../../data/languages/en/quotes.json";

const packs = {
  tr: { words: trWords as string[], quotes: trQuotes, letters: /^[abcçdefgğhıijklmnoöprsştuüvyzâîû]+$/ },
  en: { words: enWords as string[], quotes: enQuotes, letters: /^[a-z]+$/ }
};

for (const [lang, p] of Object.entries(packs)) {
  describe(`${lang} language pack`, () => {
    it("has 1000 unique, NFC-normalized, letters-only words", () => {
      expect(p.words).toHaveLength(1000);
      expect(new Set(p.words).size).toBe(1000);
      for (const w of p.words) {
        expect(w).toBe(w.normalize("NFC"));
        expect(w).toMatch(p.letters);
      }
    });

    it("every quote has id, source, license and keyboard-typeable text", () => {
      const ids = new Set<string>();
      for (const q of p.quotes) {
        expect(q.id.startsWith(`${lang}-`)).toBe(true);
        expect(ids.has(q.id)).toBe(false);
        ids.add(q.id);
        expect(q.lang).toBe(lang);
        expect(q.source.length).toBeGreaterThan(3);
        expect(q.license.length).toBeGreaterThan(3);
        expect(q.text).toBe(q.text.normalize("NFC"));
        expect(q.text).not.toMatch(/\s{2}|[‘’“”…–—]/);
      }
    });
  });
}
