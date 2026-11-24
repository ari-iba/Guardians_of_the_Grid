# Guardians of the Grid
Jullie bouwen een mission control center om Achrona te beschermen tegen The Desync. 
Dit  fungeert als de ultieme digitale levenslijn door vitale statistieken live in 
kaart te brengen en afwijkingen vroegtijdig te signaleren. Dankzij jullie realtime 
data-inzichten kunnen we op tijd ingrijpen om de glitches te stoppen en de magie 
in Achrona te redden

## Features

**Basis**
- **Login met rollen** — `defender` en `commander`. Wachtwoorden gehasht met scrypt (`node:crypto`), sessie in een HMAC-ondertekende, HttpOnly cookie (bevat enkel het guardian-id). Niet ingelogd → automatisch naar `/login`.
- **Glitch-overzicht** — status-badges (LEAKED rood, ASSESSING oranje, CONTAINING blauw, FIXED groen), aantal echoes en toegewezen defender. Klik een rij voor details.
- **Echo melden** — elke nieuwe echo opent een nieuwe glitch (`LEAKED`). Op de detailpagina voeg je een echo toe als update aan een bestaande glitch.
- **Detailpagina** — lifecycle-stepper en tijdlijn van alle echoes (wie, wanneer, wat).

**Commander**
- Status één stap vooruit/achteruit (`LEAKED → ASSESSING → CONTAINING → FIXED`).
- Glitch toewijzen aan een defender.
- Alle rechten worden **op de server** gecontroleerd: een defender die de server function toch aanroept, krijgt een fout.

**Mission control**
- **Magic in Achrona-meter** — halve-cirkel-gauge (eigen SVG). `100 − (LEAKED×15 + ASSESSING×10 + CONTAINING×5)`, begrensd op 0–100, van groen via oranje naar rood.
- **Lockdown mode** — bij < 40% magie of ≥ 3 LEAKED glitches: rode banner, rood accent in de hele UI en een pulserende rand.
- **Live updates** — elke 5 s verversen (gepauzeerd als het tabblad verborgen is), "updated Xs ago" en nieuwe glitches lichten kort op.
- **Zoeken / filteren / sorteren** — op beschrijving of id, per status, "Assigned to me", sorteren op datum of urgentie. Staat in de URL, dus deelbaar.
- **Dark / light mode** — onthouden in `localStorage`, zonder flits bij het laden.
- **Sneltoetsen** — `j`/`k` volgende/vorige glitch, `Enter` openen, `n` nieuwe echo, `/` zoeken, `g` overzicht, `t` thema, `?` overzicht van alle sneltoetsen. Niet actief tijdens het typen.
- **Responsive** — op een smartphone wordt de sidebar een bovenbalk en de tabel een lijst met kaarten.

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
| `npm run db:seed` | Database leegmaken en opnieuw vullen met testdata |
| `npm run db:studio` | Drizzle Studio om de data te bekijken |

Zonder `SESSION_SECRET` start de app met een onveilige dev-sleutel en een waarschuwing in de console.

> **Windows zonder Visual Studio C++ build tools?** Als `npm install` faalt op `better-sqlite3` (node-gyp), gebruik dan `npm install --ignore-scripts`. Het pakket bevat al een kant-en-klare binary voor Windows, macOS en Linux.

## Testaccounts

| Codename | Wachtwoord | Rol |
| --- | --- | --- |
| `nova` | `commander123` | commander |
| `ember` | `defender123` | defender |
| `pixel` | `defender123` | defender |

## Demo-flow
1. Log in als **ember** (defender). Het overzicht toont de magie-meter (70%) en vier glitches.
2. Klik **Assigned to me**: je ziet enkel de glitches van ember. Druk `j`/`k` en `Enter` om er een te openen.
3. Druk `n` en meld een echo, bijvoorbeeld *"Gravity reversed in the library courtyard"*. Er verschijnt een nieuwe LEAKED glitch en de meter zakt.
4. Open in een tweede browser (of incognito) de app als **nova** (commander). Meld nog een echo: er zijn nu 3 LEAKED glitches → **LOCKDOWN**. Het scherm van ember wordt binnen 5 s ook rood, en de nieuwe glitch licht op.
5. Als nova: open een glitch, zet hem met **Containing →** verder en wijs hem toe aan *pixel*. Op een detailpagina toont ember geen commander-knoppen; de server weigert de actie ook als je het rechtstreeks probeert.
6. Zet alles op FIXED: de meter klimt naar 100% en de lockdown verdwijnt. Druk `t` voor dark mode en `?` voor alle sneltoetsen.

## Projectstructuur

```
src/
  db/            schema (guardians, glitches, echoes), connectie, seed
  lib/           types, server functions (*.functions.ts), sessie & wachtwoorden, helpers
  components/    UI: tabel, gauge, formulieren, dialogs, sidebar
  routes/        /login, _app (beschermde layout), / (overzicht), /glitches/$glitchId
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

Datamodel-uitbreidingen in deze implementatie: `echoes.glitch_id` (relatie glitch 1→N echo), `glitches.assigned_guardian_id` (toewijzing) en `guardians.password_hash` (login).

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
