# ARCHITECTURE.md — Music Project

App iOS de uso personal, sin anuncios: importa playlists de Spotify, encuentra cada canción en YouTube Music y la reproduce. Prioridad técnica: que la canción emparejada sea la correcta.

## 1. Stack

| Capa | Tecnología |
|---|---|
| App | Expo SDK ~58 · React Native 0.88 · React 19 · TypeScript (estricto) |
| Ejecución | Expo Go (sin build nativa propia; sin cuenta Apple Developer) |
| Base de datos | `expo-sqlite` (SQLite local, `music.db`, WAL, foreign keys) |
| Reproducción | `react-native-youtube-iframe` + `react-native-webview` (iframe oficial de YouTube) |
| UI | Componentes propios, `@expo/vector-icons` (Ionicons), `react-native-safe-area-context`, `Animated`/`PanResponder` de RN |
| Tests | Vitest (`npm test`) + `node:sqlite` como BD de prueba (Node ≥ 22.13) |
| Otros (instalados, aún sin uso) | `expo-auth-session`, `expo-secure-store`, `expo-web-browser` (para OAuth de Spotify en el futuro) |

Sin servidor propio: todo corre en el móvil. Los datos (playlists, coincidencias) viven solo en la SQLite del iPhone; se pierden al desinstalar.

## 2. Estructura

```
App.tsx                       Raíz: estado global, navegación por pestañas, cola de reproducción
src/
  models/Track.ts             Track, TrackCandidate, TrackVersion
  core/                       Lógica pura (sin RN ni BD) → 100 % testeable
    matching/
      parseTitle.ts           Limpia títulos de YouTube, extrae feat. y versión
      scoreCandidate.ts       Puntúa candidato vs canción → auto | review | reject
      matchTrack.ts           findCandidates: busca + puntúa + ordena
      matchQueue.ts           runMatching: cola con pausas, cancelación, corte por errores
      manualSearch.ts         Búsqueda manual puntuada (para corregir)
    search/searchSongs.ts     Búsqueda de la pestaña Buscar
    player/queue.ts           buildQueue, shuffle, repetir, nextIndex
    player/format.ts          formatClock, thumbnailUrl
  db/
    database.ts               Interfaz `Db` (abstrae expo-sqlite → permite tests en Node)
    openDb.ts                 Singleton expo-sqlite + migraciones
    migrations.ts             Esquema versionado (PRAGMA user_version), hoy v2
    repository.ts             Todas las consultas/escrituras
    matchingAdapter.ts        Conecta la cola de matching con el repositorio
  importers/
    errors.ts · spotify/{parseUrl,embed,importPlaylist}.ts
  providers/youtubeMusic/
    search.ts                 Cliente del endpoint interno de YT Music
    toCandidate.ts            Resultado de YT → TrackCandidate
  ui/                         Pantallas y componentes (theme, kit, cards, TabBar,
                              SearchScreen, ReviewScreen, ManualSearch, AddToPlaylistSheet,
                              MiniPlayer, NowPlaying, Cover, Slider, YouTubePlayer…)
tests/                        Vitest (81 tests)
```

Principio: **dependencias hacia dentro**. `core/` no importa nada de RN ni de expo; `db/` depende solo de la interfaz `Db`; `ui/` y `App.tsx` unen las piezas. El único archivo que conoce el motor de reproducción es `ui/YouTubePlayer.tsx` (cambiable sin tocar el resto).

## 3. Modelo de datos (SQLite)

- `tracks` — canción interna (`id`, título, artistas JSON, duración, versión, `spotify_id` UNIQUE, `youtube_id` UNIQUE parcial para las añadidas desde la búsqueda).
- `playlists` — `spotify_id` UNIQUE (nulo en playlists propias).
- `playlist_tracks` — PK (playlist, posición) → orden.
- `candidates` — candidatos guardados por canción con score, decisión, motivos, conflictos y avisos. PK (track, provider, external_id).
- `matches` — resultado por canción: `status` ∈ `auto | manual | pending | none`, `video_id`, score.

Migraciones transaccionales y secuenciales. Reglas: una elección `manual` nunca la pisa un nuevo matching; reimportar una playlist de Spotify actualiza en vez de duplicar.

## 4. Flujos principales

**Importar (Spotify).** Se pega el enlace → `parsePlaylistId` → se descarga la página embed pública `open.spotify.com/embed/playlist/{id}` → se lee el JSON de `__NEXT_DATA__` (`trackList`) con búsqueda recursiva tolerante a cambios → `parseTitle` por canción → todo en una transacción. Límite ~100 canciones, sin ISRC ni álbum. No usa la Web API oficial (desde 2026 no devuelve playlists ajenas).

**Matching.** Por canción: `findCandidates` consulta YT Music (filtro «Canciones»; si no hay resultados, reintenta sin filtro) y `scoreCandidate` puntúa:
ISRC +40 · artista principal +25 (secundario +12) · título exacto +15 (similar +10) · duración ±2 s +10 (±5 s +5) · misma versión +10.
Decisión: `auto` (sin conflictos y metadatos estrictos), `review` (score ≥ 40 sin conflicto), `reject`. `runMatching` espacia las búsquedas (800 ms + hasta 50 % aleatorio), admite cancelación y se detiene tras 5 errores seguidos. Las `auto` se guardan solas; las dudosas van a la pestaña Revisar.

**Revisión y corrección.** `ReviewScreen` muestra candidatos guardados (elegir, escuchar, ninguno, saltar). `ManualSearch` permite una búsqueda libre sobre cualquier canción y guarda la elección como `manual`.

**Buscar y añadir.** La pestaña Buscar usa `searchSongs`; un resultado se reproduce directamente o se añade (`addYoutubeTrackToPlaylist`, transaccional, sin duplicar en la misma playlist) a una playlist existente o nueva.

**Reproducción.** `App.tsx` mantiene la cola (`base`/`queue`/`nowIdx`), aleatorio y repetir (off/all/one). `YouTubePlayer` es un iframe oficial en un WebView invisible (recortado al tamaño del botón de play, opacidad 0.05). Detalles críticos aprendidos:
- iOS exige un toque dentro del WebView en la primera reproducción → el reproductor invisible se coloca sobre el botón ▶ del mini-reproductor (`catchTap`) hasta el primer evento `playing`.
- El contenedor nunca cambia de tamaño/posición (iOS pausaba al hacerlo).
- `NowPlaying` es una capa `Animated.View` dentro de la app, **no un `Modal` nativo** (un Modal a pantalla completa saca el WebView de la ventana y lo pausa).
- El progreso se sondea cada 500 ms con `getCurrentTime/getDuration` desde el propio mini-reproductor/pantalla (así `App` no se redibuja).
- Portadas: miniatura `i.ytimg.com/vi/{id}/hqdefault.jpg` recortada al cuadrado (fallback: disco generado).

## 5. UI

Estilo propio: fondo crema, marrón oscuro para superficies de contraste, óxido como color de acción (`ui/theme.ts`, `ui/kit.tsx`). Navegación por pestañas flotantes (Biblioteca / Buscar / Revisar) gestionada con estado en `App.tsx` (sin librería de navegación). Hojas de apoyo (`ManualSearch`, `AddToPlaylistSheet`) son `Modal` `pageSheet`.

## 6. Integraciones no oficiales (riesgo)

Uso personal, aceptado explícitamente por el proyecto:
- **Spotify**: página embed pública (no documentada).
- **YouTube Music**: endpoint interno `youtubei/v1/search` (cliente `WEB_REMIX`), valor de filtro `SONGS_FILTER` tomado de ytmusicapi.
- Ambas pueden cambiar sin aviso; el parseo es tolerante y hay reintentos/diagnóstico, pero pueden romperse.

## 7. Tests y calidad

81 tests Vitest: puntuación y casos de matching, parseo de títulos, importador de Spotify, cliente de YT Music, cola y shuffle, repositorio (con `node:sqlite` en memoria vía adaptador `Db`), búsqueda manual y añadir a playlist. **No hay tests de UI**; las pantallas se verifican a mano en el iPhone. Comandos: `npx vitest run`, `npx tsc --noEmit` (ejecutar dentro de la carpeta del proyecto).

## 8. Limitaciones conocidas

- Sin reproducción en segundo plano (el WebView se pausa al bloquear): haría falta reproductor nativo + build propia (no posible con Expo Go).
- Spotify: máx. ~100 canciones por playlist, sin ISRC.
- Reimportar una playlist de Spotify borra las canciones añadidas a mano a esa misma playlist.
- Algunos vídeos no permiten reproducción embebida (se salta al siguiente).
- Datos solo locales (sin copia de seguridad ni sincronización).
- Pendientes razonables: quitar/reordenar canciones, exportar/importar `music.db`, OAuth de Spotify para listas largas, degradado de fondo (`expo-linear-gradient`).