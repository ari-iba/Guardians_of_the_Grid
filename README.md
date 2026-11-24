# Guardians of the Grid
Jullie bouwen een mission control center om Achrona te beschermen tegen The Desync. 
Dit  fungeert als de ultieme digitale levenslijn door vitale statistieken live in 
kaart te brengen en afwijkingen vroegtijdig te signaleren. Dankzij jullie realtime 
data-inzichten kunnen we op tijd ingrijpen om de glitches te stoppen en de magie 
in Achrona te redden

## Features

**Basis**
- **Login met rollen** — `defender` en `commander`. Wachtwoorden gehasht met scrypt (`node:crypto`), sessie in een HMAC-ondertekende, HttpOnly cookie (bevat enkel het guardian-id). Niet ingelogd → automatisch naar `/login`. Na het inloggen speelt eenmaal per sessie een korte boot-animatie (overslaan met klik of `Esc`).
- **Glitch-overzicht** — status-badges (LEAKED rood, ASSESSING oranje, CONTAINING blauw, FIXED groen), district, aantal echoes en toegewezen defender. Klik een rij voor details.
- **Echo melden** — kies een district; elke nieuwe echo opent een nieuwe glitch (`LEAKED`). Op de detailpagina voeg je een echo toe als update. Echoes inspreken kan met de **Speak**-knop (Web Speech API, enkel zichtbaar als je browser het ondersteunt).
- **Detailpagina** — lifecycle-stepper met "time in status" en een tijdlijn van alle echoes, inclusief de audit-log van het systeem.

**Workflow-engine** (`src/lib/workflow.ts`, regels in `src/lib/workflow-rules.ts`)

Alle statuswijzigingen lopen via één functie `transitionGlitch(glitchId, event, actor)`. Elke wijziging schrijft een audit-echo van guardian `SYSTEM` (bv. *"Status LEAKED → ASSESSING: assigned to ember by nova"*).

| Event | Wanneer | Resultaat |
| --- | --- | --- |
| `ASSIGNED` | commander wijst een defender toe | LEAKED → ASSESSING; anders enkel nieuwe assignee |
| `UNASSIGNED` | commander verwijdert de toewijzing | ASSESSING → LEAKED |
| `UPDATE_ECHO` | toegewezen defender (of commander) post een echo | ASSESSING → CONTAINING |
| `RESOLVED` | "Mark as fixed" / "Fix" | CONTAINING → FIXED |
| `NEW_ECHO_ON_FIXED` | iemand meldt een echo op een FIXED glitch | heropend → LEAKED, of ASSESSING als er een assignee is |
| `MANUAL_OVERRIDE` | enkel commander, met verplichte reden | gekozen status |

Ongeldige overgangen (bv. LEAKED → FIXED zonder override) worden op de server geweigerd. De UI toont enkel de knoppen die volgens de regels kunnen; na een wijziging schuift de badge geanimeerd en verschijnt een toast. Alle rechten worden **op de server** gecontroleerd. `npm run test:workflow` test alle overgangen (ook de geweigerde) plus een integratietest op een tijdelijke SQLite-database.

**The Desync Engine** (`src/lib/desync.ts`, pagina `/sensors`)
- Elk district heeft drie sensoren (`magic`, `time_stability`, `portal_flux`) die een random walk rond een normaal niveau maken. De live-poll roept `tickSensors()` aan; de server begrenst dat tot één tick per 5 s, ook met meerdere tabbladen open.
- Automatische glitches (🤖, reporter `SYSTEM`, bron `auto`): sensor **onder 25**, **snelle daling** (> 30 punten binnen 5 metingen), **echo-cluster** (≥ 3 guardians melden binnen 2 min in hetzelfde district → gebundeld onder één glitch) en spontane **Desync-events** (± 1 per 2–3 min, commander-toggle "Auto-Desync").
- Geen dubbele auto-glitch per district + metric: er komt een echo bij (max. 1 per minuut).
- Optioneel **auto-assign** aan de defender met de minste open glitches (via `transitionGlitch`, dus meteen ASSESSING).
- Een auto-glitch op FIXED zetten herstelt de sensoren van dat district.
- Commander-knoppen **Simulate attack** (2–3 districten crashen) en **Reset simulation**. De sensorpagina toont live lijngrafieken met een rode zone onder de drempel en 🤖-markers op het moment dat een glitch automatisch ontstond.

**Mission control**
- **Magic in Achrona-meter** — halve-cirkel-gauge (eigen SVG). `100 − (LEAKED×15 + ASSESSING×10 + CONTAINING×5)`, begrensd op 0–100, van groen via oranje naar rood.
- **Lockdown mode** — bij < 40% magie of ≥ 3 LEAKED glitches: rode banner, rood accent in de hele UI en een pulserende rand.
- **Kaart van Achrona** (`/map`, sneltoets `m`) — zie hieronder. Op het overzicht staat een mini-map met "Open map →".
- **Timeline replay** — slider "last 60 min" onder de kaart: sleep om de toestand op elk moment te zien (gereconstrueerd uit de audit-log), of druk play voor 10× snelheid.
- **Live updates** — elke 5 s verversen (gepauzeerd als het tabblad verborgen is), "updated Xs ago" en nieuwe glitches lichten kort op.
- **Glitch-effect** — een nieuwe glitch geeft 600 ms RGB-split, scanlines en een lichte shake, plus een toast "⚠ New glitch in …". Optioneel geluid (Web Audio, zelf gegenereerd, standaard uit; luidspreker-icoon in de bovenbalk).
- **Repair-animatie** — wordt een glitch FIXED, dan vliegen magische deeltjes van de glitch naar de meter, de naald animeert naar de nieuwe waarde en er volgt een sparkle-burst.
- **Zoeken / filteren / sorteren** — op beschrijving of id, per status, district, "Assigned to me", sorteren op datum of urgentie. Staat in de URL, dus deelbaar.
- **Leaderboard** (`/leaderboard`) — defenders gerangschikt op aantal FIXED glitches, met podium en automatische badges (👑 Top Guardian, 🔧 First Fix, 🎩 Hat-trick, 🛡️ Grid Guardian, 🤖 Bot Buster, ⚡ Speedrunner, 📡 Field Reporter).
- **Command palette** — `Ctrl+K` / `⌘K`: navigeren, echo melden, thema/geluid, commander-acties en zoeken in alle glitches.
- **Dark / light mode** — onthouden in `localStorage`, zonder flits bij het laden.
- **Sneltoetsen** — `j`/`k` volgende/vorige glitch, `Enter` openen, `n` nieuwe echo, `/` zoeken, `g` overzicht, `m` kaart, `s` sensoren, `l` leaderboard, `t` thema, `q` quests, `Shift+R` demo-rolwissel, `?` overzicht van alle sneltoetsen. Niet actief tijdens het typen.
- **Responsive** — op een smartphone wordt de sidebar een bovenbalk en de tabel een lijst met kaarten.
- Alle animaties respecteren `prefers-reduced-motion`.

### Game-laag: Guardians of the Grid als game

De app speelt als een tactisch RPG-dashboard, maar elke game-term toont bij hover wat hij echt betekent. De workflow-regels en serverrechten zijn niet veranderd: de game-laag leest enkel bestaande data.

- **Stijl** — *neon arcade × fantasy*: nachtelijke sterrenhemel met raster, neon cyaan/magenta/goud en glas-panelen met gloeiende randen. Light mode = *dag in Achrona* (perkament + goud). Pixel-font (`@fontsource/press-start-2p`) **enkel** voor titels, scores en badges. Game-knoppen (`.btn-game`) veren in bij het indrukken.
- **Glitches = monsters** (`src/lib/monster.ts`, `components/game/`) — elke glitch krijgt een gegenereerde SVG-creature (vorm, kleur, ogen, mond en hoorns afgeleid van het glitch-id, dus altijd hetzelfde monster), een naam uit district + metric (*Clockwork Wraith*) en een **HP-balk**: LEAKED 100 → ASSESSING 70 → CONTAINING 35 → FIXED 0. Een statuswijziging geeft een hit-animatie met zwevende schade (*-30 HP*); bij FIXED verdampt het monster in pixels. 🤖-glitches zijn **wild spawns** met een draaiende gouden rand. Het overzicht wisselt tussen **Cards** en **Table** (onthouden).
- **Guardians = spelers** (`src/lib/progress.ts`) — XP en level worden **afgeleid** uit de echoes en de audit-log (geen extra tabel): echo +10, toegewezen +5, naar CONTAINING +15, FIXED +50, wild spawn gefixt +25. Bovenbalk met avatar, level-badge en XP-balk, *+XP*-popups en een fullscreen level-up met confetti (*Level 4 — Timekeeper*). Karakterkaart op `/guardians/$id`: stats, badges en recente activiteit.
- **Quests & achievements** — 3 **daily quests** per dag (deterministisch op datum en rol, zijpaneel via het perkament-icoon of `q`), met XP-beloning. **Achievements** met toast: First Blood, Firefighter (3 fixes in 10 min), Cartographer (echo in elk district), Night Owl, Lockdown Breaker. Het leaderboard is een **arcade-highscorescherm** (score = XP, podium, knipperende *NEW HIGHSCORE*).
- **Commander** — **deploy units**: sleep een defender van de deploy-bank op een monster-kaart (of tik de defender en dan het monster; de dropdown op de detailpagina werkt ook). *Simulate attack* is een **wave**: aftelling 3-2-1, sirene *WAVE 3 INCOMING*, een wave-teller en een **wave-rapport** (tijd, MVP, 1–3 sterren).
- **Sfeer** — de magie-meter heeft een **mana-orb**-variant (golvende vloeistof die zakt). **Lockdown = Boss Battle**: de grootste open glitch wordt de BOSS met een grote HP-balk bovenaan. 8-bit geluiden via Web Audio (hit, fix, XP, level-up, aftelling, alarm), standaard **uit**.
- **Duidelijk** — hover-uitleg op elke game-term (bv. HP-balk → *Status: CONTAINING*), een **tutorial** van 4 stappen bij het eerste bezoek (overslaanbaar, opnieuw te bekijken via `Ctrl+K`), en alles werkt op 390 px breed. Alle animaties respecteren `prefers-reduced-motion`.

### De kaart van Achrona

Een realistische fantasy-kaart, **procedureel gegenereerd met een vaste seed** door `npm run map:generate` (`src/scripts/generate-map.ts`). Het script schrijft `src/assets/achrona-map.svg` (terrein) en `src/lib/map-geometry.json` (districtpolygonen, hoofdplaatsen, label- en markerposities). Beide bestanden zitten in git: de browser rekent niets uit en draait het script nooit.

- **Terrein:** kustlijn uit fractal noise (baaien, schiereilanden, eilandjes), hoogtelijnen en zachte hill-shading, de bergketen van Skyforge met sneeuwtoppen, rivieren die de steilste helling volgen tot in zee, het bos van Ember Fields, Crystal Lake bij de haven, gebogen wegen, districtgrenzen via Voronoi (geknipt op het land), ondiep water en golfjes.
- **Decoratie:** een hoofdplaats-icoon per district, kompasroos, schaalbalk "1 league", titelcartouche en labels in Cinzel (lokaal via `@fontsource/cinzel`).
- **Twee stijlen op dezelfde geometrie** (CSS-variabelen): *light* = perkament met papiertextuur (`feTurbulence`) en vergeelde randen; *dark* = holografische mission control met cyaan contouren, raster en scanlines.
- **Interactie:** pannen, zoomen (muiswiel, slepen, pinch, knoppen + / − / reset), begrensd zodat je de kaart niet kwijtraakt; labels en markers blijven leesbaar. Markers per glitch, verspreid over hun district, met statuskleur, pulserende ring bij LEAKED en een 🤖-badge. Bij uitzoomen worden drukke districten gebundeld tot één cirkel met een getal. Hover op een district toont een tooltip (open glitches, magie); klikken opent een zijpaneel (bottom sheet op gsm) met de glitches, "Open" en — voor een commander — "Assign".
- **Lagen:** Glitches · Sensor-heatmap (laatste magic-waarde, groen → rood) · Wegen · Labels, plus een legende.
- **Animaties:** drijvende wolken, een rimpeling en camera-nudge bij een nieuwe glitch, sterretjes en een groene flits bij FIXED, een rode storm met bliksem over de getroffen districten tijdens lockdown, en markers die in- en uitfaden tijdens de replay.
- **Toegankelijk:** districten en markers zijn focusbaar met `Tab`, `Enter` opent het paneel, `Esc` sluit het.

Een andere kaart nodig? Pas `SEED` of de layout bovenaan het script aan en draai `npm run map:generate`.

## Project setup
Deze repository bevat een basis [Tanstack Start](https://tanstack.com/start) op basis van:
- **Language:** [Typescript](https://www.typescriptlang.org)
- **Framework:** [React](https://react.dev)
- **ORM:** [Drizzle](https://orm.drizzle.team) + SQLite (better-sqlite3)
- **Styling:** [Tailwind](https://tailwindcss.com)
- **Build tool:** [Vite](https://vite.dev)

Vereist: Node.js 22.18 of nieuwer (de seed draait TypeScript rechtstreeks met Node).

```bash
npm install
cp .env.example .env      # en vul een eigen SESSION_SECRET in (min. 32 tekens)
npm run db:setup          # tabellen aanmaken + testdata (veilig om opnieuw te draaien)
npm run dev               # http://localhost:3000
```

| Commando | Wat het doet |
| --- | --- |
| `npm run dev` | Dev-server op poort 3000 |
| `npm run build` | Productiebuild (hetzelfde als de CI) |
| `npm run db:setup` | `db:push` + `db:seed` |
| `npm run db:seed` | Database leegmaken en opnieuw vullen met testdata (timestamps relatief aan "nu") |
| `npm run db:reset` | `local.db` verwijderen en opnieuw opzetten (stop eerst de dev-server) |
| `npm run db:studio` | Drizzle Studio om de data te bekijken |
| `npm run map:generate` | De kaart opnieuw genereren (SVG + geometrie, vaste seed) |
| `npm run test:workflow` | Tests van de workflow-engine en van XP / quests / achievements / monsters |

Zonder `SESSION_SECRET` start de app met een onveilige dev-sleutel en een waarschuwing in de console.

### Demo-rolwissel (`DEMO_MODE`)

Voor een demo hoef je niet telkens uit te loggen: met `DEMO_MODE=true` in `.env` (staat zo in `.env.example`, dus standaard aan in dev) wordt je avatar in de bovenbalk een **guardian-switcher**.

- Klik op je avatar → lijst van alle guardians (behalve SYSTEM) met initialen, codename en rol-badge (CMD / DEF). Kies er een en je bent meteen die guardian: geen wachtwoord, geen pagina-reload (`router.invalidate()`). Je badge flipt als een kaart en een toast meldt *"Now acting as ember (Defender)"*.
- **`Shift+R`** wisselt snel tussen **nova** (commander) en **ember** (defender). Ook in `Ctrl+K` (*Demo: switch nova ↔ ember* en *Demo: act as …*) en in de sneltoetsenlijst (`?`).
- Op een gsm toont de bovenbalk enkel de avatar; de lijst opent als bottom sheet.
- Server: `switchGuardian({ guardianId })` (`src/lib/auth.functions.ts`) werkt **alleen** in demo mode: `DEMO_MODE=true`, of geen `DEMO_MODE` in een dev-build (`npm run dev`). Anders geeft hij een fout en is de switcher verborgen. Hij zet enkel het guardian-id in de sessie-cookie, dus alle bestaande rolchecks op de server blijven ongewijzigd werken.

> ⚠️ Zet `DEMO_MODE` **nooit** aan in productie: iedereen die ingelogd is, kan dan commander worden. `DEMO_MODE=false` zet hem altijd uit; zonder de regel staat hij aan in dev en uit in een productiebuild.

> **Bestaande `local.db` van een oudere versie?** Het schema is uitgebreid (districten, workflow, sensoren). Stop de dev-server en draai `npm run db:reset`.

> **Windows zonder Visual Studio C++ build tools?** Als `npm install` faalt op `better-sqlite3` (node-gyp), gebruik dan `npm install --ignore-scripts`. Het pakket bevat al een kant-en-klare binary voor Windows, macOS en Linux.

## Testaccounts

| Codename | Wachtwoord | Rol |
| --- | --- | --- |
| `nova` | `commander123` | commander |
| `ember` | `defender123` | defender |
| `pixel` | `defender123` | defender |

## Demo-flow
1. Log in als **nova** (commander): de boot-sequence speelt, daarna het overzicht met meter (70%), kaart en lijst. Zet op `/sensors` **Auto-Desync** uit als je een rustige demo wilt.
2. Open in een tweede browser (of incognito) de app als **ember** (defender). Druk `n`, kies *Clocktower Quarter* en meld *"Gravity reversed near the clock"* (of druk **Speak**). Bij nova verschijnt binnen 5 s het glitch-effect + toast, en de marker pulseert op de kaart.
3. Als nova: open GL-0142, wijs hem toe aan *ember* → badge schuift naar **ASSESSING** + toast. Ember ziet "This glitch is assigned to you"; als ember een update-echo post, gaat hij automatisch naar **CONTAINING**. Daarna **Mark as fixed** → bij nova vliegen de deeltjes naar de meter.
4. Als nova op `/sensors`: zet **Auto-assign** aan en klik **Simulate attack**. Binnen ±20 s crashen de grafieken, ontstaan 🤖-glitches die meteen toegewezen worden, en gaat de UI in **LOCKDOWN**.
5. Fix een 🤖-glitch: de grafiek van dat district herstelt zichtbaar. **Reset simulation** zet alle sensoren terug.
6. Open de **kaart** (`m`): zoom en sleep, klik op een district voor het zijpaneel en wijs van daaruit een glitch toe. Zet de laag *Sensor-heatmap* aan en wissel met `t` tussen perkament en hologram. Sleep de **replay**-slider terug of druk play om het laatste uur af te spelen. Bekijk `/leaderboard`, druk `Ctrl+K` voor de command palette, `t` voor dark mode en `?` voor alle sneltoetsen.

## Projectstructuur

```
src/
  db/            schema (guardians, glitches, echoes, sensor_readings, settings), connectie, seed
  lib/           types, server functions (*.functions.ts), workflow-engine, Desync Engine, sessie, helpers,
                 map-geometry.json (gegenereerd)
  assets/        achrona-map.svg (gegenereerd terrein)
  scripts/       generate-map.ts (npm run map:generate)
  components/    UI: tabel, gauge, map/ (kaart, pan/zoom, paneel, effecten), sensorgrafieken, dialogs, sidebar,
                 game/ (monsters, HUD, quests, deploy, waves, tutorial, guardian-switcher)
  routes/        /login, _app (beschermde layout), / (overzicht), /map, /glitches/$glitchId, /sensors, /leaderboard,
                 /guardians/$guardianId
```

<details>
<summary>Oorspronkelijke opdracht en beoordeling</summary>

## Beoordeling
> Hoe wij beoordelen wordt voor de start van de hackathon met alle studenten gedeeld, zodat dit meteen duidelijk is voor iedereen.

- **Creativity (40%):** Biedt de applicatie nieuwe, innovatieve of creatieve oplossingen? Steekt jullie applicatie er bovenuit t.o.v. de andere deelnemers?
- **Functionality (30%):** Welke functionaliteit hebben jullie kunnen voorzien tijdens de hackathon? Is de UI intuïtief en gebruiksvriendelijk? Zijn de functionaliteiten duidelijk voor de gebruikers zonder uitleg/handleiding?
- **Presentation (30%):** Trekt jullie presentatie onze aandacht? Is de presentatie duidelijk en helder over wat jullie gebouwd hebben? Zien we in jullie presentatie de input van alle deelnemers evenwaardig terugkomen?

## Basisopdracht
> Om alle opdrachten gelijkwaardig te beoordelingen, verwachten dit als minimale setup. 
> Hierna kiezen jullie zelf welke uitbreidingen jullie willen toevoegen.

![datamodel](datamodel.png)

Maak een webapplicatie waarin guardians kunnen inloggen. Eens ingelogd, zien ze een lijst met glitches.
Guardians hebben een role.
- Role `defender` kan echoes melden. Elke echo wordt standaard aanzien als een glitch 
- Role `commander` heeft dezelfde rechten als een defender + admin rechten
- Een echo heeft een `timestamp` en een `description`. 

Datamodel-uitbreidingen in deze implementatie: `echoes.glitch_id` (relatie glitch 1→N echo), `glitches.assigned_guardian_id` (toewijzing), `guardians.password_hash` (login), `district` op glitches en echoes, `glitches.status_changed_at`/`source`/`trigger`/`metric`, `echoes.kind`/`status_before`/`status_after` (audit-log), en de tabellen `sensor_readings` en `settings`.

## Uitbreidingen (Optioneel)
> Jullie kiezen zelf wat jullie willen toevoegen. Hieronder alvast wat inspiratie

### Workflow
- **Glitch status:** Een glitch doorloopt verschillende statussen (`LEAKED` → `ASSESSING` → `CONTAINING` → `FIXED`).
- **Zoek/Filters:** Guardians kunnen zoeken op keywords + data filteren en sorteren.
- **Glitches toewijzen:** Een commander kan glitches handmatig toewijzen aan een defender, die vervolgens via echoes updates geeft over deze glitch.
- **Reporting:** Maak de belangrijkste data exporteerbaar via PDF (voor de Hoge Raad van Achrona).
- **Keyboard shortcuts:** Navigeer door de applicatie met sneltoetsen (bv. <kbd>j</kbd> en <kbd>k</kbd> om de vorige/volgende glitch te bekijken).
- **Dark mode:** Zorg dat guardians kunnen switchen tussen dark en light mode. Voorzie evt. een extra lockdown mode die aanduidt dat er een grote aanval aan de gang is.

### Real-time monitoring
- **Live updates:** Nieuwe glitches worden real-time zichtbaar op het scherm.
- **Gauge chart:** Een visuele meter die de hoeveelheid magie in Achrona toont (100% als alles in orde is).
- **Interactieve kaart:** Een kaart (map) die exact toont wáár in Achrona een glitch plaatsvindt.
- **Sensor data:** Het systeem verwerkt IoT-sensordata en toont deze in grafieken op het dashboard.
- **Responsive design:** De applicatie werkt mobile-first en is volledig geoptimaliseerd voor smartphones.
- **Offline mode:** Data blijft beschikbaar bij netwerkuitval, met een duidelijke "offline"-indicator.

### AI Automation
- **Handle duplicates:** AI groepeert gerelateerde echoes automatisch onder dezelfde glitch; admins kunnen handmatig overriden.
- **Glitch types:** AI categoriseert het type en maakt dit visueel duidelijk (bv. met iconen of kleuren).
- **AI-moderation:** AI weert nutteloze echoes en scant beschrijvingen en afbeeldingen op illegale content.
- **Auto-closable glitches:** Glitches sluiten automatisch op basis van echoes (bv. "alles terug in orde"), maar heropenen ook als er een gelijkaardig nieuw probleem binnenkomt.
- **Predictive analysis:** AI maakt zelf glitches aan op basis van data-afwijkingen (bv. data-voorraad die in 5 minuten met 40% zakt).
- **Automatische toewijzing:** AI kiest zelfstandig welke defender het best past bij de glitch.
- **Create Runbook:** AI genereert een stappenplan (runbook) om het specifieke probleem op te lossen.
- **Chatbot:** Een ingebouwde assistent die vragen van operators over actieve incidenten en alerts beantwoordt.

### User engagement
- **Image uploads:** Users kunnen foto's uploaden bij een echo om de situatie te verduidelijken.
- **Speech-to-text:** Defenders op de vlucht kunnen echoes via hun microfoon inspreken i.p.v. te typen.
- **Verstuur notificaties:** Push-notificaties, e-mails of sms-berichten bij kritieke problemen (met instelbare voorkeuren per user).
- **Leaderboard:** Een klassement met badges voor de defenders die de meeste incidenten fixen.

</details>
