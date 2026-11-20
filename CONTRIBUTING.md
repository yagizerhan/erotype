# Contributing to EroType

Thanks for your interest in improving EroType! Bug reports, ideas and pull requests are all welcome.

## Before you start

- **Bugs:** open an issue with steps to reproduce, what you expected and what happened (browser + OS help a lot).
- **Features / larger changes:** please open an issue first so we can agree on the approach before you spend
  time on it.
- **Security issues:** please do **not** open a public issue — see [SECURITY.md](SECURITY.md).

## Development setup

```bash
npm install
cp .dev.vars.example .dev.vars   # optional on localhost
npm run dev                      # http://localhost:5173
```

Before opening a pull request, make sure both of these pass:

```bash
npm test
npm run build
```

## Design principles

Please keep these in mind — changes that break them are unlikely to be merged without discussion:

1. **The server is authoritative.** Race text, start time, progress validation and rankings are decided on the
   server. Solo scores are recomputed server-side too. The client only handles the local typing experience.
2. **One Durable Object per room.** The room id is the Durable Object name.
3. **WebSocket + JSON protocol**, defined in `src/shared/protocol.ts`. If you change the message schema, bump
   `PROTOCOL_VERSION` in `src/shared/constants.ts`.
4. **Word-level progress.** Clients send one message per completed word — never per keystroke.
5. **Hibernation-friendly.** Use the WebSocket Hibernation API and Durable Object alarms instead of `setTimeout`.
6. **Pure game logic.** Code in `src/shared/` and `src/server/game/` must not depend on Cloudflare APIs, so it can
   be unit-tested.
7. **No React re-render per keystroke.** The typing engine (`src/client/typing/`) and race animation are plain
   TypeScript outside React.
8. **Data-driven languages.** New languages are added as `data/languages/<code>/` packs, and UI strings live in
   `src/client/i18n.ts` — don't hard-code user-facing text.

### Text handling

- Normalise Turkish text to Unicode **NFC**.
- Compare characters exactly. Do not use `toLocaleLowerCase` for comparisons — `i / İ / ı / I` behave differently
  in Turkish.

### Adding words or quotes

Every quote needs a `source` and a `license`. Only add text that is public domain, openly licensed (and compatible
with redistribution) or written by you. Update [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) when you add a new
source.

## Pull requests

- Keep pull requests focused on one change; add or update tests where it makes sense.
- Write code comments and commit messages in English.
- Do not commit secrets. Local secrets belong in `.dev.vars`, which is git-ignored.

### Developer Certificate of Origin (DCO)

By contributing you certify that you wrote the change or otherwise have the right to submit it under the
project's license, as described in the [Developer Certificate of Origin 1.1](https://developercertificate.org/).
Sign off every commit by adding `-s`:

```bash
git commit -s -m "Fix caret position after backspace"
```

This adds a `Signed-off-by: Your Name <you@example.com>` line to the commit message.

## License

By contributing, you agree that your contributions are licensed under the
[GNU Affero General Public License v3.0](LICENSE) or later.
