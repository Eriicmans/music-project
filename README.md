# Music Project (nombre provisional)

Aplicación iOS de **uso personal** (no comercial): biblioteca musical, importación de playlists de Spotify y reproductor basado en YouTube. Objetivo principal: que cada canción importada sea la correcta, no una homónima de otro artista.

## Estado
Motor de matching probado (ISRC, artista, título, duración, versión). Aún sin persistencia, red ni interfaz real.

## Puesta en marcha
```bash
npm install
npx vitest run      # tests del matching (12)
npx expo start
```
Para compilar iOS desde Windows: `npm i -g eas-cli`, `eas login`, `eas build:configure`, `eas build --platform ios --profile preview` (requiere cuenta Apple Developer para instalar en un iPhone físico).

## Cómo funciona el matching
Cada candidato recibe una puntuación y una decisión: `auto`, `review` o `reject`.
- Nunca se autoacepta con conflicto de artista, versión, título, duración o ISRC.
- Sin ISRC solo se autoacepta con artista principal, título exacto, duración ±2 s y misma versión.
- Los títulos se limpian antes de comparar (feat., Official Video, Lyrics, Remastered, "Artista - ").
- Live, remix, cover, sped up y re-grabaciones se tratan como versiones distintas.

## Decisiones
- Uso personal: se permiten vías no oficiales para buscar en YouTube (la cuota de la API oficial no alcanza para playlists grandes).
- Secretos y tokens fuera del repositorio; tokens en SecureStore.
- Identificadores de proveedor separados de la identidad interna de la canción.

## Hitos
1. ✅ Motor de matching y tests
2. ✅ Parseo de títulos, versiones y feat.
3. Persistencia SQLite y caché de coincidencias
4. Importador de Spotify
5. Búsqueda de candidatos en YouTube
6. Pantalla de revisión de coincidencias
7. Reproductor
