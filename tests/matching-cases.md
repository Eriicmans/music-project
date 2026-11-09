# Casos de prueba manuales del matching

1. Mismo título, artista diferente: debe rechazarse, nunca autoimportarse.
2. Mismo título y artista, duración muy distinta: debe revisarse o rechazarse.
3. ISRC igual, artista y título coherentes: candidato de alta confianza.
4. Versión original frente a versión live: nunca autoimportar.
5. Falta ISRC (lo normal en YouTube): solo `auto` con artista principal + título exacto + duración ±2 s + misma versión; si falta la duración, `review`.
6. Artista invitado: los `feat.` del título se extraen y cuentan como artistas; si solo coincide un artista secundario, nunca `auto`.
7. Títulos con acentos, mayúsculas y signos: normalización equivalente.
8. Dos grabaciones del mismo artista y título: comparar ISRC, duración, álbum y versión.
