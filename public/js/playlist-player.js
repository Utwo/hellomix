(function () {
  let player;
  let progressInterval;
  let escHandler = null;
  let youtubeApiLoading = false;
  let youtubeApiReady = false;
  let videoTitles = {}; // Cache for video titles

  // Initialize YouTube API
  function initYouTubeAPI() {
    // Check if API is already loaded
    if (typeof YT !== "undefined" && YT.Player) {
      youtubeApiReady = true;
      youtubeApiLoading = false;
      return;
    }

    // If already setting up callback, don't do it again
    if (youtubeApiLoading) return;
    youtubeApiLoading = true;

    // Wait for YouTube API to load
    const originalCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      youtubeApiReady = true;
      youtubeApiLoading = false;

      // Call original callback if it exists
      if (originalCallback && typeof originalCallback === "function") {
        originalCallback();
      }

      // If we have a playlist ready, try to initialize player
      if (window.currentPlaylist && window.currentVideoIndex !== undefined) {
        setTimeout(() => initializePlayer(), 300);
      }
    };
  }

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
          response.status,
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

  // Construct YouTube playlist URL from song IDs
  function getYouTubePlaylistUrl(songs) {
    if (!songs || songs.length === 0) return null;

    // YouTube supports creating a playlist from multiple video IDs
    // Format: https://www.youtube.com/watch_videos?video_ids=ID1,ID2,ID3
    const videoIds = songs.join(",");
    return `https://www.youtube.com/watch_videos?video_ids=${videoIds}`;
  }

  // Fetch video title from YouTube oEmbed API
  async function fetchVideoTitle(videoId) {
    if (videoTitles[videoId]) {
      return videoTitles[videoId];
    }

    try {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      );
      if (response.ok) {
        const data = await response.json();
        videoTitles[videoId] = data.title;
        return data.title;
      }
    } catch (error) {
      console.error("Error fetching video title:", error);
    }
    return "Unknown Title";
  }

  // Update video name display
  function updateVideoName(videoId) {
    const videoNameEl = document.getElementById("video-name");
    if (videoNameEl) {
      videoNameEl.textContent = "Loading...";
      fetchVideoTitle(videoId).then((title) => {
        if (videoNameEl) {
          videoNameEl.textContent = title;
        }
        // Don't skip based on title - only rely on YouTube player's onError event
        // Title fetch can fail for many reasons (network, rate limiting, etc.)
        // but the video might still be valid and playing
      });
    }
  }

  // Initialize YouTube player
  function initializePlayer() {
    // Check if API is ready
    if (typeof YT === "undefined" || !YT.Player) {
      console.log("YouTube API not ready, retrying...");
      setTimeout(() => initializePlayer(), 200);
      return;
    }

    const { pageslide } = getModalElements();
    if (!pageslide || !window.currentPlaylist) {
      console.log("Modal or playlist not ready, retrying...");
      setTimeout(() => initializePlayer(), 200);
      return;
    }

    const albumDiv = pageslide.querySelector("#album");
    if (!albumDiv) {
      console.log("Album div not found, retrying...");
      setTimeout(() => initializePlayer(), 200);
      return;
    }

    const currentVideoId =
      window.currentPlaylist.songs[window.currentVideoIndex];
    if (!currentVideoId) {
      console.log("No video ID found");
      return;
    }

    // Destroy existing player
    if (player) {
      try {
        player.destroy();
      } catch (err) {
        // Ignore errors
      }
      player = null;
    }

    // Create iframe for YouTube player (hidden)
    albumDiv.innerHTML = `<div id="youtube-player" class="hidden"></div>`;

    try {
      player = new YT.Player("youtube-player", {
        height: "0",
        width: "0",
        videoId: currentVideoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: function (event) {
            console.log("YouTube player ready, starting playback");
            event.target.playVideo();
            updateVideoName(currentVideoId);
            startProgressTracking();
          },
          onStateChange: function (event) {
            if (event.data === YT.PlayerState.ENDED) {
              playNext();
            } else if (event.data === YT.PlayerState.PLAYING) {
              updatePlayPauseButton(true);
            } else if (event.data === YT.PlayerState.PAUSED) {
              updatePlayPauseButton(false);
            }
          },
          onError: function (event) {
            console.error("YouTube player error:", event);
            // If video fails to load, skip to next song
            setTimeout(() => {
              if (window.currentPlaylist) {
                playNext();
              }
            }, 1500);
          },
        },
      });
    } catch (error) {
      console.error("Error creating YouTube player:", error);
      setTimeout(() => initializePlayer(), 500);
    }
  }

  // Start tracking progress for Piecon
  function startProgressTracking() {
    if (progressInterval) {
      clearInterval(progressInterval);
    }

    progressInterval = setInterval(() => {
      if (player && typeof Piecon !== "undefined") {
        try {
          const currentTime = player.getCurrentTime();
          const duration = player.getDuration();
          if (duration > 0) {
            const progress = (currentTime / duration) * 100;
            Piecon.setProgress(progress);
          }
        } catch (err) {
          // Ignore errors
        }
      }
    }, 100);
  }

  // Update play/pause button
  function updatePlayPauseButton(isPlaying) {
    const playPauseBtn = document.querySelector(".play-pause");
    if (playPauseBtn) {
      const playIcon = playPauseBtn.querySelector(".play-icon");
      const pauseIcon = playPauseBtn.querySelector(".pause-icon");
      if (playIcon && pauseIcon) {
        if (isPlaying) {
          playIcon.style.display = "none";
          pauseIcon.style.display = "block";
        } else {
          playIcon.style.display = "block";
          pauseIcon.style.display = "none";
        }
      }
    }
  }

  // Play next video
  function playNext() {
    if (!window.currentPlaylist || !player) return;

    const nextIndex =
      (window.currentVideoIndex + 1) % window.currentPlaylist.songs.length;
    window.currentVideoIndex = nextIndex;
    const nextVideoId = window.currentPlaylist.songs[nextIndex];

    if (nextVideoId) {
      player.loadVideoById(nextVideoId);
      updateVideoName(nextVideoId);
    }
  }

  // Play previous video
  function playPrevious() {
    if (!window.currentPlaylist || !player) return;

    const prevIndex =
      window.currentVideoIndex === 0
        ? window.currentPlaylist.songs.length - 1
        : window.currentVideoIndex - 1;
    window.currentVideoIndex = prevIndex;
    const prevVideoId = window.currentPlaylist.songs[prevIndex];

    if (prevVideoId) {
      player.loadVideoById(prevVideoId);
      updateVideoName(prevVideoId);
    }
  }

  // Toggle play/pause
  function togglePlayPause() {
    if (!player) return;

    try {
      const state = player.getPlayerState();
      if (state === YT.PlayerState.PLAYING) {
        player.pauseVideo();
      } else if (
        state === YT.PlayerState.PAUSED ||
        state === YT.PlayerState.ENDED
      ) {
        player.playVideo();
      }
    } catch (err) {
      console.error("Error toggling play/pause:", err);
    }
  }

  // Setup player controls
  function setupPlayerControls() {
    const prevBtn = document.querySelector(".prev");
    const playPauseBtn = document.querySelector(".play-pause");
    const nextBtn = document.querySelector(".next");

    if (prevBtn) {
      prevBtn.addEventListener("click", playPrevious);
    }

    if (playPauseBtn) {
      playPauseBtn.addEventListener("click", togglePlayPause);
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", playNext);
    }
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
      // Only handle keys when modal is open (not when it has translate-y-full)
      if (pageslide.classList.contains("translate-y-full")) return;

      // Handle Escape key to close modal
      if (e.key === "Escape") {
        hideModal();
        document.removeEventListener("keydown", escHandler);
        escHandler = null;
        return;
      }

      // Handle Spacebar to toggle play/pause
      if (e.key === " " || e.key === "Spacebar") {
        // Prevent default scrolling behavior
        e.preventDefault();

        // Only toggle if player exists and user is not typing in an input
        const activeElement = document.activeElement;
        const isInputFocused =
          activeElement &&
          (activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA" ||
            activeElement.isContentEditable);

        if (!isInputFocused && player) {
          togglePlayPause();
        }
      }
    };
    document.addEventListener("keydown", escHandler);
  }

  function showModal(content) {
    const { pageslide, modalContent } = getModalElements();
    if (!pageslide || !modalContent) return;

    modalContent.innerHTML = content;
    pageslide.classList.remove("translate-y-full");
    setupCloseButton(pageslide);
    setupEscHandler(pageslide);
  }

  function showPlaylistModal(playlist) {
    const { pageslide } = getModalElements();
    if (!pageslide) return;

    const hasSongs = playlist.songs?.length > 0;
    const albumImageUrl = `/albums/${playlist.slug}.webp`;
    const youtubeUrl = hasSongs ? getYouTubePlaylistUrl(playlist.songs) : null;
    const youtubeIcon = youtubeUrl
      ? `<a href="${youtubeUrl}" target="_blank" rel="noopener noreferrer" class="min-w-11 min-h-11 flex items-center justify-center cursor-pointer transition-all duration-200
    rounded-lg hover:text-red-600 bg-neutral-200 dark:bg-neutral-800" aria-label="Open YouTube playlist" title="Open YouTube playlist">
           <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 block">
             <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
           </svg>
         </a>`
      : "";

    const content = hasSongs
      ? `<div id="album" class="hidden"></div>
         <img id="ytplayer" src="${albumImageUrl}" alt="${playlist.name}" class="block m-0 p-0 w-[60px] h-[60px] min-w-[60px] min-h-[60px] shrink-0 rounded object-contain " />
         <div class="player-info flex-1 min-w-0 flex flex-col justify-center gap-1 ">
           <div class="text-xs font-medium text-gray-400 overflow-hidden text-ellipsis whitespace-nowrap">${playlist.name}</div>
           <div id="video-name" class="text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap">Loading...</div>
         </div>
         <div class="player-controls flex items-center shrink-0 relative">
           <button class="prev min-w-11 min-h-11 flex items-center justify-center shrink-0 p-0 border-none text-xl font-medium  cursor-pointer transition-all duration-200 ease-in-out rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-800" aria-label="Previous" title="Previous">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
               <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
             </svg>
           </button>
           <button class="play-pause min-w-11 min-h-11 flex items-center justify-center shrink-0 p-0 border-none text-xl font-medium  cursor-pointer transition-all duration-200 ease-in-out rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-800" aria-label="Play/Pause" title="Play/Pause">
             <svg class="play-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
               <path d="M8 5v14l11-7z"/>
             </svg>
             <svg class="pause-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
               <path d="M6 4h4v16H6zm8 0h4v16h-4z"/>
             </svg>
           </button>
           <button class="next min-w-11 min-h-11 flex items-center justify-center shrink-0 p-0 border-none text-xl font-medium  cursor-pointer transition-all duration-200 ease-in-out rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-800" aria-label="Next" title="Next">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
               <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
             </svg>
           </button>
         </div>
         ${youtubeIcon}
         <a href="#" class="close min-w-11 min-h-11 flex items-center justify-center shrink-0 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-xl font-medium cursor-pointer transition-all duration-200 ease-in-out" aria-label="Close" title="Close">×</a>`
      : `<div class="flex items-center justify-between w-full gap-2">
          <h2 class="font-bold">Playlist Not Found</h2>
          <a href="#" class="close min-w-11 min-h-11 flex items-center justify-center shrink-0 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-xl font-medium cursor-pointer transition-all duration-200 ease-in-out" aria-label="Close" title="Close">×</a>
        </div>`;

    showModal(content);

    if (hasSongs) {
      window.currentPlaylist = playlist;
      window.currentVideoIndex = 0;

      // Setup player controls
      setupPlayerControls();

      // Initialize YouTube API
      initYouTubeAPI();

      // Start initializing player - it will retry until everything is ready
      setTimeout(() => initializePlayer(), 300);
    }

    if (typeof Piecon !== "undefined") {
      Piecon.setOptions({
        color: "#fff007",
        background: "#333",
        shadow: "#444",
      });
    }
  }

  function hideModal() {
    const { pageslide, modalContent } = getModalElements();

    if (pageslide) {
      setTimeout(() => {
        pageslide.classList.add("translate-y-full");
        if (modalContent) modalContent.innerHTML = "";
      }, 300);
    }

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
      `<div class="flex items-center justify-between w-full gap-2">
        <h2 class="font-bold">Playlist Not Found</h2>
        <a href="#" class="close min-w-11 min-h-11 flex items-center justify-center shrink-0 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-xl font-medium cursor-pointer transition-all duration-200 ease-in-out" aria-label="Close" title="Close">×</a>
      </div>`,
    );
  }

  // Initialize on page load
  function initOnLoad() {
    // Initialize YouTube API
    initYouTubeAPI();

    // Check if API is already loaded (script might have loaded before ours)
    if (typeof YT !== "undefined" && YT.Player) {
      youtubeApiReady = true;
    }

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
