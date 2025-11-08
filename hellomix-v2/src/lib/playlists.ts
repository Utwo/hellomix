import { getAllPlaylists} from './json-loader';

export function getPlaylistsData() {
  // Fetch all playlists (no limit)
  const playlists = getAllPlaylists();

  return {
    playlists,
  };
}

export function truncatePlaylistName(name: string, maxLength: number = 18): string {
  if (name.length > maxLength) {
    return name.substring(0, maxLength) + '...';
  }
  return name;
}

export function getPlaylistImageUrl(playlistName: string): string {
  // Use the album images from the public directory
  return `/album/${encodeURIComponent(playlistName)}.jpg`;
}
