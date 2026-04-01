const API_URL = "https://itunes.apple.com/search?term=top%20hits&entity=song&limit=50";

let songs = [];
let audio = null;


const songGrid = document.getElementById("songGrid");
const searchInput = document.getElementById("searchInput");


async function fetchSongs() {
  try {
    let response = await fetch(API_URL);
    let data = await response.json();

    songs = data.results;
    showSongs(songs);

  } catch (error) {
    console.log("Error:", error);
  }
}


function showSongs(list) {
  songGrid.innerHTML = "";

  list.forEach(function(song) {
    let div = document.createElement("div");
    div.classList.add("card");

    div.innerHTML = `
      <img src="${song.artworkUrl100}">
      <h3>${song.trackName}</h3>
      <p>${song.artistName}</p>
      <button onclick="playSong('${song.previewUrl}')">Play</button>
    `;

    songGrid.appendChild(div);
  });
}


function playSong(url) {
  if (!url) return;

  if (audio) {
    audio.pause();
  }

  audio = new Audio(url);
  audio.play();
}


searchInput.addEventListener("input", function() {
  let text = searchInput.value.toLowerCase();

  let filtered = songs.filter(function(song) {
    return song.trackName.toLowerCase().includes(text);
  });

  showSongs(filtered);
});


fetchSongs();
