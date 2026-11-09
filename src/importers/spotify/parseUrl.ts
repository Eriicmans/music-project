import { ImportError } from '../errors';

const REF = /(?:open|play|embed)\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(?:user\/[^/?#]+\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]{22})/;
const URI = /^spotify:(?:user:[^:]+:)?(playlist|album|track|artist|show|episode):([A-Za-z0-9]{22})$/;
const BARE_ID = /^[A-Za-z0-9]{22}$/;

/** Devuelve el id (22 caracteres) de una playlist a partir de un enlace, URI o id suelto. */
export function parsePlaylistId(input: string): string {
  const text = input.trim();
  if (!text) throw new ImportError('invalid_url', 'Pega un enlace de una playlist de Spotify.');
  if (/^https?:\/\/spotify\.link\//i.test(text)) {
    throw new ImportError('short_link', 'Los enlaces cortos (spotify.link) no se admiten: abre el enlace y copia el de open.spotify.com.');
  }
  const m = REF.exec(text) ?? URI.exec(text);
  if (m) {
    if (m[1] !== 'playlist') {
      throw new ImportError('not_playlist', `Ese enlace es de tipo "${m[1]}", no de una playlist.`);
    }
    return m[2];
  }
  if (BARE_ID.test(text)) return text;
  throw new ImportError('invalid_url', 'No reconozco ese enlace como una playlist de Spotify.');
}
