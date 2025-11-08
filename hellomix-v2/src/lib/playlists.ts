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

function loadPlaylistsFromJSON(): Playlist[] {
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

      // Convert JSON format to Playlist format
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

  return playlists;
}

export function getPlaylistsWithSongs(): Playlist[] {
  return loadPlaylistsFromJSON();
}

function getAllPlaylists(limit?: number, offset: number = 0): Playlist[] {
  const playlists = getPlaylistsWithSongs();
  // Sort by ID descending (newest first)
  const sorted = playlists.sort((a, b) => b.id - a.id);

  if (limit) {
    return sorted.slice(offset, offset + limit);
  }
  return sorted;
}

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
