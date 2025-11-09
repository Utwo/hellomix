(function () {
  let player;
  let progressInterval;
  let escHandler = null;

  async function fetchPlaylistBySlug(slug) {
    if (!slug) return null;

    // Clean the slug - remove any leading/trailing whitespace
    const cleanSlug = slug.trim();
    if (!cleanSlug) return null;

    try {
      const url = `/playlists/${encodeURIComponent(cleanSlug)}.json`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(
          "Failed to fetch playlist:",
          cleanSlug,
          "Status:",
          response.status
        );
        return null;
      }
      const playlistData = await response.json();
      return {
        name: playlistData.name,
        slug: playlistData.slug,
        songs: playlistData.songs?.map((song) => song.url) || [],
      };
    } catch (error) {
      console.error("Error fetching playlist:", cleanSlug, error);
      return null;
    }
  }

  function getFirstVideoId(playlist) {
    if (!playlist.songs?.length) return null;
    const [firstVideo] = playlist.songs
      .map((s) => s.trim())
      .filter(Boolean);
    return firstVideo || null;
  }

  function getPlaylistVideoIds(playlist) {
    if (!playlist.songs?.length) return [];
    return playlist.songs
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(1); // Skip first video as it's the current one
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
      if (!player) {
        console.warn("Player not initialized yet");
        // Try to initialize if YouTube API is available
        if (typeof YT !== "undefined" && typeof YT.Player !== "undefined") {
          loadYouTubeAPI();
        }
        return;
      }
      try {
        // Check if player methods are available
        if (typeof player.getPlayerState !== "function" || typeof player.playVideo !== "function") {
          console.warn("Player methods not available yet");
          return;
        }
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
        // If error, try to reinitialize
        if (typeof YT !== "undefined" && typeof YT.Player !== "undefined") {
          setTimeout(() => {
            initYouTubePlayer();
          }, 500);
        }
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
    if (typeof YT !== "undefined" && typeof YT.Player !== "undefined") {
      // API already loaded, wait a bit for DOM to be ready then initialize
      setTimeout(() => {
        initYouTubePlayer();
      }, 200);
      return;
    }

    // If API is loading, wait for it
    if (window.onYouTubeIframeAPIReady) {
      const originalCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function() {
        if (originalCallback) originalCallback();
        setTimeout(() => {
          initYouTubePlayer();
        }, 200);
      };
      return;
    }

    // Load the API
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript.parentNode.insertBefore(tag, firstScript);
    window.onYouTubeIframeAPIReady = function() {
      setTimeout(() => {
        initYouTubePlayer();
      }, 200);
    };
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

    // Clean up any existing player first
    if (player) {
      try {
        player.destroy();
      } catch (err) {
        // Ignore errors
      }
      player = null;
    }

    const hasSongs = playlist.songs?.length > 0;
    const albumImageUrl = `/albums/${playlist.slug}.webp`;

    const content = hasSongs
      ? `<div id="album"></div>
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
      // Wait a bit for the div to be in the DOM before initializing the player
      setTimeout(() => {
        loadYouTubeAPI();
      }, 100);
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
    // Ensure the container element exists before trying to initialize
    const container = document.getElementById("album");
    if (!container) {
      console.warn("Album container not found, retrying...");
      setTimeout(initYouTubePlayer, 100);
      return;
    }

    // Ensure YouTube API is loaded
    if (typeof YT === "undefined" || typeof YT.Player === "undefined") {
      console.warn("YouTube API not loaded yet, retrying...");
      setTimeout(initYouTubePlayer, 100);
      return;
    }

    // Ensure we have a playlist and video
    if (!window.currentPlaylist || !window.currentPlaylist.songs || window.currentPlaylist.songs.length === 0) {
      console.warn("No playlist or songs available");
      return;
    }

    try {
      // Destroy any existing player first
      if (player) {
        try {
          player.destroy();
        } catch (err) {
          // Ignore errors
        }
        player = null;
      }

      const firstVideoId = getFirstVideoId(window.currentPlaylist);
      const playlistIds = getPlaylistVideoIds(window.currentPlaylist);

      if (!firstVideoId) {
        console.warn("No video ID found");
        return;
      }

      // Create player configuration
      const playerVars = {
        autoplay: 1,
        enablejsapi: 1,
        wmode: "transparent",
      };

      // Add playlist if there are more videos
      if (playlistIds.length > 0) {
        playerVars.playlist = playlistIds.join(",");
      }

      // Create new player instance - let YouTube API create the iframe
      player = new YT.Player("album", {
        width: 1,
        height: 1,
        videoId: firstVideoId,
        playerVars: playerVars,
        events: { onReady: onPlayerReady },
      });
      console.log("YouTube player initialized with video:", firstVideoId);
    } catch (err) {
      console.error("Error initializing YouTube player:", err);
      // Retry after a delay
      setTimeout(initYouTubePlayer, 500);
    }
  }

  function onPlayerReady() {
    console.log("YouTube player ready, starting playback...");

    // Update play button state
    const playPauseBtn = document.querySelector(".player-controls .play-pause");
    if (playPauseBtn) {
      playPauseBtn.textContent = "⏸";
    }

    // Start playing the video automatically when player is ready
    // Use a small delay to ensure the player is fully ready
    setTimeout(() => {
      try {
        if (player && typeof player.playVideo === "function") {
          console.log("Calling playVideo()");
          player.playVideo();

          // Verify it's playing after a short delay
          setTimeout(() => {
            try {
              const state = player.getPlayerState();
              console.log("Player state after playVideo:", state);
              if (state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.BUFFERING) {
                console.warn("Video not playing, retrying...");
                player.playVideo();
              }
            } catch (err) {
              console.error("Error checking player state:", err);
            }
          }, 500);
        } else {
          console.warn("Player or playVideo function not available");
        }
      } catch (err) {
        console.error("Error starting video playback:", err);
        // Retry once after a short delay
        setTimeout(() => {
          try {
            if (player && typeof player.playVideo === "function") {
              console.log("Retrying playVideo()");
              player.playVideo();
            }
          } catch (retryErr) {
            console.error("Error on retry starting video playback:", retryErr);
          }
        }, 500);
      }
    }, 200);

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
    // Ensure modal element exists
    const { pageslide } = getModalElements();
    if (!pageslide) {
      console.warn("Modal element not found, retrying...");
      // Retry after a short delay if element doesn't exist yet
      setTimeout(() => checkAndShowModal(slug), 100);
      return;
    }

    // If slug is provided directly, use it
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

    // Otherwise, read from URL
    const mixParam = new URLSearchParams(window.location.search).get("mix");
    if (mixParam) {
      // URLSearchParams.get() already decodes the value, but trim just in case
      const cleanSlug = mixParam.trim();
      if (!cleanSlug) {
        hideModal();
        return;
      }
      const playlist = await fetchPlaylistBySlug(cleanSlug);
      if (playlist) {
        showPlaylistModal(playlist);
      } else {
        console.warn("Playlist not found for mix param:", cleanSlug);
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
  function initOnLoad() {
    checkAndShowModal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOnLoad);
  } else {
    // DOM already ready, but wait a tick to ensure all scripts are loaded
    setTimeout(initOnLoad, 0);
  }

  // Handle browser back/forward buttons
  window.addEventListener("popstate", checkAndShowModal);

  // Expose functions globally
  window.hidePlaylistModal = hideModal;
  window.checkAndShowModal = checkAndShowModal;
})();
