# CONTEXT.md — Music Project (clon personal de Demus, mejorado)

> Pega este archivo al inicio de un prompt nuevo para retomar el trabajo. Última actualización: tras el **paso 4** (importador Spotify). El usuario ya tiene el proyecto Expo funcionando en su PC; se le entregan solo archivos sueltos con ruta.

## Objetivo
App iOS **de uso personal** (no comercial), estilo Demus: reproduce música vía YouTube e importa playlists de Spotify pegando el enlace (playlists públicas). **Mejora clave:** que la canción importada sea la correcta (Demus a veces importa una homónima de otro artista). Por eso el matching puntúa candidatos y manda a revisión manual lo dudoso.

## Stack y entorno
- **Proyecto completo entregado (zip final, sin carpeta raíz, sin node_modules ni .git).** Generado con `create-expo-app@latest --template blank-typescript` y verificado: Expo SDK ~58.0.23, React 19.3.0, React Native 0.88.1, TypeScript ~6.0.3, vitest ^5.1.0, expo-sqlite ~58.0.15, expo-secure-store ~58.0.2, expo-auth-session ~58.0.17, expo-web-browser ~58.0.7. `app.json` ya tiene plugins (expo-sqlite, expo-secure-store, expo-web-browser), bundleIdentifier com.local.musicproject y scheme musicproject. Script `npm test` = `vitest run`. Tras `npm install`: 12 tests OK, `tsc --noEmit` OK.
- Pasos para el usuario: copiar el contenido del zip a su carpeta vacía `C:\Users\ericm\MusicProject\music-project`, `npm install`, `npx vitest run`, `npx expo start`. Pendiente de rellenar: `extra.eas.projectId` (al hacer `eas build:configure`).
- Expo (React Native) + TypeScript estricto, desarrollo desde Windows, build con EAS. Plugins en app.json: expo-sqlite, expo-secure-store.
- Repo del usuario: github.com/Eriicmans/music-project (mi herramienta no puede abrirlo; se trabaja con el zip que sube el usuario).
- Tests: Vitest (`npm i -D vitest`, `npx vitest run`). En mi sandbox hay que sustituir temporalmente `tsconfig.json` porque extiende `expo/tsconfig.base`.

## Incidencias resueltas
- Expo Go (iPhone) mostró: "signed in to Expo Go as ericmans, but not signed in to Expo CLI". Solución: `npx expo login` en el PC con la misma cuenta (ericmans), o cerrar sesión en Expo Go. Después el usuario dijo que `expo login` no pide contraseña y le lleva a su cuenta/pantalla de inicio de Expo Go: comprobar con `npx expo whoami`; si sale ericmans el login funcionó y el proyecto debe aparecer en Expo Go > Inicio > 'Development servers' (misma cuenta y misma wifi, o `--tunnel`). Si el móvil y el PC no comparten red: `npx expo start --tunnel`. En Windows (cmd), `npx expo login` por navegador falló (cmd `start` no abre la URL con `&`; Node v24.22.1): alternativas = `npx expo login -u ericmans` (pide contraseña en terminal), token `EXPO_TOKEN` creado en expo.dev/settings/access-tokens, o cerrar sesión en Expo Go.

## Reinicio desde cero (decidido por el usuario tras fallar el arranque con Expo Go)
- El usuario recrea el proyecto Expo en su PC con `npx create-expo-app@latest music-project --template blank-typescript`, tras mover a una carpeta `guardado` sus archivos propios: `src/`, `tests/`, `eas.json`, `CONTEXT.md`, `README.md` (copia de seguridad también en `music-project-completo.zip`).
- **Orden:** 1) comprobar que la app en blanco arranca en el iPhone (Expo Go con sesión cerrada, o `npx expo login`; `npx expo start`, QR con la cámara; si falla, `--tunnel`). 2) SOLO entonces reincorporar archivos y dependencias: `npx expo install expo-sqlite expo-secure-store expo-auth-session expo-web-browser`, `npm i -D vitest`, añadir a app.json `"plugins": ["expo-sqlite","expo-secure-store","expo-web-browser"]`, `"scheme": "musicproject"`, `ios.bundleIdentifier` com.local.musicproject, y script `"test": "vitest run"`; copiar `src/`, `tests/`, `eas.json`; `npx vitest run` (12 tests). 3) Reconectar con GitHub (pendiente: decidir si conservar `.git` antiguo).
- **Corrección:** con Expo Go actual (SDK 58) NO vale cerrar sesión en Expo Go: el mensaje es 'You need to be signed in to Expo Go and Expo CLI to open your project'. Hay que estar logueado en AMBOS con la misma cuenta (ericmans). Como `npx expo login` por navegador falla en su Windows, vía recomendada: token `EXPO_TOKEN` (expo.dev/settings/access-tokens; `set EXPO_TOKEN=...` en cmd; verificar con `npx expo whoami`) + iniciar sesión en Expo Go con la misma cuenta.
- **Estado:** el usuario confirmó 'todo listo' (login resuelto, app en blanco asumida funcionando). Se le dieron los comandos para reincorporar `src/`, `tests/`, `eas.json`, `CONTEXT.md`, `README.md` desde `C:\\Users\\ericm\\MusicProject\\guardado` (xcopy/copy), instalar dependencias, editar app.json/package.json a mano y correr `npx vitest run`. Pendiente: que confirme 12 tests OK y que la app sigue arrancando.
- No avanzar al paso 3 (SQLite) hasta confirmar que la app arranca.

## Decisiones tomadas
- **Entrega de archivos:** se entregó UN zip final (sin carpeta raíz, sin package.json/app.json/tsconfig.json/App.tsx/assets, que son los generados por Expo del usuario) para volcar el contenido en su carpeta. Desde ahí, solo archivos sueltos con ruta exacta. Antes de eso: NO dar zips (el usuario no quiere sustituir su carpeta). Dar solo archivos nuevos/modificados con su ruta exacta. Su carpeta local es la generada por `create-expo-app` (tiene assets/, node_modules/, AGENTS.md, package.json, tsconfig.json, app.json, index.ts, App.tsx propios, .gitignore, LICENSE). **Nunca pedirle sobrescribir** package.json, tsconfig.json, app.json ni App.tsx: indicar cambios puntuales (p. ej. añadir plugins a app.json).
- Uso personal: el usuario autoriza **saltarse la regla "solo integraciones oficiales"** del README (búsqueda en YouTube por vías no oficiales, p. ej. ytmusicapi/youtubei). Motivo: `search.list` oficial cuesta 100 uds y la cuota diaria es 10.000 (~100 búsquedas/día; una playlist de 200 no cabe; **verificar en docs actuales**).
- Reproducción: pendiente de decidir (iframe embebido oficial vs. otras vías). No se ha implementado nada.
- El usuario pidió que el README se entregue **como texto en el chat**, no en archivo (el README del zip puede estar desactualizado).
- Estilo de trabajo: implementar **paso a paso**, respuestas cortas, y devolver este CONTEXT.md actualizado en cada respuesta.

## Estado actual del código
- `src/models/Track.ts`: `Track`, `TrackCandidate`, `TrackVersion` = studio|live|remix|acoustic|instrumental|karaoke|cover|altered|unknown.
- `src/core/matching/parseTitle.ts`: `parseTitle(raw, knownArtists)` → `{baseTitle, version, featured}`; quita ruido de YouTube (Official Video, Lyrics, Remastered, Radio Edit…), extrae `feat.`, detecta versión, quita prefijo "Artista - ". `splitArtists`, `titleSimilarity` (Dice sobre bigramas).
- `src/core/matching/scoreCandidate.ts`: `normalize` (corregido bug de barras invertidas dobles que no quitaba tildes), `scoreCandidate(track, candidate)` → `{score, decision: auto|review|reject, reasons, conflicts, warnings}`.
  - Puntos: ISRC exacto +40, artista principal +25 (secundario +12 con warning), título exacto +15 (similar ≥0.85 +10 con warning), duración ≤2 s +10 (≤5 s +5), versión igual +10.
  - `auto`: sin conflictos ni warnings, artista principal coincide, y (ISRC exacto con score ≥90) **o** (sin ISRC: título exacto + duración ±2 s + misma versión). **Decisión mía:** sin ISRC sí se autoacepta con metadatos estrictos, porque YouTube casi nunca trae ISRC y si no todo iría a revisión (relaja el caso 5 de `tests/matching-cases.md`).
  - `review`: sin conflicto de artista/versión/ISRC y score ≥ 40. Resto: `reject`.
- `tests/scoreCandidate.test.ts`: 12 tests pasando (casos 1,2,3,4,7 del md + feat., live, sped up, sin duración, Taylor's Version).
- **Paso 3 (SQLite), hecho y probado (21 tests, tsc OK):**
  - `src/db/database.ts`: interfaz `Db` (execAsync, runAsync, getAllAsync, getFirstAsync; compatible con expo-sqlite) para poder testear en Node.
  - `src/db/migrations.ts`: `migrate(db)` con `PRAGMA user_version`, transaccional; `SCHEMA_VERSION`=1. Tablas: `tracks` (spotify_id UNIQUE), `playlists` (spotify_id UNIQUE), `playlist_tracks` (PK playlist_id+position), `candidates` (PK track_id+provider+external_id; guarda score/decision/reasons/conflicts/warnings), `matches` (track_id PK, video_id, status auto|manual|pending|none, score).
  - `src/db/openDb.ts`: `openDb()` singleton con expo-sqlite (`music.db`, WAL, foreign_keys ON) + migraciones.
  - `src/db/repository.ts`: `upsertTrack` (no duplica por spotify_id), `getTrack`, `savePlaylist` (reimportar actualiza), `getPlaylistEntries`, `getCachedVideoId(spotifyId)` (solo auto/manual), `getMatchStatus`, `recordMatching(trackId, scored[])` (guarda hasta 5 candidatos no rechazados; auto→match auto; si no, pending; si nada, none; **nunca pisa un manual**), `resolveManual`, `listPendingReviews`, `countByStatus`, `newId`.
  - `tests/db.test.ts` + `tests/helpers/nodeSqliteDb.ts` (adaptador sobre `node:sqlite`, requiere Node ≥22.13; emite un ExperimentalWarning inocuo). Requiere `npm i -D @types/node` (TS 6 ya no carga @types automáticamente; el helper usa `/// <reference types="node" />`).
  - `App.tsx` de verificación: abre la BD y muestra "Base de datos lista · esquema v1" y contadores. Sin UI real todavía.

## Paso 4 — Importador de Spotify (hecho; 39 tests, tsc OK; NO verificado contra Spotify real)
- **Investigación (nov 2026):** desde feb 2026 la Web API oficial de Spotify en Developer Mode solo devuelve los items de playlists cuyo dueño/colaborador es el usuario; Client Credentials ya no sirve para playlists; Developer Mode exige Premium y pocos usuarios. Pegar un enlace público ajeno NO es posible por la vía oficial. Playlists propias vía OAuth PKCE sí darían lista completa con ISRC (opción futura).
- **Vía elegida (no oficial, uso personal):** página embed pública `https://open.spotify.com/embed/playlist/{id}` → JSON en `<script id="__NEXT_DATA__">` → `entity.trackList` (uri, title, subtitle=artistas separados por coma/nbsp, duration en ms). Limitaciones: **máx. ~100 canciones**, **sin ISRC ni álbum**, no documentada (puede romperse). No se implementó la paginación vía GraphQL interno (`pathfinder`) porque no se pudo verificar el hash de la consulta persistida y fuentes se contradicen sobre si sigue funcionando. Para listas >100: copiar la playlist a una propia/dividirla, u OAuth PKCE más adelante.
- Código: `src/importers/errors.ts` (`ImportError` con códigos invalid_url|not_playlist|short_link|network|unavailable|parse), `src/importers/spotify/parseUrl.ts` (`parsePlaylistId`: enlaces open/play/embed, intl-xx, user/x/playlist, URI, id suelto; rechaza álbum/pista/spotify.link), `embed.ts` (`parseEmbedHtml`, `fetchEmbedPlaylist`, tolerante a cambios con búsqueda recursiva de `trackList`; omite locales/episodios; `partial` si ≥100), `importPlaylist.ts` (`importSpotifyPlaylist(db, url, fetchFn=fetch)` → `{playlistId,name,total,newTracks,skipped,partial}`; versión de la canción vía `parseTitle`; transacción; reimportar no duplica).
- `App.tsx` ahora tiene pantalla V0.4: caja de enlace + botón Importar + resumen + primeras 15 canciones. Usa `react-native-safe-area-context` (instalar con `npx expo install react-native-safe-area-context`; elimina el warning de SafeAreaView deprecado).
- **Pendiente:** el usuario debe probar con una playlist real de Spotify en el iPhone; si falla ("parse"/"unavailable") pedirle el mensaje y, si puede, el HTML/JSON de la página embed para ajustar el parser.

## Limitaciones conocidas del matching
- `splitArtists` divide por `&`, `and`, `x`, `y`, `,`: nombres como "Earth, Wind & Fire" generan partes sueltas (puede dar coincidencias parciales falsas; lo compensa que el principal debe coincidir para `auto`).
- Descripciones de YouTube/canales "Topic" aún no se usan como señal.

## Plan de pasos
1–4. ✅ (matching, parseo, SQLite, importador Spotify)
5a. ✅ Búsqueda YT Music (`src/providers/youtubeMusic/search.ts`; NO verificado contra red real)
5b. ✅ (lógica) `toCandidate`, `findCandidates`, `runMatching` (cola con pausas). ⏭ Falta enlazar con `repository.recordMatching` y botón en App.tsx (necesita ver repository.ts y App.tsx)
6. Pantalla de revisión (2-3 mejores candidatos por canción dudosa)
7. Reproductor

## Pasos 5a/5b — Búsqueda YouTube Music y cola de matching
- Endpoint interno POST music.youtube.com/youtubei/v1/search (WEB_REMIX, sin cuota). `SONGS_FILTER` de ytmusicapi no verificado: si no devuelve nada, `findCandidates` reintenta con `filter:false` y descarta kind 'other'.
- `toCandidate(YtResult)` → `TrackCandidate` (version vía parseTitle, durationMs = sec*1000).
- `findCandidates(track, search)` → `ScoredCandidate[] {candidate,result}` ordenado (auto > review > reject, luego score).
- `runMatching(tracks, {search, record, shouldSkip, sleep, random}, {delayMs=800 + hasta 50 %, maxConsecutiveErrors=5, onProgress, signal})` → resumen. `record` se adapta a `recordMatching` (formato de `scored` por confirmar con repository.ts).
- Entrega: el usuario recibe archivos completos con ruta y los sustituye; no pegar fragmentos.

## Pendiente de preguntar / decidir
- Método de reproducción en iOS (afecta a segundo plano).
- Si hay que tocar `README.md`, `app.json` (projectId EAS) o añadir `package.json` al repo.
