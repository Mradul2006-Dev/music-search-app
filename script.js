// --- 1. CONFIGURATION & STATE ---
// Centralizing these makes it easy to tweak app behavior later.
const CONFIG = {
  searchTerm: "top hits",
  maxResults: 50,
  itemsPerPage: 12,
  requestTimeoutMs: 10000,
};

// All the changing data our app cares about lives here.
const state = {
  allSongs: [],
  filteredSongs: [],
  currentPage: 1,
  currentSongIndex: -1,
  isPlaying: false,
  likedTrackIds: new Set(),
};

// --- 2. DOM ELEMENTS ---
// Caching these upfront so we aren't querying the DOM repeatedly.

// Main layout & states
const songGrid = document.getElementById("songGrid");
const songCardTemplate = document.getElementById("songCardTemplate");
const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const errorMessage = document.getElementById("errorMessage");
const emptyState = document.getElementById("emptyState");

// Controls & Filters
const searchInput = document.getElementById("searchInput");
const filterSelect = document.getElementById("filterSelect");
const sortSelect = document.getElementById("sortSelect");
const retryBtn = document.getElementById("retryBtn");

// Pagination
const songCountDisplay = document.getElementById("songCount");
const pageInfoDisplay = document.getElementById("pageInfo");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

// Now Playing Bar (Renamed to be more descriptive)
const vinylDisc = document.getElementById("vinylDisc");
const nowPlayingThumb = document.getElementById("npThumb");
const nowPlayingTitle = document.getElementById("npTitle");
const nowPlayingArtist = document.getElementById("npArtist");
const nowPlayingPlayBtn = document.getElementById("npPlay");
const nowPlayingPlayIcon = document.getElementById("npPlayIcon");
const nowPlayingPrevBtn = document.getElementById("npPrev");
const nowPlayingNextBtn = document.getElementById("npNext");
const nowPlayingLikeBtn = document.getElementById("npLike");
const volumeSlider = document.getElementById("volumeSlider");

// --- 3. AUDIO SETUP ---
const audioPlayer = new Audio();
audioPlayer.volume = Number(volumeSlider.value) / 100;


// --- 4. HELPER UTILITIES ---

const show = (element) => element.classList.remove("hidden");
const hide = (element) => element.classList.add("hidden");

/**
 * Handles the app's visual states (Loading, Error, Empty, or Data).
 */
function setAppStatus({ isLoading = false, errorMsg = null } = {}) {
  hide(loadingState);
  hide(errorState);
  hide(emptyState);

  if (isLoading) {
    show(loadingState);
    songGrid.innerHTML = "";
  } else if (errorMsg) {
    show(errorState);
    errorMessage.textContent = errorMsg;
    songGrid.innerHTML = "";
  }
}


// --- 5. UI & RENDERING ---

/**
 * Extracts unique artists from our fetched songs and populates the dropdown.
 */
function populateArtistFilter() {
  // Use a Set to get unique artist names, remove blanks, and sort alphabetically
  const uniqueArtists = [...new Set(state.allSongs.map(s => s.artistName).filter(Boolean))].sort();
  
  filterSelect.innerHTML = '<option value="all">All Artists</option>';
  uniqueArtists.forEach((artist) => {
    const option = document.createElement("option");
    option.value = artist;
    option.textContent = artist;
    filterSelect.appendChild(option);
  });
}

/**
 * Updates the pagination text and enables/disables the prev/next buttons.
 */
function updatePaginationUI() {
  const totalPages = Math.max(1, Math.ceil(state.filteredSongs.length / CONFIG.itemsPerPage));
  
  // Prevent currentPage from exceeding total pages if we filtered down
  state.currentPage = Math.min(state.currentPage, totalPages);
  
  pageInfoDisplay.textContent = `Page ${state.currentPage} of ${totalPages}`;
  prevBtn.disabled = state.currentPage === 1;
  nextBtn.disabled = state.currentPage === totalPages || state.filteredSongs.length === 0;
}

/**
 * Syncs the play/pause icons on individual song cards.
 */
function syncCardPlayButtons() {
  const playButtons = songGrid.querySelectorAll(".play-btn");

  playButtons.forEach((button) => {
    const isCurrentSong = Number(button.dataset.songIndex) === state.currentSongIndex;
    const icon = button.querySelector("i");
    
    icon.className = (isCurrentSong && state.isPlaying) 
      ? "ph ph-pause" 
      : "ph ph-play";
  });
}

/**
 * Updates the bottom "Now Playing" bar with the current song's details.
 */
function updateNowPlayingBar(song) {
  if (!song) {
    nowPlayingThumb.src = "";
    nowPlayingTitle.textContent = "—";
    nowPlayingArtist.textContent = "Select a track";
    nowPlayingLikeBtn.classList.remove("liked");
    return;
  }

  nowPlayingThumb.src = song.artworkUrl100;
  nowPlayingThumb.alt = `${song.trackName} cover art`;
  nowPlayingTitle.textContent = song.trackName;
  nowPlayingArtist.textContent = song.artistName;
  nowPlayingLikeBtn.classList.toggle("liked", state.likedTrackIds.has(song.trackId));
}

/**
 * Master UI update for the player state (icons, vinyl spin, current song).
 */
function syncPlayerUI() {
  nowPlayingPlayIcon.className = state.isPlaying ? "ph ph-pause" : "ph ph-play";
  vinylDisc.classList.toggle("playing", state.isPlaying);
  
  const activeSong = state.allSongs[state.currentSongIndex] || null;
  updateNowPlayingBar(activeSong);
  syncCardPlayButtons();
}

/**
 * Renders the visible chunk of songs into the HTML grid based on current page.
 */
function renderSongGrid() {
  songGrid.innerHTML = "";
  
  // Update the total track count header
  const total = state.filteredSongs.length;
  songCountDisplay.textContent = total === 1 ? "1 track" : `${total} tracks`;

  if (total === 0) {
    show(emptyState);
    updatePaginationUI();
    return;
  }

  hide(emptyState);

  // Figure out which slice of the array we need for this page
  const startIndex = (state.currentPage - 1) * CONFIG.itemsPerPage;
  const songsOnPage = state.filteredSongs.slice(startIndex, startIndex + CONFIG.itemsPerPage);

  // Build the cards
  songsOnPage.forEach((song) => {
    const card = songCardTemplate.content.firstElementChild.cloneNode(true);
    
    card.querySelector(".card-img").src = song.artworkUrl100;
    card.querySelector(".card-img").alt = `${song.trackName} artwork`;
    card.querySelector(".card-title").textContent = song.trackName;
    card.querySelector(".card-artist").textContent = song.artistName;
    card.querySelector(".card-album").textContent = song.collectionName;
    card.querySelector(".card-rank").textContent = `#${song.rank}`;

    const playBtn = card.querySelector(".play-btn");
    const likeBtn = card.querySelector(".like-btn");

    playBtn.dataset.songIndex = String(song.songIndex);
    likeBtn.classList.toggle("liked", state.likedTrackIds.has(song.trackId));

    // Card Event Listeners
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // Don't trigger the card click too
      playSong(song.songIndex);
    });

    likeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleLike(song.trackId);
      likeBtn.classList.toggle("liked", state.likedTrackIds.has(song.trackId));
    });

    card.addEventListener("click", () => playSong(song.songIndex));

    songGrid.appendChild(card);
  });

  updatePaginationUI();
  syncCardPlayButtons();
}


// --- 6. CORE LOGIC (Filtering & Playback) ---

/**
 * Applies search text, artist filter, and sorting preferences.
 */
function applyFilters() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedArtist = filterSelect.value;
  
  // 1. Filter
  let results = state.allSongs.filter((song) => {
    const matchesSearch = !query || 
      song.trackName.toLowerCase().includes(query) ||
      song.artistName.toLowerCase().includes(query) ||
      song.collectionName.toLowerCase().includes(query);
      
    const matchesArtist = selectedArtist === "all" || song.artistName === selectedArtist;
    
    return matchesSearch && matchesArtist;
  });

  // 2. Sort
  switch (sortSelect.value) {
    case "az":
      results.sort((a, b) => a.trackName.localeCompare(b.trackName));
      break;
    case "za":
      results.sort((a, b) => b.trackName.localeCompare(a.trackName));
      break;
    case "rank":
    default:
      results.sort((a, b) => a.rank - b.rank);
      break;
  }

  state.filteredSongs = results;
  state.currentPage = 1; // Reset to page 1 on new filter
  renderSongGrid();
}

/**
 * Plays a song based on its absolute index in the `allSongs` array.
 */
function playSong(index) {
  const song = state.allSongs[index];
  
  // Safety check: Needs a valid song with a preview URL
  if (!song?.previewUrl) return;

  // If clicking the currently playing song, pause it instead
  if (state.currentSongIndex === index && !audioPlayer.paused) {
    audioPlayer.pause();
    return;
  }

  state.currentSongIndex = index;
  audioPlayer.src = song.previewUrl;
  
  audioPlayer.play().catch(() => {
    setAppStatus({ errorMsg: "Browser blocked audio playback. Please interact with the page first." });
  });
}

/**
 * Skips forward or backward in the playlist.
 * @param {number} step - Direction to move (1 for next, -1 for prev)
 */
function skipToNext(step) {
  if (state.allSongs.length === 0) return;

  const total = state.allSongs.length;
  let nextIndex = state.currentSongIndex;

  // Keep stepping until we find a track that actually has a preview URL
  // We use a loop up to 'total' times to prevent infinite loops
  for (let attempts = 0; attempts < total; attempts++) {
    // Math logic to wrap around the array (e.g., from last song back to first)
    nextIndex = (nextIndex + step + total) % total; 
    
    if (state.allSongs[nextIndex].previewUrl) {
      playSong(nextIndex);
      return;
    }
  }
}

/**
 * Toggles a track's like status in the set.
 */
function toggleLike(trackId) {
  if (state.likedTrackIds.has(trackId)) {
    state.likedTrackIds.delete(trackId);
  } else {
    state.likedTrackIds.add(trackId);
  }

  // If we just liked/unliked the currently playing song, update the main bar
  if (state.allSongs[state.currentSongIndex]?.trackId === trackId) {
    nowPlayingLikeBtn.classList.toggle("liked", state.likedTrackIds.has(trackId));
  }
}


// --- 7. API FETCHING ---

/**
 * A classic JSONP fetcher. We use this because the iTunes API historically
 * requires JSONP to bypass CORS (Cross-Origin Resource Sharing) restrictions.
 */
function fetchItunesData(term) {
  return new Promise((resolve, reject) => {
    const callbackName = `itunesCallback_${Date.now()}`;
    const script = document.createElement("script");
    
    // Fallback if the request takes too long
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Request timed out while contacting iTunes."));
    }, CONFIG.requestTimeoutMs);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    // This gets called globally by the returned script from iTunes
    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Could not reach the Apple Music service."));
    };

    const params = new URLSearchParams({
      term,
      entity: "song",
      limit: String(CONFIG.maxResults),
      callback: callbackName
    });

    script.src = `https://itunes.apple.com/search?${params.toString()}`;
    document.body.appendChild(script);
  });
}

/**
 * Bootstraps the application data.
 */
async function loadMusic() {
  setAppStatus({ isLoading: true });

  try {
    const response = await fetchItunesData(CONFIG.searchTerm);
    
    // Clean and store the incoming data
    state.allSongs = (response.results || [])
      .filter((song) => song.previewUrl && song.trackName && song.artistName)
      .map((song, index) => ({
        ...song,
        rank: index + 1,      // Assign chart rank
        songIndex: index      // Keep track of absolute position
      }));

    if (state.allSongs.length === 0) {
      throw new Error("No preview tracks found for that search.");
    }

    populateArtistFilter();
    
    // Initialize filter state
    state.filteredSongs = [...state.allSongs];
    
    setAppStatus(); // Clear loading/error states
    renderSongGrid();
    syncPlayerUI();

  } catch (error) {
    setAppStatus({ errorMsg: error.message || "Failed to load tracks. Please try again." });
  }
}


// --- 8. EVENT LISTENERS ---

// Search & Filtering
searchInput.addEventListener("input", applyFilters);
filterSelect.addEventListener("change", applyFilters);
sortSelect.addEventListener("change", applyFilters);

// Pagination Controls
prevBtn.addEventListener("click", () => {
  if (state.currentPage > 1) {
    state.currentPage--;
    renderSongGrid();
  }
});

nextBtn.addEventListener("click", () => {
  const totalPages = Math.ceil(state.filteredSongs.length / CONFIG.itemsPerPage);
  if (state.currentPage < totalPages) {
    state.currentPage++;
    renderSongGrid();
  }
});

retryBtn.addEventListener("click", loadMusic);

// Bottom Player Controls
nowPlayingPlayBtn.addEventListener("click", () => {
  if (state.currentSongIndex === -1) {
    playSong(0); // Play first song if nothing is selected
    return;
  }
  
  if (audioPlayer.paused) {
    audioPlayer.play().catch(() => setAppStatus({ errorMsg: "Playback error." }));
  } else {
    audioPlayer.pause();
  }
});

nowPlayingPrevBtn.addEventListener("click", () => skipToNext(-1));
nowPlayingNextBtn.addEventListener("click", () => skipToNext(1));

nowPlayingLikeBtn.addEventListener("click", () => {
  const currentSong = state.allSongs[state.currentSongIndex];
  if (currentSong) toggleLike(currentSong.trackId);
});

volumeSlider.addEventListener("input", (e) => {
  audioPlayer.volume = Number(e.target.value) / 100;
});

// Audio Element System Events
audioPlayer.addEventListener("play", () => {
  state.isPlaying = true;
  setAppStatus(); // Hide any latent errors
  syncPlayerUI();
});

audioPlayer.addEventListener("pause", () => {
  state.isPlaying = false;
  syncPlayerUI();
});

audioPlayer.addEventListener("ended", () => {
  skipToNext(1); // Auto-advance playlist
});

// --- 9. INIT ---
loadMusic();