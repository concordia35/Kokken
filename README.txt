Restauratør · Concordia
Version 2.4.0

Separat app til restauratøren/madansvarlig.

Funktioner:
- Læser samme Google Sheet / Apps Script som TilmeldingV3.
- Viser kommende logeaftener og madtal.
- Viser kuverter i alt, brødre til mad, gæster til mad, uden mad, ikke svaret og deltager ikke.
- Kopierer køkkenbesked til udklipsholder.
- Printvenligt køkkenoverblik.
- Viser ændringer siden sidste åbning på samme enhed.
- Kan rette tilmeldinger for alle brødre.

Vigtigt:
Rettelser gemmes som nye rækker i det eksisterende tilmeldingsark.
Appen bruger altid nyeste række pr. broder pr. logeaften.
Der er ikke tilføjet ekstra sikkerhed i denne version.

Opsætning:
Upload hele mappen til GitHub Pages som separat repository eller undermappe.
Hvis Apps Script URL ændres, skal den rettes i app.js under CONFIG.GOOGLE_APPS_SCRIPT_URL.


Version 2.1.0:
- Om-sektionen er udvidet med formål, brug og forklaring af rettelser.

Version 2.1.1:
- Om-sektionen er rettet, så teksten har korrekt luft og ikke rammer kanten af kortet.
- Om-teksten er delt op i mindre bokse, så den passer bedre på mobil.


Version 2.2.0:
- Nyt responsivt desktop-layout, så løsningen fungerer som en rigtig webside på computer.
- Fast venstremenu med større arbejdsområde på brede skærme.
- Overblik viser næste logeaften og kommende aftener side om side.
- Ret tilmeldinger viser filtre og opsummering ved siden af en større broderliste.
- Køkkenoverblik og arkiv udnytter flere kolonner på store skærme.
- Mobilvisningen og PWA-installation er bevaret.

Version 2.2.1:
- Datahentning og gemning får timeout, så appen ikke kan hænge på indlæsningsskærmen.
- Senest hentede data vises ved midlertidige netværksfejl.
- PWA-cachen er versionsopdateret og matcher de versionsmærkede filer.
- Navigation fra overbliksdialogen til rettelser lukker dialogen korrekt.
- Tablet-, desktop- og printlayout er justeret mod overlap og vandret scroll.


Version 2.3.0:
- Restauratøren kan tilføje eksterne gæster til en valgt logeaften.
- Eksterne gæster gemmes i samme tilmeldingsark og tæller med i det samlede antal kuverter.
- Eksterne gæster holdes adskilt fra brødre og medbragte gæster i overblik og køkkenbesked.
- Eksterne gæster kan fjernes igen fra Ret-visningen.
- Der kan tilføjes flere eksterne gæster på én gang med navn/beskrivelse og valgfri bemærkning.


Version 2.3.2:
- Bygger på den fungerende 2.3.0-forbindelse til Google Sheets.
- Læser antal medbragte gæster fra brødre-appen uden at ændre køkken-appens eksisterende gemmeflow.
- Summerer medbragte gæster og gæstekuverter korrekt.
- PWA-cache versionsnummer er opdateret, så gamle 2.3.1-filer ikke hænger fast.


Version 2.4.0:
- Ny Besked-side til manuelle push-notifikationer til brødrene.
- Overskrift, besked, forhåndsvisning og bekræftelse før afsendelse.
- Kan åbne brødre-appen, når modtageren trykker på notifikationen.
- Push sendes via det eksisterende Google Apps Script, så OneSignal API-nøglen ikke ligger i PWA-koden.
- Kræver at Apps Script udvides med sendPush-handling og ONESIGNAL_API_KEY i Script Properties.


Version 2.4.1:
- Fuldt køkkenoverblik viser nu også en navneliste under “Meldt fra”.
- Push-fejl viser nu den konkrete fejl fra Apps Script i stedet for en generisk tekst.
- PWA-cache er opdateret til 2.4.1.
- Mappen AppsScript-push-patch indeholder serverdelen, der skal flettes ind i det eksisterende Apps Script for at aktivere manuel push.
