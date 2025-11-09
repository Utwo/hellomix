(function () {
  let player;
  let progressInterval;
  let escHandler = null;

  async function fetchPlaylistBySlug(slug) {
    if (!slug) return null;

    try {
      const response = await fetch(
        `/playlists/${encodeURIComponent(slug)}.json`
      );
      if (!response.ok) {
        console.warn("Failed to fetch playlist:", slug);
        return null;
      }
      const playlistData = await response.json();
      return {
        name: playlistData.name,
        slug: playlistData.slug,
        songs: playlistData.songs?.map((song) => song.url) || [],
      };
    } catch (error) {
      console.error("Error fetching playlist:", error);
      return null;
    }
  }

  async function findPlaylistByName(name) {
    if (!window.PLAYLIST_NAME_TO_SLUG) return null;
    const slug =
      window.PLAYLIST_NAME_TO_SLUG[decodeURIComponent(name).toLowerCase()];
    return slug ? await fetchPlaylistBySlug(slug) : null;
  }

  function buildYouTubeUrl(playlist) {
    if (!playlist.songs?.length) return "";
    const [firstVideo, ...rest] = playlist.songs
      .map((s) => s.trim())
      .filter(Boolean);
    const playlistParam = rest.length ? `&playlist=${rest.join(",")}` : "";
    return `https://www.youtube.com/embed/${firstVideo}?enablejsapi=1&version=3&wmode=transparent&autoplay=1${playlistParam}`;
  }

  function getModalElements() {
    const pageslide = document.getElementById("pageslide");
    return {
      pageslide,
      modalContent: pageslide?.querySelector(".modal-content") || null,
    };
  }

  function setupCloseButton(pageslide) {
    const closeBtn = pageslide.querySelector(".close");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        hideModal();
      });
    }
  }

  function setupEscHandler(pageslide) {
    if (escHandler) {
      document.removeEventListener("keydown", escHandler);
    }
    escHandler = (e) => {
      if (e.key === "Escape" && pageslide.classList.contains("show")) {
        hideModal();
        document.removeEventListener("keydown", escHandler);
        escHandler = null;
      }
    };
    document.addEventListener("keydown", escHandler);
  }

  function setupPlayerControls(pageslide) {
    const controls = pageslide.querySelector(".player-controls");
    if (!controls) return;

    const prevBtn = controls.querySelector(".prev");
    const playPauseBtn = controls.querySelector(".play-pause");
    const nextBtn = controls.querySelector(".next");

    prevBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      if (
        player &&
        window.currentPlaylist?.songs &&
        window.currentVideoIndex > 0
      ) {
        window.currentVideoIndex--;
        try {
          player.loadVideoById(
            window.currentPlaylist.songs[window.currentVideoIndex].trim()
          );
        } catch (err) {
          console.error("Error playing previous:", err);
        }
      }
    });

    playPauseBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      if (!player) return;
      try {
        const isPlaying = player.getPlayerState() === YT.PlayerState.PLAYING;
        if (isPlaying) {
          player.pauseVideo();
          playPauseBtn.textContent = "▶";
        } else {
          player.playVideo();
          playPauseBtn.textContent = "⏸";
        }
      } catch (err) {
        console.error("Error toggling play/pause:", err);
      }
    });

    nextBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      const { currentPlaylist, currentVideoIndex } = window;
      if (
        player &&
        currentPlaylist?.songs &&
        currentVideoIndex < currentPlaylist.songs.length - 1
      ) {
        window.currentVideoIndex++;
        try {
          player.loadVideoById(
            currentPlaylist.songs[window.currentVideoIndex].trim()
          );
        } catch (err) {
          console.error("Error playing next:", err);
        }
      }
    });
  }

  function loadYouTubeAPI() {
    if (typeof YT !== "undefined") {
      initYouTubePlayer();
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript.parentNode.insertBefore(tag, firstScript);
    window.onYouTubeIframeAPIReady = initYouTubePlayer;
  }

  function showModal(content) {
    const { pageslide, modalContent } = getModalElements();
    if (!pageslide || !modalContent) return;

    modalContent.innerHTML = content;
    pageslide.style.display = "block";
    setTimeout(() => pageslide.classList.add("show"), 10);
    document.body.classList.add("modal-open");
    setupCloseButton(pageslide);
    setupEscHandler(pageslide);
  }

  function showPlaylistModal(playlist) {
    const { pageslide } = getModalElements();
    if (!pageslide) return;

    const hasSongs = playlist.songs?.length > 0;
    const youtubeUrl = buildYouTubeUrl(playlist);
    const albumImageUrl = `/albums/${encodeURIComponent(playlist.name)}.webp`;

    const content = hasSongs
      ? `<iframe id="album" type="text/html" width="1" height="1" src="${youtubeUrl}" frameborder="0" allowfullscreen></iframe>
         <img id="ytplayer" src="${albumImageUrl}" alt="${playlist.name}" />
         <div class="player-controls">
           <button class="prev" aria-label="Previous" title="Previous">⏮</button>
           <button class="play-pause" aria-label="Play/Pause" title="Play/Pause">▶</button>
           <button class="next" aria-label="Next" title="Next">⏭</button>
         </div>
         <a href="#" class="close" aria-label="Close" title="Close">×</a>`
      : `<h3>Playlist Not Found</h3>
         <a href="#" class="close" aria-label="Close" title="Close">×</a>`;

    showModal(content);

    if (hasSongs) {
      window.currentPlaylist = playlist;
      window.currentVideoIndex = 0;
      setupPlayerControls(pageslide);
      loadYouTubeAPI();
    }

    if (typeof Piecon !== "undefined") {
      Piecon.setOptions({
        color: "#fff007",
        background: "#333",
        shadow: "#444",
      });
    }
  }

  function initYouTubePlayer() {
    try {
      player = new YT.Player("album", {
        events: { onReady: onPlayerReady },
      });
    } catch (err) {
      console.error("Error initializing YouTube player:", err);
    }
  }

  function onPlayerReady() {
    progressInterval = setInterval(() => {
      try {
        const currentTime = player.getCurrentTime();
        const duration = player.getDuration();
        if (duration > 0) {
          const progress = (Math.floor(currentTime) * 100) / duration;
          if (progress > 100) {
            if (typeof Piecon !== "undefined") Piecon.reset();
            clearInterval(progressInterval);
            progressInterval = null;
            return;
          }
          if (typeof Piecon !== "undefined") Piecon.setProgress(progress);
        }
      } catch (err) {
        // Player not ready yet
      }
    }, 1000);

    player.addEventListener("onStateChange", (event) => {
      const playPauseBtn = document.querySelector(
        ".player-controls .play-pause"
      );
      if (playPauseBtn) {
        playPauseBtn.textContent =
          event.data === YT.PlayerState.PLAYING ? "⏸" : "▶";
      }

      // Auto-play next when video ends
      if (
        event.data === YT.PlayerState.ENDED &&
        window.currentPlaylist?.songs
      ) {
        const { currentPlaylist, currentVideoIndex } = window;
        if (currentVideoIndex < currentPlaylist.songs.length - 1) {
          window.currentVideoIndex++;
          try {
            player.loadVideoById(
              currentPlaylist.songs[window.currentVideoIndex].trim()
            );
            player.playVideo();
          } catch (err) {
            console.error("Error loading next video:", err);
          }
        }
      }
    });
  }

  function hideModal() {
    const { pageslide, modalContent } = getModalElements();

    if (pageslide) {
      pageslide.classList.remove("show");
      setTimeout(() => {
        pageslide.style.display = "none";
        if (modalContent) modalContent.innerHTML = "";
      }, 300);
    }

    document.body.classList.remove("modal-open");

    if (player) {
      try {
        player.destroy();
      } catch (err) {
        // Ignore errors
      }
      player = null;
    }

    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }

    if (typeof Piecon !== "undefined") {
      Piecon.reset();
    }

    if (escHandler) {
      document.removeEventListener("keydown", escHandler);
      escHandler = null;
    }

    window.history.pushState({}, "", "/");
  }

  async function checkAndShowModal(slug) {
    if (slug) {
      const playlist = await fetchPlaylistBySlug(slug);
      if (playlist) {
        showPlaylistModal(playlist);
      } else {
        console.warn("Playlist not found:", slug);
        showPlaylistNotFound();
      }
      return;
    }

    const mixParam = new URLSearchParams(window.location.search).get("mix");
    if (mixParam) {
      const playlist = await findPlaylistByName(mixParam);
      if (playlist) {
        showPlaylistModal(playlist);
      } else {
        console.warn("Playlist not found:", mixParam);
        showPlaylistNotFound();
      }
    } else {
      hideModal();
    }
  }

  function showPlaylistNotFound() {
    showModal(
      '<h3>Playlist Not Found</h3><a href="#" class="close" aria-label="Close" title="Close">×</a>'
    );
  }

  // Initialize on page load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkAndShowModal);
  } else {
    checkAndShowModal();
  }

  // Handle browser back/forward buttons
  window.addEventListener("popstate", checkAndShowModal);

  // Expose functions globally
  window.hidePlaylistModal = hideModal;
  window.checkAndShowModal = checkAndShowModal;
})();
