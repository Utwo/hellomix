# Hello mix

A modern music playlist website that pays homage to the original **designers.mx** platform. Browse curated playlists, discover new music, and enjoy a seamless listening experience.

## 🎵 Features

- **Playlist Gallery** - Browse hundreds of curated playlists with beautiful album artwork
- **Music Player** - Seamless YouTube-based playback with a clean, minimal interface
- **Shuffle Mode** - Discover random playlists with a single click
- **Responsive Design** - Optimized for all devices with adaptive layouts
- **Dark/Light Mode** - Automatically adapts to your system preferences

## 🚀 Project Structure

```
/
├── public/
│   ├── albums/          # Playlist album artwork (WebP format)
│   ├── playlists/       # Playlist JSON data files
│   └── js/              # Client-side JavaScript (playlist player)
├── src/
│   ├── layouts/         # Astro layout components
│   ├── pages/           # Site pages (index, about)
│   ├── styles/          # Global CSS styles
│   └── all-playlists.json  # Playlist metadata
└── package.json
```

## 🛠️ Tech Stack

- **Astro** - Static site generator for optimal performance
- **Vanilla JavaScript** - Lightweight client-side interactions
- **CSS** - Modern styling with responsive design
- **YouTube API** - Music playback integration

## 📦 Installation

```sh
# Install dependencies
pnpm install
```

## 🧞 Commands

All commands are run from the root of the project:

| Command          | Action                                           |
| :--------------- | :----------------------------------------------- |
| `pnpm dev`       | Starts local dev server at `localhost:4321`      |
| `pnpm build`     | Build your production site to `./dist/`          |
| `pnpm preview`   | Preview your build locally, before deploying     |
| `pnpm astro ...` | Run CLI commands like `astro add`, `astro check` |

## 🎨 About

This website is a homage to the original **designers.mx** website, which curated music playlists for designers. The project aims to capture that same spirit and bring it back to life with modern web technologies.

Built with a focus on performance, simplicity, and user experience - allowing the music and playlists to take center stage.
