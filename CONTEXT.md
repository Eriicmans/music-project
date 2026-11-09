# CONTEXT.md — Music Project (clon personal de Demus, mejorado)

> **REGLA DE ENTREGA (obligatoria): devuelve SIEMPRE archivos completos (create_file + present_files) con su ruta exacta, listos para sustituir. NUNCA fragmentos para pegar. Respuestas muy cortas, sin gastar tokens.** Pega este archivo al inicio de un prompt nuevo para retomar el trabajo. Última actualización: tras el **reproductor estilo Spotify (paso 12)**. El usuario ya tiene el proyecto Expo funcionando en su PC; se le entregan solo archivos sueltos con ruta.

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
- Reproducción: DECIDIDO empezar con el iframe oficial (menos frágil); el usuario quiere poder cambiar luego a una vía no oficial con segundo plano. Por eso solo `src/ui/YouTubePlayer.tsx` conoce el motor. No se pudo confirmar qué usa Demus (búsqueda sin resultado).
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
5b. ✅ (lógica; 60 tests OK, tsc OK; test de pausas corregido a [100]) `toCandidate`, `findCandidates`, `runMatching` (cola con pausas). ✅ enlazado en 5c
5c. ✅ Enlace BD + botón en App.tsx
6. ✅ Pantalla de revisión
7. ✅ Reproductor v1 (iframe oficial; sin segundo plano)
8. ✅ Biblioteca de playlists

## Pasos 5a/5b — Búsqueda YouTube Music y cola de matching
- Endpoint interno POST music.youtube.com/youtubei/v1/search (WEB_REMIX, sin cuota). `SONGS_FILTER` de ytmusicapi no verificado: si no devuelve nada, `findCandidates` reintenta con `filter:false` y descarta kind 'other'.
- `toCandidate(YtResult)` → `TrackCandidate` (version vía parseTitle, durationMs = sec*1000).
- `findCandidates(track, search)` → `ScoredCandidate[] {candidate,result}` ordenado (auto > review > reject, luego score).
- `runMatching(tracks, {search, record, shouldSkip, sleep, random}, {delayMs=800 + hasta 50 %, maxConsecutiveErrors=5, onProgress, signal})` → resumen. `record` se adapta a `recordMatching` (formato de `scored` por confirmar con repository.ts).
- Entrega: el usuario recibe archivos completos con ruta y los sustituye; no pegar fragmentos.

## Paso 5c — Enlace BD + UI (hecho; sin ejecutar en este entorno, NO verificado en dispositivo)
- `src/db/matchingAdapter.ts`: `makeQueueDeps(db, search)` → `QueueDeps` (`record` → `recordMatching`; `shouldSkip` = estado auto/manual/pending; las `none` se reintentan).
- `App.tsx` V0.5: importar → botón "Buscar coincidencias" (progreso, cancelar, contadores ✅auto 👆manual ❓pending ✖️none, icono por canción) + botón "Probar YT Music" que muestra el JSON parseado de una búsqueda real (sirve para verificar `SONGS_FILTER`).
- **Pendiente del usuario:** `npx tsc --noEmit` y `npx vitest run` en su carpeta; probar en iPhone y reportar qué sale en "Probar YT Music" y el resumen del matching.

## Paso 6 — Pantalla de revisión (hecho; NO ejecutado en este entorno)
- `repository.ts`: nuevas `getChosenVideos(db, playlistId)` (vídeo auto/manual por canción, vía join con `candidates`) y `markNone(db, trackId)` ("ninguno es correcto"; una nueva búsqueda puede reintentarla). Tests añadidos en `tests/db.test.ts` (debería ser 62).
- `src/ui/ReviewScreen.tsx`: una canción pendiente cada vez, hasta 3 candidatos (título, artistas, duración, puntos, motivos/avisos), botones Elegir (→ `resolveManual`), Escuchar (abre YT Music), Ninguno es correcto, Saltar.
- `App.tsx` V0.6: cada fila muestra "↳ vídeo elegido"; botón "Revisar dudosas (N)" si hay pendientes; contadores cargados al abrir la BD.
- La playlist de prueba del usuario salió toda ✅, así que la pantalla de revisión aún no se ha visto con datos reales.

## Paso 7 — Reproductor v1 (hecho; el usuario confirmó que todo funciona en su iPhone)
- Dependencias nuevas: `npx expo install react-native-webview` y `npm i react-native-youtube-iframe`.
- `src/core/player/queue.ts` (`buildQueue`, `stepIndex`; `tests/queue.test.ts`, 2 tests), `src/ui/YouTubePlayer.tsx` (único acoplado a react-native-youtube-iframe; props videoId/playing/onEnded/onError/onPlayingChange), `App.tsx` V0.7: "▶ Reproducir playlist", tocar una canción con vídeo la reproduce, barra con ⏮ ⏯ ⏭ ✕, siguiente automático al terminar, salta si el vídeo no es embebible.
- Limitaciones: se pausa con la pantalla bloqueada/app en segundo plano (WebView); el reproductor se detiene al entrar en la pantalla de revisión. Fase siguiente posible: segundo plano (dev build + modo audio, o motor no oficial reescribiendo solo YouTubePlayer).

## Estado verificado (9-nov-2026)
- El usuario confirmó que funcionan: importación de Spotify, búsqueda en YT Music, matching (su playlist de prueba salió toda ✅), pantalla de revisión (sin datos dudosos para probarla aún) y reproductor.
- **GitHub:** el repo github.com/Eriicmans/music-project ya está reconectado y tiene TODO el código subido hasta el paso 7 (se cierra el pendiente de "reconectar con GitHub"). Se trabaja con el repo/repomix que sube el usuario.
- **Datos:** las playlists y coincidencias viven en la SQLite local de la app (`music.db`) en el iPhone, no en el PC ni en GitHub. Se pierden si se desinstala la app.

## Paso 8 — Biblioteca de playlists (hecho; NO ejecutado en este entorno)
- `repository.ts`: `listPlaylists` (total/resueltas/pendientes) y `deletePlaylist` (borra la playlist y las canciones huérfanas con sus coincidencias; conserva las compartidas). 2 tests nuevos en `tests/db.test.ts`.
- `App.tsx` V0.8: la home muestra "Tus playlists" (tocar abre, 🗑 borra con confirmación); dentro, "← Playlists" vuelve. El estado `summary` se sustituyó por `current`. "Revisar dudosas" aparece en la lista y en la playlist abierta.

## Paso 9 — Rediseño visual (v2, estilo "app de muebles" de la referencia del usuario) + aleatorio (NO ejecutado en este entorno)
- El usuario envió una imagen de referencia (app de muebles: fondo claro, tarjetas muy redondeadas, botones/chips en marrón óxido, tarjetas y barra inferior oscuras como contraste, cabecera con botones cuadrados redondeados, buscador + botón de filtros, tipografía sans geométrica, barra de pestañas flotante con iconos, botón de acción grande abajo) y pidió "algo así". Versiones anteriores descartadas: oscuro/serif (parecía filtro sepia) y claro/serif.
- Paleta (`src/ui/theme.ts`): fondo crema #F4EFE6, tarjetas #FBF9F5, chips #E8E0D2, marrón oscuro #523D2C (superficies de contraste: banner, tarjetas, reproductor, tab bar), **óxido #9A5A3A (acción: botones, chip activo)**, texto #33261B, dorado #B98B4E (manual), terracota #C0562F (dudosas/badge). Sin verde. Tipografía: sans del sistema (800 en títulos). Radios 12/16/20/26.
- **Dependencia nueva: `@expo/vector-icons`** (`npx expo install @expo/vector-icons`; se usa Ionicons vía `Icon` en `kit.tsx`). Si da error de nombre de icono, cambiar el nombre en el sitio de uso.
- Archivos: `src/ui/theme.ts`, `kit.tsx` (Icon, IconBtn, Btn tones accent/dark/soft/light, Chip, Disc, StatusDot), `cards.tsx` (PlaylistCard, TrackRow), `TabBar.tsx` (píldora flotante: Biblioteca / Revisar con badge de pendientes), `PlayerDock.tsx` (tarjeta marrón con vídeo y controles, siempre montada, ya no se corta al cambiar de pestaña), `ReviewScreen.tsx` (ahora es una pestaña; prop `onChanged`), `App.tsx` V1.0.
- Home "Tu música, siempre a mano": buscador de playlists (filtra por nombre) + botón óxido "+" que muestra/oculta el banner marrón de importación (visible siempre si no hay playlists); chips Todas/Completas/Con dudosas; cuadrícula 2 columnas de tarjetas (disco + franja marrón con nombre y botón borrar). Detalle: cabecera con atrás/borrar, disco grande, nombre + "listas/total" a lo grande, chips Todas/Dudosas/Sin resultado (filtran la lista), Buscar coincidencias con barra de progreso, filas de canción con estado y vídeo elegido, y barra fija inferior "Reproducir" + botón cuadrado aleatorio.
- Aleatorio: `shuffleQueue` en `queue.ts` (tests incluidos); botón en la barra de la playlist y en el reproductor (activar/desactivar en marcha conserva la canción actual; la cola original está en `base`).

## Paso 10 — Búsqueda manual (hecho; 67 tests OK en sandbox; UI NO ejecutada ni comprobada con tsc fuera del núcleo)
- Sirve para corregir una canción mal asignada o sin resultado: el usuario busca en YT Music y elige el vídeo exacto (queda `manual`, nunca lo pisa un nuevo matching).
- `src/core/matching/manualSearch.ts`: `defaultManualQuery(track)`, `searchManual(track, query, search)` (une búsqueda "Canciones" + sin filtro, sin duplicados, descarta kind 'other', puntúa contra la canción solo como orientación, ordena por score, máx. 15; si falla una búsqueda usa la otra; si fallan ambas lanza).
- `repository.ts`: `resolveManualFromSearch(db, trackId, candidate, result)` (transacción: INSERT OR REPLACE en `candidates` + match manual; necesario porque `getChosenVideos` hace join con `candidates`).
- `src/ui/ManualSearch.tsx`: Modal pageSheet con la canción original, campo de búsqueda (precargado "artista título", busca al abrir), resultados con tipo CANCIÓN/VÍDEO, puntos, motivos/avisos, Elegir / Escuchar; marca "Elegida" el vídeo actual.
- Puntos de entrada: icono lupa en cada `TrackRow` de la playlist (`onSearch`) y botón "Buscar manualmente" en `ReviewScreen` (nueva prop `search`).
- `tests/manualSearch.test.ts` (10 tests). Total esperado: 67.

## Paso 11 — Pestaña Buscar + añadir a playlist (hecho; 76 tests OK en sandbox; UI NO ejecutada)
- **Migración v2** (`SCHEMA_VERSION`=2): `tracks.youtube_id` + índice único parcial. Las canciones añadidas desde la búsqueda no tienen `spotify_id`; se identifican por su vídeo (no se duplican entre playlists). `Track.externalIds.youtubeVideo` ahora se rellena.
- `src/core/search/searchSongs.ts` (`searchSongs`: filtro Canciones, reintento sin filtro, dedupe, máx. 20).
- `repository.ts`: `createPlaylist(db, name)` (playlist propia sin Spotify), `addYoutubeTrackToPlaylist(db, playlistId, input)` (transacción; añade al final; no repite en la misma playlist; deja coincidencia `manual` + candidato para que se vea y reproduzca) y `YoutubeTrackInput`.
- UI: `src/ui/SearchScreen.tsx` (nueva pestaña con lupa en `TabBar`, orden Biblioteca / Buscar / Revisar; tocar resultado = reproducir en el PlayerDock; botón + = añadir), `src/ui/AddToPlaylistSheet.tsx` (lista de playlists + "Nueva playlist"). `App.tsx`: `playSearchResult` (cola de 1 canción), `nowVideoId`.
- **Limitación conocida:** reimportar una playlist de Spotify (`savePlaylist`) reescribe sus canciones y borraría las añadidas a mano a esa misma playlist. Pendiente decidir: proteger o fusionar.
- Pendiente posible: quitar canciones de una playlist, reordenar, resultados de "Vídeos", historial de búsquedas.

## Paso 12 — Reproductor estilo Spotify (hecho; tests del núcleo OK; UI NO ejecutada ni tipada en sandbox)
- Petición del usuario: no mostrar el vídeo al reproducir; interfaz como la del reproductor de Spotify (captura de referencia: cabecera "Reproduciendo desde", portada grande, título/artista, barra de progreso con tiempos, shuffle/anterior/play/siguiente/repetir) pero con nuestra paleta.
- `YouTubePlayer.tsx` reescrito (`forwardRef`, `PlayerHandle`: getCurrentTime/getDuration/seekTo). El iframe va oculto en un contenedor de 1×1 px con overflow hidden (opacity 0.01) montado en App mientras haya canción. **Riesgo no verificado:** si iOS/Expo Go pausara el WebView así, hay que probar con un contenedor mayor o cambiar de motor.
- Nuevos: `Cover.tsx` (miniatura `i.ytimg.com/vi/ID/hqdefault.jpg` recortada al cuadrado; fallback Disc), `Slider.tsx` (PanResponder), `usePlayerProgress.ts` (sondeo cada 500 ms), `MiniPlayer.tsx` (barra compacta con progreso; tocar abre pantalla completa), `NowPlaying.tsx` (Modal fullScreen), `core/player/format.ts` (`formatClock`, `thumbnailUrl`, `clamp01`). `queue.ts`: `RepeatMode`, `nextRepeat`, `nextIndex`. `kit.tsx`: IconBtn tone `light`.
- `App.tsx`: estados `repeat`, `expanded`, `source`; "anterior" vuelve al inicio si han pasado >3 s; repetir uno/todo; `PlayerDock.tsx` ya no se usa (se puede borrar).
- Sin gradiente de fondo (haría falta `expo-linear-gradient`); fondo marrón sólido.

## Siguiente sesión (orden recomendado)
- **Decisión (9-nov-2026):** el usuario NO tiene cuenta Apple Developer, así que no puede instalar builds de EAS en su iPhone: la app seguirá en Expo Go. Reproducción en segundo plano queda APARCADA (el iframe se pausa al bloquear; una vía no oficial de audio seguramente tampoco sería fiable en Expo Go, sin verificar).
- Verificado por el usuario: paso 8 (biblioteca) funciona.
- Candidatos (pendiente de elegir): (a) funciones de reproductor: aleatorio, repetir, mostrar progreso; (b) ✅ HECHO en paso 10 (búsqueda manual); (c) exportar/importar copia de `music.db`; (d) >100 canciones vía OAuth de Spotify (Developer Mode exige Premium: confirmar si lo tiene); (e) pulir UI y nombre de la app.
- Nota Windows: ejecutar `npx tsc --noEmit` y `npx vitest run` DENTRO de `...\MusicProject\music-project`.

## Pendiente de preguntar / decidir
- Método de reproducción en iOS (afecta a segundo plano).
- Si hay que tocar `README.md`, `app.json` (projectId EAS) o añadir `package.json` al repo.
