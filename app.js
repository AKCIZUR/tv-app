const API_BASE = "https://iptv-proxy-kslb.onrender.com";

const video = document.getElementById("video");
const gridContainer = document.getElementById("gridContainer");
const gridOverlay = document.getElementById("gridOverlay");
const gridBtn = document.getElementById("gridBtn");
const centerPlayBtn = document.getElementById("centerPlayBtn");
const muteBtn = document.getElementById("muteBtn");
const volumeIcon = document.getElementById("volumeIcon");
const volumeSlider = document.getElementById("volumeSlider");
const volumeWrapper = document.getElementById("volumeWrapper");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const channelLogo = document.getElementById("channelLogo");
const channelName = document.getElementById("channelName");
const programNow = document.getElementById("programNow");
const programNext = document.getElementById("programNext");
const programProgressBar = document.getElementById("programProgressBar");

let activeIndex = 0;
let hoverIndex = 0;
let hls = null;
let idleTimer = null;
let volumeTimer = null;
let isPlaying = false;
let guideData = {};
let guideTimer = null;

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function updateProgramUI(stream) {
  const data = guideData[stream.name];
  if (!data || !data.now) {
    programNow.textContent = "EPG není dostupné";
    programNext.textContent = "";
    programProgressBar.style.width = "0%";
    return;
  }

  const now = data.now;
  const next = data.next;

  programNow.textContent = `${now.title || "Bez názvu"} • ${formatTime(now.start)}–${formatTime(now.stop)}`;
  programNext.textContent = next ? `Další: ${next.title || "Bez názvu"} • ${formatTime(next.start)}–${formatTime(next.stop)}` : "Další: —";

  const start = new Date(now.start).getTime();
  const stop = new Date(now.stop).getTime();
  const current = Date.now();
  const pct = Math.max(0, Math.min(100, ((current - start) / (stop - start)) * 100));
  programProgressBar.style.width = `${pct}%`;
}

async function loadGuide() {
  try {
    const res = await fetch(`${API_BASE}/guide`, { cache: "no-store" });
    const data = await res.json();
    guideData = data.channels || {};
    updateProgramUI(streams[activeIndex]);
  } catch {
    programNow.textContent = "EPG se nenačetlo";
    programNext.textContent = "";
    programProgressBar.style.width = "0%";
  }
}

streams.forEach((stream, index) => {
  const item = document.createElement("div");
  item.className = "GridItem" + (index === 0 ? " active" : "");
  item.innerHTML = `<img src="${stream.logo}" alt="${stream.name}" draggable="false" />`;
  item.dataset.index = index;
  item.addEventListener("mouseenter", () => {
    hoverIndex = index;
    document.querySelectorAll(".GridItem").forEach(el => el.classList.remove("hovered"));
    item.classList.add("hovered");
  });
  item.addEventListener("mouseleave", () => {
    item.classList.remove("hovered");
  });
  item.addEventListener("click", () => {
    selectChannel(index);
    closeGrid();
  });
  gridContainer.appendChild(item);
});

const gridItems = document.querySelectorAll(".GridItem");

function loadStream(url) {
  if (hls) {
    hls.destroy();
    hls = null;
  }

  if (window.Hls && Hls.isSupported()) {
    hls = new Hls({ enableWorker: true, lowLatencyMode: true });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {});
    });
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = url;
    video.play().catch(() => {});
  }
}

function selectChannel(index) {
  if (index < 0) index = streams.length - 1;
  if (index >= streams.length) index = 0;

  activeIndex = index;
  hoverIndex = index;
  loadStream(streams[index].url);

  channelLogo.src = streams[index].logo;
  channelName.textContent = streams[index].name;
  updateProgramUI(streams[index]);

  gridItems.forEach((el, i) => {
    el.classList.toggle("active", i === index);
  });

  if (video.paused) {
    video.play().catch(() => {});
    isPlaying = true;
  } else {
    isPlaying = true;
  }
  updatePlayIcon();
  resetIdleTimer();
}

function updatePlayIcon() {
  const svg = centerPlayBtn.querySelector("svg");
  if (isPlaying) {
    svg.innerHTML = `<rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />`;
  } else {
    svg.innerHTML = `<polygon points="5 3 19 12 5 21 5 3" />`;
  }
}

function togglePlay() {
  if (video.paused) {
    video.play().catch(() => {});
    isPlaying = true;
  } else {
    video.pause();
    isPlaying = false;
  }
  updatePlayIcon();
  resetIdleTimer();
}

function openGrid() {
  gridItems.forEach(el => {
    el.classList.remove("hovered");
    if (parseInt(el.dataset.index) === activeIndex) {
      el.classList.add("hovered");
    }
  });
  hoverIndex = activeIndex;
  gridOverlay.classList.add("active");
  resetIdleTimer();
}

function closeGrid() {
  gridOverlay.classList.remove("active");
  resetIdleTimer();
}

function toggleGrid() {
  if (gridOverlay.classList.contains("active")) {
    closeGrid();
  } else {
    openGrid();
  }
}

function setActiveUI() {
  document.body.classList.remove("IdleUI");
}

function setIdleUI() {
  document.body.classList.add("IdleUI");
  volumeWrapper.classList.remove("open");
}

function resetIdleTimer() {
  setActiveUI();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(setIdleUI, 3000);
}

video.volume = 1;
volumeSlider.value = 100;

function updateVolumeIcon() {
  if (video.muted || video.volume === 0) {
    volumeIcon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`;
  } else {
    volumeIcon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19 5C21 7 22 9.5 22 12C22 14.5 21 17 19 19"></path><path d="M15.5 8C16.8 9.2 17.5 10.5 17.5 12C17.5 13.5 16.8 14.8 15.5 16"></path>`;
  }
}

volumeSlider.addEventListener("input", () => {
  video.volume = volumeSlider.value / 100;
  video.muted = volumeSlider.value == 0;
  updateVolumeIcon();
  resetIdleTimer();
  clearTimeout(volumeTimer);
  volumeWrapper.classList.add("open");
  volumeTimer = setTimeout(() => {
    if (!volumeWrapper.matches(":hover") && !muteBtn.matches(":hover")) {
      volumeWrapper.classList.remove("open");
    }
  }, 2000);
});

muteBtn.addEventListener("click", () => {
  if (video.muted || video.volume === 0) {
    video.muted = false;
    if (video.volume <= 0) video.volume = 1;
    volumeSlider.value = Math.round(video.volume * 100);
  } else {
    video.muted = true;
    volumeSlider.value = 0;
  }
  updateVolumeIcon();
  resetIdleTimer();
  volumeWrapper.classList.add("open");
  clearTimeout(volumeTimer);
  volumeTimer = setTimeout(() => {
    if (!volumeWrapper.matches(":hover") && !muteBtn.matches(":hover")) {
      volumeWrapper.classList.remove("open");
    }
  }, 2000);
});

muteBtn.addEventListener("mouseenter", () => {
  volumeWrapper.classList.add("open");
  clearTimeout(volumeTimer);
  resetIdleTimer();
});

volumeWrapper.addEventListener("mouseleave", () => {
  volumeTimer = setTimeout(() => {
    if (!volumeWrapper.matches(":hover") && !muteBtn.matches(":hover")) {
      volumeWrapper.classList.remove("open");
    }
  }, 2000);
});

volumeWrapper.addEventListener("mouseenter", () => {
  clearTimeout(volumeTimer);
});

video.addEventListener("volumechange", () => {
  volumeSlider.value = Math.round((video.volume || 0) * 100);
  updateVolumeIcon();
});

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

fullscreenBtn.addEventListener("click", toggleFullscreen);

document.addEventListener("dblclick", (e) => {
  if (!e.target.closest(".ControlsContainer") && !e.target.closest(".GridOverlay") && !e.target.closest(".CenterPlayOverlay")) {
    toggleFullscreen();
  }
});

centerPlayBtn.addEventListener("click", togglePlay);
gridBtn.addEventListener("click", toggleGrid);

gridOverlay.addEventListener("click", (e) => {
  if (e.target === gridOverlay) closeGrid();
});

window.addEventListener("mousemove", resetIdleTimer, { passive: true });
window.addEventListener("mousedown", resetIdleTimer, { passive: true });
window.addEventListener("touchstart", resetIdleTimer, { passive: true });

window.addEventListener("keydown", (e) => {
  resetIdleTimer();
  const isGridOpen = gridOverlay.classList.contains("active");

  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    if (isGridOpen) {
      const targetItem = document.querySelector(`.GridItem[data-index="${hoverIndex}"]`);
      if (targetItem) {
        selectChannel(hoverIndex);
        closeGrid();
      } else {
        closeGrid();
      }
    } else {
      togglePlay();
    }
  }

  if (e.key === "Escape" && isGridOpen) closeGrid();

  if (e.key === "ArrowRight") {
    if (isGridOpen) {
      const next = (hoverIndex + 1) % streams.length;
      hoverIndex = next;
      gridItems.forEach(el => {
        el.classList.remove("hovered");
        if (parseInt(el.dataset.index) === hoverIndex) el.classList.add("hovered");
      });
    } else {
      selectChannel((activeIndex + 1) % streams.length);
    }
  }

  if (e.key === "ArrowLeft") {
    if (isGridOpen) {
      const prev = (hoverIndex - 1 + streams.length) % streams.length;
      hoverIndex = prev;
      gridItems.forEach(el => {
        el.classList.remove("hovered");
        if (parseInt(el.dataset.index) === hoverIndex) el.classList.add("hovered");
      });
    } else {
      selectChannel((activeIndex - 1 + streams.length) % streams.length);
    }
  }

  if (e.key === "f") toggleFullscreen();

  if (e.key === "ArrowUp") {
    video.volume = Math.min(1, video.volume + 0.05);
    volumeSlider.value = Math.round(video.volume * 100);
    video.muted = false;
    updateVolumeIcon();
    volumeWrapper.classList.add("open");
    clearTimeout(volumeTimer);
    volumeTimer = setTimeout(() => {
      if (!volumeWrapper.matches(":hover") && !muteBtn.matches(":hover")) {
        volumeWrapper.classList.remove("open");
      }
    }, 2000);
  }

  if (e.key === "ArrowDown") {
    video.volume = Math.max(0, video.volume - 0.05);
    volumeSlider.value = Math.round(video.volume * 100);
    if (video.volume === 0) video.muted = true;
    updateVolumeIcon();
    volumeWrapper.classList.add("open");
    clearTimeout(volumeTimer);
    volumeTimer = setTimeout(() => {
      if (!volumeWrapper.matches(":hover") && !muteBtn.matches(":hover")) {
        volumeWrapper.classList.remove("open");
      }
    }, 2000);
  }
});

window.addEventListener("wheel", (e) => {
  resetIdleTimer();
  if (Math.abs(e.deltaY) > 0) {
    video.muted = false;
    const step = e.deltaY < 0 ? 0.03 : -0.03;
    video.volume = Math.max(0, Math.min(1, video.volume + step));
    volumeSlider.value = Math.round(video.volume * 100);
    if (video.volume === 0) video.muted = true;
    updateVolumeIcon();
    volumeWrapper.classList.add("open");
    clearTimeout(volumeTimer);
    volumeTimer = setTimeout(() => {
      if (!volumeWrapper.matches(":hover") && !muteBtn.matches(":hover")) {
        volumeWrapper.classList.remove("open");
      }
    }, 2000);
  }
}, { passive: true });

async function initGuideLoop() {
  await loadGuide();
  clearInterval(guideTimer);
  guideTimer = setInterval(loadGuide, 60000);
}

updateVolumeIcon();
selectChannel(0);
resetIdleTimer();
initGuideLoop();
