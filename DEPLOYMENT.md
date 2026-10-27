# Pubblicazione GitHub Pages

Il codice sorgente sta in un branch di sviluppo. GitHub Pages pubblica invece
solo i file compilati del branch `gh-pages`, cartella `/ (root)`.
Non selezionare il branch sorgente nel menu Settings > Pages.

Il sito usa https://scribyx.federicolelli.com/ e quindi Vite deve usare `base: '/'`.
`public/CNAME` conserva il dominio durante ogni pubblicazione; `.nojekyll`
disabilita l'elaborazione Jekyll dei file statici.

## Variabili d'ambiente

Copia `.env.example` in `.env.local` solo se `.env.local` non esiste gia.
Configura `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
La seconda accetta una chiave publishable o la precedente chiave anon.
Non usare chiavi secret o service_role: i valori VITE_ sono pubblici nella build.
`.env.local` resta escluso da Git.

Con il deploy locale, le variabili sono lette da Vite durante la compilazione.
Le variabili e i secrets configurati su GitHub non vengono automaticamente
inseriti nei file pubblicati da un branch. Per usarli servirebbe un workflow
GitHub Actions che li passi esplicitamente alla build.

## Comandi

- `npm run predeploy`: verifica le variabili e ricompila senza pubblicare.
- `npm run deploy`: esegue automaticamente predeploy, poi pubblica dist su gh-pages.

Non eseguire solo `npm run build` seguito da un push del codice sorgente
aspettandoti che Pages ricompili React: questa configurazione pubblica file statici.
Non caricare i file .env nel branch gh-pages.

## Link

Le nuove risorse sono sotto `/assets/`. Il fallback 404 conserva query e hash,
porta `/cloud` alla schermata `/?cloud=1` e supporta i vecchi link `/scribyx/`.
