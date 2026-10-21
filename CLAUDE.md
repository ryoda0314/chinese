@AGENTS.md

# ことのおと

Read [CONCEPT.md](CONCEPT.md) before adding anything. A feature that does not fit the rain
(聞き比べる → 聞き分ける → 文の中で → 言ってみる → また出会う) does not get built. No scores, no accuracy shown,
no streaks, no badges, no forced review, no tone theory up front. The sister app is ことのあめ
(`../../polylinga`); this one borrows its philosophy, its look, its Chinese sentences and their audio.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, plain CSS modules. Same versions as ことのあめ.
- The learner's record (`State`, `src/lib/rain-core.ts`) is on their device (`src/lib/store.ts`, localStorage, every
  access guarded); signing in is optional. With a ことのあめ account (the same Supabase project, so the same accounts:
  email + password, or Google through ことのあめ's own OAuth client) it is also kept in `kn_records`, one row per account
  (`supabase/migrations/`, RLS: only their own row), read and written from the browser as the learner with the anon key
  (`src/lib/sync.ts`). The two copies are merged, never overwritten (`mergeStates`): on the first rain and on 自分, and a
  moment after every save (merged again with what another device may have written). No server code touches it and the
  service-role key is not used at run time. Everything of ことのおと's in that project is prefixed `kn_` (from its first name,
  ことのね, as are the keys it saves on the device, `kotonone:*`: renaming them would lose records already kept); never touch
  ことのあめ's `pl_` tables or the old app's (a trigger on `auth.users` writes the old app's rows: do not create test
  users there). Making an account and resetting a password happen in ことのあめ (`NEXT_PUBLIC_KOTONOAME_URL`).
  The data the app reads is static JSON in `public/data`, built from `data/` by scripts.
- One server route, `/api/hear` (`src/app/api/hear/route.ts`): what a learner's attempt sounds like, through OpenAI
  `gpt-4o-transcribe` (`HEAR_MODEL` to change). The prompt says only that it is one Mandarin word, never which. Limited
  by size (5 s of 16 kHz WAV), per address and per server instance; the audio is not kept.
- Pitch is measured on the device, never on a server (`src/lib/pitch.ts`), with the same code that checks the generated
  clips, so a model line and a learner's line are drawn the same way.

## The sound core (`src/lib`, pure, tested in `tests/`)

- `pitch.ts`: pitch every 10 ms. Normalized cross-correlation over a 12.5 ms window (RAPT-like; YIN lost fast, fading
  fourth tones), every candidate period kept, then the cheapest path (octave jumps cost, as in Praat). Then: leaps over
  5 semitones split a run, short runs dropped, short runs far above the main one dropped (a hiss read as 500 Hz), blips
  far from both neighbours dropped. `rangeForVoice` (De Looze & Hirst: 0.75×Q1 to 1.5×Q3) for a second pass within a
  known voice. Checked against Praat on the probe clips: median error 0.11 semitones, 90th percentile 0.5, 94% voicing
  agreement (`scripts/work` held the comparison; Praat itself is not a dependency).
- `tone.ts`: lines on Chao's five levels. `rangeFromTones` sets a voice's levels from its first tones (4.6) and the
  bottom of its third tones (1.1), steadier than the spread of all frames. `lineOf` draws 40 points over the voiced
  span. `lineDistance` (DTW within 15%, half a level of offset) compares two lines; it is what judges both the clips and
  the learner. The hand-made tone shapes (`distance`, `judgeTones`) are only a second opinion: they miss real speech
  (a second tone after a fourth starts low and rises late).
- `pinyin-core.ts`: syllables into initial, final (spelling undone: yu → ü, ui → uei, zhi → -i) and tone; tone sandhi
  (3-3, 不, 一); `classifyPair` says what kind of minimal pair two words are, comparing tones as said (买马/埋马 is not one).
- `vowel.ts`: how far forward a vowel is (energy 1.45–3.3 kHz over 0.2–1.15 kHz, dB, middle of the voiced part): u
  sits around −32 to −53 dB, ü around −2 to −17 in the four voices. It decides u against ü where u or ü is the vowel
  itself (路/绿, 女/努, 鱼/无), because speech recognizers swap the two in single syllables, consistently (路 heard as
  绿 and 绿 as 路 in every voice, while Praat's F2 shows the clips were right). Glides (玩 wán, 圆 yuán) are too short to
  measure and the recognizer tells those apart.
- `learner.ts`: a learner's levels from their own recordings (each recording's middle, moved by how high the word sits
  for the model voices), the model voice nearest them, and `nearer`: which of two words a line is closer to, against
  every model voice (median). Held-out check on all the data: each model voice treated as a learner with one recording
  is put nearer the right word 1199 times in 1216 (7 wrong, 10 undecided, most of them 2声/3声); for u/ü by the vowel's
  frontness, 47 in 47.
- `log-core.ts`: what the learner did, for looking back (`State.log`): each rain (when, difference, pairs asked and
  mixed up) and each word said (its line, which word it was nearer, what it was heard as; never the recording).
  Bounded (`RAINS_KEPT`; per word its first line and its latest, `SAID_KEPT` in all) so the record stays small in
  `kn_records`; merged by entry with `mergeStates`. Days are Japan days. `export.ts`: the whole record as one Markdown
  text for an AI of the learner's choice (学習の記録); no AI call. `pairs-file.ts`: reading and changing
  `data/pairs.txt` for the admin (a removed pair is commented out `#外した`, its meaning moved on; a new pair is checked
  to be a real pair of its difference).
- `rain-core.ts`: which difference falls next (pairs due back first, then new ones in `ORDER`, then the least well
  heard), the pairs of a rain, the order of 聞き分ける, what an answer leaves behind. A mixed-up pair is owed and comes
  back after `RETURN_DAYS` or `RETURN_RAINS`; the day a once-mixed difference reaches `SPLIT` is kept (`splitAt`),
  shown once and on 自分. `heard` (a running average) is never shown.

## The app

- `/` intro (static). `/app` the rain (`src/app/app/_rain/`): `Rain.tsx` runs it, with `Steps` on top (the steps on a
  track with an icon each: done ones checked in the accent, this one lit, those ahead faint; 文の中で only when there are
  sentences); `Compare` (pairs fall, each word said
  in turn, a voice per pair; pressing a word settles them and says it in the next voice), `Tell` (12 questions, the answer
  at once with both lines in that voice; right answers move on after 1.6 s, wrong ones wait), `Reveal` (the difference's
  name and how it is made, only now; owed pairs in the again violet), `Sentences` (ことのあめ sentences with the word lit,
  its clip played from ことのあめ's public `pl-audio` bucket), `Say` (record → line over the model → `nearer` for tone
  pairs → `/api/hear`; for u/ü words the vowel's frontness against the nearest voice instead, and the recognizer is not
  shown). Each rain's end and each attempt are written to the log.
- `/app/me` 自分 (looking back, `src/app/app/me/`, all client-side from the record, `useRecord` merges with the account):
  これまで (own counts, never compared) and three views: 日ごと (rains, pairs mixed up, words said, per Japan day),
  違いごと → `/app/me/d/[id]` (how it is made, the days it fell, its pairs as met: still owed, mixed before, never
  mixed, and the not-yet-met folded away), 言ってみた → `/app/me/w/[id]` (the first line and the latest over the model
  and the partner, every attempt, and SayCard to say it again). `/app/me/export` 学習の記録, `/app/me/settings`
  記録とアカウント (account, what is kept, forget the lines, clear the record). No scores or rates anywhere: counts of
  times met and mixed up are the learner's own history.
- `/admin` (the maker's side, `src/app/admin/`, `src/lib/admin.ts`): only under `npm run dev` (`assertDev`; 404 in a
  build), because the content is files in this repository and the raw takes are on this machine. 概要 (counts, what
  waits, and the pipeline as buttons run one at a time with their log: 音声の合否を反映, 語の組を反映, 足りない音声を作る,
  ことのあめの例文を取り直す), 確認待ちの音声 (each take as the app would play it, beside the other voices: これを使う →
  `data/approved.json`, どれも使わない → `data/dismissed.json`), 語の組 (every pair with its voices, whether it is in
  the app, its sentences; 外す, 足す, 意味を直す, all in `data/pairs.txt`). Its file paths carry
  `/*turbopackIgnore: true*/` so a build does not trace the whole project.
- `/login` (`src/app/login/`): ことのあめのアカウントでつなぐ. Email and password; Google only when
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set, which needs this app's addresses among that client's authorized JavaScript
  origins in Google Cloud (Google refuses the button otherwise). Accounts made with Google only set a password in
  ことのあめ (パスワードを忘れた) to sign in here with email. 自分 shows the account, ログアウト, and 記録を消す (the
  account's copy too when signed in).
- `src/components/player.ts`: Web Audio, decoded ahead, one sound at a time by generation number. Every play wakes a
  held context (suspended, or iOS's interrupted) while still inside the tap; a clip whose context never runs gives up
  after its length + 1.5 s; after the microphone the next sound gets a new context (`holdForMicrophone`, called by the
  recorder); on Safari 17+ `navigator.audioSession` is playback (heard with the ringer switch off, as ことのあめ's
  `<audio>` is) and play-and-record while recording.
  `recorder.ts`: AudioWorklet (`public/worklets/recorder.js`), no noise suppression (it bends pitch), stops itself 700 ms
  after the voice stops, 16 kHz WAV copy for `/api/hear`.

## Data and audio (scripts)

- `data/pairs.txt` is the source: hand-written minimal pairs by difference (`## t23` …). `scripts/check-data.mjs` checks
  every pair is the kind its family says (after sandhi), that the pinyin agrees with pinyin-pro (or is in `AGREED`
  after a person checked it), and that a word means the same everywhere; it writes `data/words.json`,
  `data/families.json`. Ids are pinyin with tone numbers plus 4 hex of the characters: stable, never renumbered.
  Avoid characters with two common readings when they stand alone (it warns).
- `scripts/generate-audio.mjs`: Gemini TTS on Vertex (Flash; Pro is ことのあめ's live quota), voices Kore, Erinome (f),
  Charon, Iapetus (m), prompt 「用标准普通话，清楚自然地读一遍这个词：」 (chosen in `scripts/probe-tts.mjs`). Each clip is
  trimmed and levelled (`scripts/lib/wav.mjs`), tracked twice (wide, then the voice's range), and passes only if:
  the recognizer hears its syllables and not its partner (a miss is asked again naming both words, in both orders:
  it leans toward the commoner word, 陈旧 heard as 成就), and its line is nearer the same word in the other voices than
  its tone partners by `X_MARGIN`, and not far from the other voices (`MAX_SAME`, about the farthest 2%). Where the
  recognizer is known to be wrong the clip's sound decides: a line clearly nearer its own word (`STRONG_X`) outweighs a
  tone partner heard (迷 as 米, 埋 as 买); u/ü vowels by frontness against the voice's own u and ü; an added 儿 (哪 as
  哪儿) is taken off. Up to 3 takes, then `data/review.json` for a person: `node scripts/review-page.mjs` writes
  `public/review/index.html` (dev server) to listen; approved takes go in `data/approved.json`. First full run:
  1622 of 1648 clips pass (98.4%), 26 wait for a person (mostly -n/-ng, aspiration and retroflex pairs the recognizer
  hears as their partner), all 292 pairs in the app with 2+ voices each. Resumable: raw takes stay in `scripts/work/raw` (not committed); ASR answers are
  cached in `data/asr.json`; state in `data/clips.json`.
- `scripts/publish-audio.mjs`: passing takes → `public/audio/<voice>/<id>.mp3` (48 kbps). Reads `data/` only.
- `scripts/export-sentences.mjs` (with ことのあめ's env): approved sentences where the word appears with the same
  reading, tones and all → `data/sentences.json`, keeping only those whose clip exists.
- `scripts/build-data.mjs`: `public/data/index.json` and `public/data/f/<family>.json` (pairs whose two words have
  passing clips in 2+ voices), and `src/lib/readings.json` for `/api/hear` (ことのあめ's `pinyin-words.json` fixes plus
  this app's own multi-character words).

## Commands

- `npm run dev` / `npm run build` / `npm run lint` / `npm test` (node:test, `tests/*.test.mjs`)
- `npx tsc --noEmit` (run `npx next typegen` first after adding routes)
- `node scripts/check-data.mjs [--dry-run]` after editing `data/pairs.txt`
- `node --env-file=.env.local scripts/generate-audio.mjs [--voices=kore,charon] [--limit=40] [--no-generate]`
- `node scripts/publish-audio.mjs && node scripts/build-data.mjs`
- `node --env-file=../../polylinga/.env.local scripts/export-sentences.mjs`
- `node --env-file=../../polylinga/.env.local ../../polylinga/scripts/migrate.mjs supabase/migrations/<file>.sql`: apply
  one migration to ことのあめ's database, in a transaction (ことのあめ's runner and connection settings).

## Conventions

- UI copy in `src/lib/i18n/ja.ts`, plain, from the learner's side. Difference names and how-it-is-made hints live
  there too and appear only after listening.
- Colors and type are ことのあめ's (`src/app/globals.css` is its file): paper, ink, one accent, `--again` violet for
  what comes back. No gradients, emoji or shadows; hairlines separate. Lines: model ink, learner accent, the other word
  faint and dashed.
- Pure modules imported by tests and scripts use `.ts` extensions in their imports (Node strips types).
- Phone first; from 720 px the tabs become a column on the left (BottomNav, the same CSS as ことのあめ).
- The app icon is the one picture with gradients: a generated image the maker chose (`design/icon-source-chatgpt.png`).
  `python design/make-icons.py design/icon-source-chatgpt.png .` (Pillow, numpy) cuts its card out and writes
  `public/icons/` (transparent corners; maskable on a full square), `src/app/icon.png`, `apple-icon.png`,
  `favicon.ico`. `Logo` shows `icon-192.png`.
