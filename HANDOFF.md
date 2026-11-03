# Handoff: Family Car Booker

This is a working mobile-web prototype. It is not a store binary. Another developer can deploy it to the App Store and Google Play only after the Node server is hosted on HTTPS. The phone apps should be a wrapper around that hosted origin. Do not try to bundle this Next.js server inside the iOS or Android binary.

No application code was changed for this handoff.

## What the app does

Households with more drivers than cars share one browser link. Someone opens it, picks their name on that phone, and requests a car for a window of time, with a place and a reason. One or two admins approve, decline, or suggest another time from a second, private link. Everyone with the family link can see who has which car right now, see the week, and mark a car returned.

There are no installs and no accounts in the web app. The family link is the shared view. The approval link is the only way to approve, decline, or suggest a time. The family API never returns the approval token.

A labeled sample garage (the Chen family) is seeded on first database open. Those people and cars are fake. The demo board includes a preview of the approval link. A real household does not.

Times are wall-clock strings in the household timezone chosen at setup (the phone timezone). The demo household uses `America/Chicago`. Overlaps are flagged and can still be submitted. An admin sees the overlap before approving.

## Tech stack

- Next.js 16.4.5 (App Router, Turbopack) and React 19
- TypeScript
- Tailwind CSS 4 and shadcn/ui (`base-nova`, Base UI primitives, Lucide icons)
- Node.js 22 or newer. The database uses the built-in `node:sqlite` module (`DatabaseSync`). That module is not available on older Node.
- SQLite file at `data/garage.sqlite`, or the path in `GARAGE_DB`
- Tests: `tsx` and `node:test`
- No paid APIs, no auth provider, no push service, no third-party database

Important files:

- `lib/db.ts` — schema, queries, demo seed, decisions
- `lib/schedule.ts` — overlap and “who has it now”
- `lib/time.ts` — household wall-clock math
- `lib/demo.ts` — fixed ids for the labeled sample garage
- `app/api/**` — HTTP API
- `components/**` — screens

## Every screen

| Route | Screen | What a person can do |
|---|---|---|
| `/` | Start | Read the pitch. Go to setup or the demo garage. |
| `/setup` | Setup, three steps | Name the household. Add cars (name and a preset color). Add drivers and mark one or two admins. |
| `/setup` after create | Links | Copy the family link, copy a text to send, copy the approval link, open the garage. The approval link is not shown again on the family board. |
| `/h/[id]` | Now | See each car as Free, Out (“With Jake until 9:30 pm”), or Overdue. Pick who is using this phone (stored in `localStorage` only). Mark the current trip returned. See pending, suggested, and recent declined requests. On the demo only, reset sample bookings or open the approval link. |
| `/h/[id]/request` | Request | Pick a car or “Any free car”, date, start, end, where, and why. Conflicts render inline. Submit still works when there is an overlap; the button reads “Request anyway”. |
| `/h/[id]/week` | Week | One car at a time, Monday-start week. Approved, pending, suggested, and returned trips. Mark returned, cancel a future approved trip, download one `.ics` or the week. |
| `/a/[token]` | Approvals | Pending requests. Approve, decline (optional note), or suggest another time. If the request was “any car”, the admin picks the car. Copy the approval link again. |
| `/a/[token]/week` | Approval week | Same week view. Return and cancel call the family API. |
| `/demo` | Redirect | Sends the browser to the sample family board. |
| `/demo/admin` | Redirect | Sends the browser to the sample approval page. |

Bottom navigation on family pages: Now, Request, Week. On approval pages: Requests, Week, Now.

API (all `Cache-Control: no-store`, Node runtime):

- `POST /api/households` creates a household and returns the family id and approval token once.
- `GET /api/households/[id]` returns cars, drivers, bookings, and household-local `now`. It does not return the approval token.
- `POST /api/households/[id]/bookings` creates a pending request.
- `POST /api/households/[id]/bookings/[bookingId]` performs `return`, `cancel`, `accept-suggestion`, or `decline-suggestion`.
- `GET /api/households/[id]/calendar` and `GET /api/households/[id]/bookings/[bookingId]/calendar` download `.ics`.
- `GET /api/admin/[token]` is the approval payload and includes the token so the holder can copy the link.
- `POST /api/admin/[token]/bookings/[bookingId]` performs `approve`, `decline`, or `suggest`.
- `POST /api/demo/reset` rebuilds sample bookings only. It does not touch real households.

## Install, run, test, build

Requires Node.js 22 or newer and npm.

```bash
npm install
npm run dev
```

Dev server: `http://127.0.0.1:4317` (bound to `0.0.0.0`, port **4317** is hardcoded in `package.json`).

```bash
npm test
npm run lint
npm run build
npm start
```

`npm start` also listens on port 4317. A host that injects `PORT` will not be honored until the `start` script is changed. Do that before production hosting.

`npm test` uses a temporary sqlite file via `GARAGE_DB`. It does not need the dev server.

The first API call creates `data/garage.sqlite` and seeds the demo garage. That file is gitignored.

## Env vars and secrets

Names only. This prototype has no API keys and no `.env` file.

| Name | Required | Purpose |
|---|---|---|
| `GARAGE_DB` | No | Absolute or relative path of the sqlite file. Default is `data/garage.sqlite` under the process working directory. |
| `NODE_ENV` | Set by Next | `development` for `next dev`, `production` for `next start`. |
| `PORT` | Not read | Hosts often set this. The npm scripts ignore it and use 4317. |

There is no `DATABASE_URL`, no auth secret, and no payment key. Household approval tokens are random ids stored in sqlite, not in the environment. The sample garage’s ids are constants in `lib/demo.ts` (`DEMO_HOUSEHOLD_ID`, `DEMO_ADMIN_TOKEN`). Treat the demo approval id as public, because it ships in the source and `/demo/admin` redirects to it. Remove or disable `/demo` and `/demo/admin` before a public store launch so reviewers and strangers are not handed a live approval page on a production database.

Do not commit `.env`, `*.pem`, or `data/*.sqlite`.

## Stubbed or missing

Nothing on the click path is a fake button. Approve, decline, suggest-another-time, accept suggestion, conflict warnings, week view, mark returned, copy-a-text, and `.ics` export all run against sqlite.

Not built, and not stubbed in the UI:

- Mileage, fuel, or cost splitting
- GPS or key handoff
- Push notifications or email
- Editing or deleting cars and drivers after setup
- More than two admins
- Accounts, passwords, or recovery if the approval link is lost
- A production host, custom domain, or HTTPS terminator
- Store icons, splash screens, a web app manifest, privacy policy page, or native project

Also know:

- `node:sqlite` is still marked experimental by Node. One Node process holds the file. More than one server instance will corrupt or lock the file unless you replace sqlite first.
- Suggest-another-time stores a proposal. The requester accepts it, or the admin approves the suggested time or the original time.
- “Any free car” stays unassigned until an admin picks a car at approval.

## Ship it to the App Store and Google Play

Do these in order. Hosting comes before either store.

### 1. Host the backend first

The screens call same-origin `/api/*`. Capacitor cannot ship this repository as an offline bundle.

1. Choose a Node 22 host with a persistent disk. A small VM or a container with a volume is enough. Do not use a stateless serverless platform while the database is a sqlite file.
2. Put the repo on the host. `npm ci`, then `npm run build`.
3. Point `GARAGE_DB` at a path on the volume, for example a mounted data directory.
4. Change the start command so it listens on the host’s `PORT` (today it is fixed at 4317).
5. Put HTTPS in front of it. Family and approval links are built from `window.location.origin`, so the public origin must be the final `https://` host. Links created on `http://127.0.0.1:4317` will not work for other people.
6. Open `/`, create a throwaway household, approve a request, and restart the process. The sqlite file must still be there after the restart.
7. Decide whether the Chen demo stays. For a store build, disable `/demo` and `/demo/admin` or point them at a database you can reset. Otherwise anyone can approve sample bookings, and if you ever pointed demo at real data that would be a real approval link in the app binary’s source.

You do not need Redis, an auth vendor, or a secret manager for the current code.

### 2. Wrap the hosted site

Use Capacitor for both stores. The native app is a shell. The UI stays this Next app.

Suggested ids (change them if the name is taken; use the same id on both stores):

- iOS bundle id: `com.familycarbooker.app`
- Android applicationId: `com.familycarbooker.app`
- Display name: `Family Car Booker`
- URL schemes: not required for v1

In a **separate** native wrapper directory (do not replace this web app):

1. `npm init` and install `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`, and `@capacitor/assets`.
2. `npx cap init "Family Car Booker" com.familycarbooker.app`.
3. In `capacitor.config.ts` set `server.url` to the hosted origin (`https://…`) and `server.cleartext` to `false`. Set `webDir` to a tiny `www/` folder whose only job is an offline page: “Family Car Booker needs a connection to load the garage.”
4. `npx cap add ios` and `npx cap add android`.
5. `npx cap sync` after any native config change. Web UI changes do not need a store release while `server.url` points at the host.

Android alternative: a Trusted Web Activity (Bubblewrap / PWABuilder) after you add a Web App Manifest. This repo does not have one yet. Capacitor is the single path that covers both stores without that manifest. Apple still reviews the binary; a TWA does not replace the iOS app.

Apple guideline 4.2: a bare WebView of a marketing site is often rejected. This product is the whole utility, not a teaser, but the binary is still a shell. In the App Review notes, say there is no account, and tell the reviewer to open the app and use the in-app demo or a household you created on the production host. Adding a native share sheet for the family link makes the shell less empty. Do not add GPS permissions to look more native.

### 3. Icons and splash

What exists today is not a store icon set:

- `app/icon.svg` — simple mark on a dark rounded square
- `app/favicon.ico`
- Theme color in the web app is the warm paper background `#f3efe6`

Generate store assets from one 1024×1024 PNG (no transparency for the App Store marketing icon) and a splash source:

- iOS: Xcode `AppIcon` set, including the 1024 marketing icon
- Android: adaptive icon foreground and background, plus the 512 Play listing icon
- Splash: paper background `#f3efe6`, the mark, and the words “Who has the car?”
- `@capacitor/assets` can emit the Capacitor sizes from those two sources

Do not use the Next.js or Vercel marks. They are not part of this product.

### 4. Privacy policy and store listing

Publish a privacy policy at a public HTTPS URL before either submission. The policy should say, in plain language:

- The operator stores household name, timezone, car names and colors, driver names, who is an admin, and booking place, reason, and times.
- The app does not ask for an account, location, contacts, camera, or microphone.
- The phone only remembers the chosen driver name in local storage.
- Anyone with the family link can see that garage and request or mark returned. Anyone with the approval link can approve.
- Data sits in the operator’s sqlite file until the operator deletes it. It is not sold.
- The product is for families with teen drivers. Do not list it in the Kids category. Age rating should assume user-entered text (where and why). If you cannot support under-13 users, say the app is not directed at children under 13.

Also publish a support URL (even a single page with an email) and a marketing URL (the hosted `/` page is enough).

Listing copy you can start from:

- Name: Family Car Booker
- Subtitle: Who has the car
- Short description: Kids request a car. A parent approves. Everyone sees who has the keys.
- Keywords: family car, teen driver, car sharing, household
- Review notes: no demo login. Describe the tap path: open app, try the demo or the household you seeded, pick a driver, request, then open the approval link you include in the notes.

Store screenshots: 6.7-inch and 6.1-inch iPhone, and a phone screenshot set for Play. Capture setup links, the Now board, a conflict warning, approvals, and the week view. The prototype screenshots from the web click path are the right content; recapture them on the hosted domain so the status bar and URL look like the shipping app.

Forms:

- Apple export compliance: standard HTTPS only, no custom cryptography.
- Google Play Data safety: user names and user-generated booking text are stored on your server for app functionality, not shared with third parties, not sold.
- Content rating: user-generated text, no unrestricted web browser if the WebView stays on your origin. Lock navigation to your host in the wrapper so a reviewer cannot treat it as a general browser.

### 5. Release checklist

1. Production host is HTTPS, sqlite survives a restart, and `PORT` is honored.
2. Demo approval route is removed or isolated from real households.
3. Create a real household on production and save the approval link outside the app.
4. Capacitor `server.url` is that origin. Cleartext HTTP is off.
5. Icons and splash are in both native projects. Bundle id matches the store records.
6. Privacy policy URL, support URL, and review notes are filled in.
7. iOS: archive in Xcode, upload with App Store Connect, add the privacy policy and screenshots, submit.
8. Android: build an AAB (`./gradlew bundleRelease`), create the Play app with the same application id, complete Data safety, upload an internal-testing track first, then production.
9. Smoke on a physical phone: setup, family link, conflict warning, approve, week, mark returned, airplane mode shows the offline fallback instead of a blank WebView.

After that, web fixes ship by deploying the Node app. Native fixes (icons, bundle id, splash, the offline page) need a new store build.
