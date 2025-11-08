(function() {
  var player;
  var progressInterval;

  function findPlaylistByName(name) {
    if (!window.PLAYLISTS_DATA) return null;
    var decodedName = decodeURIComponent(name);
    return window.PLAYLISTS_DATA.find(function(p) {
      return p.name.toLowerCase() === decodedName.toLowerCase();
    }) || null;
  }

  function buildYouTubeUrl(playlist) {
    if (!playlist.songs || playlist.songs.length === 0) return '';
    var firstVideo = playlist.songs[0].trim();
    var remainingVideos = playlist.songs.slice(1).map(function(s) {
      return s.trim();
    }).filter(function(s) { return s.length > 0; }).join(',');
    var playlistParam = remainingVideos ? '&playlist=' + remainingVideos : '';
    return 'https://www.youtube.com/embed/' + firstVideo + '?enablejsapi=1&version=3&wmode=transparent&autoplay=1' + playlistParam;
  }

  function showPlaylistModal(playlist) {
    var pageslide = document.getElementById('pageslide');
    var modalContent = pageslide ? pageslide.querySelector('.modal-content') : null;

    if (!pageslide || !modalContent) return;

    var youtubeUrl = buildYouTubeUrl(playlist);

    var albumImageUrl = '/album-big/' + encodeURIComponent(playlist.name) + '.jpg';

    var html = '';
    if (playlist.songs && playlist.songs.length > 0) {
      html = '<iframe id="album" type="text/html" width="1" height="1" src="' + youtubeUrl + '" frameborder="0" allowfullscreen style="position: absolute; opacity: 0; pointer-events: none;"></iframe>' +
             '<img id="ytplayer" src="' + albumImageUrl + '" alt="' + playlist.name + '" style="width: 60px; height: 60px; min-width: 60px; min-height: 60px; border-radius: 8px; object-fit: contain; background: rgba(0, 0, 0, 0.2); flex-shrink: 0; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); display: block; margin: 0; padding: 0;" />' +
             '<div class="player-controls">' +
             '<button class="prev" aria-label="Previous" title="Previous">⏮</button>' +
             '<button class="play-pause" aria-label="Play/Pause" title="Play/Pause">▶</button>' +
             '<button class="next" aria-label="Next" title="Next">⏭</button>' +
             '</div>' +
             '<a href="#" class="close" aria-label="Close" title="Close">×</a>';
    } else {
      html = '<h3>Playlist Not Found</h3>' +
             '<a href="#" class="close" aria-label="Close" title="Close">×</a>';
    }

    modalContent.innerHTML = html;
    pageslide.style.display = 'block';

    // Trigger animation
    setTimeout(function() {
      pageslide.classList.add('show');
    }, 10);

    document.body.classList.add('modal-open');

    // Setup close button
    var closeBtn = pageslide.querySelector('.close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function(e) {
        e.preventDefault();
        hideModal();
      });
    }

    // Store playlist reference for controls
    window.currentPlaylist = playlist;
    window.currentVideoIndex = 0;

    // Setup player control buttons
    var controls = pageslide.querySelector('.player-controls');
    if (controls) {
      var prevBtn = controls.querySelector('.prev');
      var playPauseBtn = controls.querySelector('.play-pause');
      var nextBtn = controls.querySelector('.next');

      if (prevBtn) {
        prevBtn.addEventListener('click', function(e) {
          e.preventDefault();
          if (player && window.currentPlaylist?.songs && window.currentVideoIndex > 0) {
            try {
              window.currentVideoIndex--;
              player.loadVideoById(window.currentPlaylist.songs[window.currentVideoIndex].trim());
            } catch(e) {
              console.error('Error playing previous:', e);
            }
          }
        });
      }

      if (playPauseBtn) {
        playPauseBtn.addEventListener('click', function(e) {
          e.preventDefault();
          if (player) {
            try {
              var state = player.getPlayerState();
              if (state === YT.PlayerState.PLAYING) {
                player.pauseVideo();
                playPauseBtn.textContent = '▶';
              } else {
                player.playVideo();
                playPauseBtn.textContent = '⏸';
              }
            } catch(e) {
              console.error('Error toggling play/pause:', e);
            }
          }
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', function(e) {
          e.preventDefault();
          if (player && window.currentPlaylist?.songs && window.currentVideoIndex < window.currentPlaylist.songs.length - 1) {
            try {
              window.currentVideoIndex++;
              player.loadVideoById(window.currentPlaylist.songs[window.currentVideoIndex].trim());
            } catch(e) {
              console.error('Error playing next:', e);
            }
          }
        });
      }
    }

    // Close on ESC key
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape' && pageslide.classList.contains('show')) {
        hideModal();
        document.removeEventListener('keydown', escHandler);
      }
    });

    // Initialize YouTube player if available
    if (typeof YT !== 'undefined') {
      initYouTubePlayer();
    } else {
      var tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      var firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = function() {
        initYouTubePlayer();
      };
    }

    // Initialize Piecon if available
    if (typeof Piecon !== 'undefined') {
      Piecon.setOptions({ color: '#fff007', background: '#333', shadow: '#444' });
    }
  }

  function initYouTubePlayer() {
    try {
      player = new YT.Player('album', {
        events: {
          'onReady': onPlayerReady
        }
      });
    } catch(e) {
      console.error('Error initializing YouTube player:', e);
    }
  }

  function onPlayerReady(event) {
    var count = 0;
    progressInterval = setInterval(function() {
      if (count > 100) {
        if (typeof Piecon !== 'undefined') {
          Piecon.reset();
        }
        clearInterval(progressInterval);
        return false;
      }
      try {
        var currentTime = player.getCurrentTime();
        var duration = player.getDuration();
        if (duration > 0) {
          count = (Math.floor(currentTime) * 100) / duration;
          if (typeof Piecon !== 'undefined') {
            Piecon.setProgress(count);
          }
        }
      } catch(e) {
        // Player not ready yet
      }
    }, 1000);

    // Update play/pause button state and track video changes
    player.addEventListener('onStateChange', function(event) {
      var playPauseBtn = document.querySelector('.player-controls .play-pause');
      if (playPauseBtn) {
        playPauseBtn.textContent = event.data === YT.PlayerState.PLAYING ? '⏸' : '▶';
      }

      // Auto-play next when video ends
      if (event.data === YT.PlayerState.ENDED && window.currentPlaylist?.songs) {
        if (window.currentVideoIndex < window.currentPlaylist.songs.length - 1) {
          window.currentVideoIndex++;
          player.loadVideoById(window.currentPlaylist.songs[window.currentVideoIndex].trim());
          player.playVideo();
        }
      }
    });
  }

  function hideModal() {
    var pageslide = document.getElementById('pageslide');
    var modalContent = pageslide ? pageslide.querySelector('.modal-content') : null;

    if (pageslide) {
      pageslide.classList.remove('show');

      // Wait for animation to complete before hiding
      setTimeout(function() {
        pageslide.style.display = 'none';
        if (modalContent) {
          modalContent.innerHTML = '';
        }
      }, 300);
    }

    document.body.classList.remove('modal-open');

    if (player) {
      try {
        player.destroy();
      } catch(e) {
        // Ignore errors
      }
      player = null;
    }
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    if (typeof Piecon !== 'undefined') {
      Piecon.reset();
    }

    // Update URL without mix parameter
    window.history.pushState({}, '', '/');
  }

  function checkAndShowModal() {
    var urlParams = new URLSearchParams(window.location.search);
    var mixParam = urlParams.get('mix');

    if (mixParam) {
      var playlist = findPlaylistByName(mixParam);
      if (playlist) {
        showPlaylistModal(playlist);
      } else {
        console.warn('Playlist not found:', mixParam);
        var pageslide = document.getElementById('pageslide');
        var modalContent = pageslide ? pageslide.querySelector('.modal-content') : null;

        if (pageslide && modalContent) {
          modalContent.innerHTML = '<h3>Playlist Not Found</h3><a href="#" class="close" aria-label="Close" title="Close">×</a>';
          pageslide.style.display = 'block';

          setTimeout(function() {
            pageslide.classList.add('show');
          }, 10);

          document.body.classList.add('modal-open');

          var closeBtn = pageslide.querySelector('.close');
          if (closeBtn) {
            closeBtn.addEventListener('click', function(e) {
              e.preventDefault();
              hideModal();
            });
          }
        }
      }
    } else {
      hideModal();
    }
  }

  // Check on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndShowModal);
  } else {
    checkAndShowModal();
  }

  // Listen for popstate (back/forward buttons)
  window.addEventListener('popstate', checkAndShowModal);

  // Expose functions globally
  window.hidePlaylistModal = hideModal;
  window.checkAndShowModal = checkAndShowModal;
})();
