import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export interface Playlist {
  id: number;
  name: string;
  slug: string;
  link: string;
  songs?: string[]; // YouTube video IDs
}

interface PlaylistJSON {
  id: number;
  name: string;
  slug: string;
  link: string;
  songs: Array<{ url: string }>;
}

export function getPlaylistsWithSongs(): Playlist[] {
  const playlistsDir = join(process.cwd(), 'playlists');
  const files = readdirSync(playlistsDir).filter(f => f.endsWith('.json'));

  const playlists: Playlist[] = [];

  for (const file of files) {
    try {
      const filePath = join(playlistsDir, file);
      const content = readFileSync(filePath, 'utf-8');
      const json: PlaylistJSON = JSON.parse(content);

      // Extract YouTube video IDs from songs array
      const songIds = json.songs
        .map(song => song.url.trim())
        .filter(url => url.length > 0);

      playlists.push({
        id: json.id,
        name: json.name,
        slug: json.slug,
        link: json.link,
        songs: songIds,
      });
    } catch (error) {
      console.warn(`Failed to load playlist from ${file}:`, error);
    }
  }

  // Sort by ID descending (newest first)
  return playlists.sort((a, b) => b.id - a.id);
}

export function getPlaylistsData() {
  return {
    playlists: getPlaylistsWithSongs(),
  };
}

export function truncatePlaylistName(name: string, maxLength: number = 18): string {
  return name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
}

export function getPlaylistImageUrl(playlistName: string): string {
  // Use the album images from the public directory
  return `/albums/${encodeURIComponent(playlistName)}.webp`;
}
