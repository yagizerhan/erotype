# Third-Party Notices

EroType is licensed under the **GNU Affero General Public License v3.0** (see [LICENSE](LICENSE)).
It includes or builds upon the following third-party material, used in accordance with their licenses.

## 1. Sound samples and colour palette — Monkeytype

- **Project:** Monkeytype — https://github.com/monkeytypegame/monkeytype
- **License:** GPL-3.0
- The keyboard sound samples in `public/sounds/` — `creams/`, `click/`, `typewriter/`, `osu/` and `error.wav` —
  are taken from the Monkeytype repository (`frontend/static/sounds/`). Section 13 of the GPL-3.0 permits
  combining GPL-3.0 material with AGPL-3.0 code; these files remain under GPL-3.0.
- The `karbon` theme's dark grey / yellow palette (`#323437` / `#e2b714`) is inspired by Monkeytype's
  *Serika Dark* theme.
- No Monkeytype source code, quote data, name or logo is used. "Monkeytype" and its logo belong to their
  respective owners.

## 2. Word lists and quotes

Each language pack records the source and license of its data in `meta.json`, and every entry in `quotes.json`
has its own `source` and `license` fields.

- **Word lists** (`data/languages/{tr,en}/words-1k.json`) are derived from Hermit Dave's
  **FrequencyWords** (https://github.com/hermitdave/FrequencyWords), based on the OpenSubtitles 2018 frequency
  lists (`tr_50k.txt`, `en_50k.txt`). License: **CC BY-SA 4.0** (https://creativecommons.org/licenses/by-sa/4.0/).
  Changes: the first 1,000 suitable words were kept; words with non-letter characters, outside 2–12 letters,
  proper nouns, profanity, misspellings and subtitle fragments were removed by hand; text was NFC-normalised.
  The derived lists are likewise licensed under **CC BY-SA 4.0**.
- **Turkish quotes** (`data/languages/tr/quotes.json`): `tr-0001`–`tr-0005` are original texts written for this
  project (**CC0-1.0**). The rest are short excerpts from stories by **Ömer Seyfettin** (d. 1920) — *Kaşağı*,
  *Kesik Bıyık*, *Forsa*, *Diyet*, *Elma*, *Pireler*, *Havyar*, *Korkunç Bir Ceza* — which are in the **public
  domain** under Article 27 of Turkish Law No. 5846. Texts were taken from Turkish Wikisource
  (https://tr.wikisource.org); only typographic characters were adjusted so they can be typed on a keyboard.
- **English quotes** (`data/languages/en/quotes.json`): `en-0001`–`en-0004` are original texts written for this
  project (**CC0-1.0**). The rest are short excerpts from public-domain books on **Project Gutenberg**
  (https://www.gutenberg.org): Jane Austen, *Pride and Prejudice* (#1342); Arthur Conan Doyle, *The Adventures of
  Sherlock Holmes* (#1661); Lewis Carroll, *Alice's Adventures in Wonderland* (#11); Mary Shelley, *Frankenstein*
  (#84). Only the public-domain text is used — not the Project Gutenberg license or trademark.

## 3. Fonts and libraries

| Component | License |
| --- | --- |
| JetBrains Mono | SIL Open Font License 1.1 |
| Inter | SIL Open Font License 1.1 |
| React & React DOM | MIT |
| Hono | MIT |
| Drizzle ORM | Apache-2.0 |
| Better Auth | MIT |

Fonts are loaded from Google Fonts at runtime and are not redistributed in this repository. Full license texts of
npm dependencies are included in their packages under `node_modules/`.
