/* ═══════════════════════════════════════════════════════════════════════
   NeuroFlash™ Simon Game Pro — game.js
   Author: Affa Saleem | Version: 2.0.0
   ═══════════════════════════════════════════════════════════════════════
   IMPORTANT: Original Simon Game logic is PRESERVED intact.
   All new features are layered around the original functions.
   ═══════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════
   ░░░  SECTION 1: GAME STATE VARIABLES  ░░░
   These variables keep track of what's happening in the game.
   ════════════════════════════════════════════════════════════════════════ */
// The 4 possible colours Simon can choose from
const buttonColours = ["red", "blue", "green", "yellow"];

// This array stores the sequence of colours Simon has generated so far
let gamePattern = [];

// This array stores the sequence of colours the user has clicked this round
let userClickedPattern = [];

// Keeps track of whether the game is currently running
let started = false;

// Keeps track of the current level the player is on
let level = 0;

// Keeps track of the selected game mode ("normal" or "reverse")
let gameMode = "normal";

/* ════════════════════════════════════════════════════════════════════════
   ░░░  SECTION 2: STORAGE MANAGER  ░░░
   Handles all localStorage read/write operations.
   ════════════════════════════════════════════════════════════════════════ */
const StorageManager = {
  KEYS: {
    HIGH_SCORE:    "nf_highScore",
    TOTAL_GAMES:   "nf_totalGames",
    TOTAL_WINS:    "nf_totalWins",
    ACHIEVEMENTS:  "nf_achievements",
    THEME:         "nf_theme",
    VOLUME:        "nf_volume",
    MUTED:         "nf_muted",
  },

  get(key, fallback = 0) {
    const val = localStorage.getItem(key);
    return val !== null ? JSON.parse(val) : fallback;
  },

  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  getHighScore()   { return this.get(this.KEYS.HIGH_SCORE, 0); },
  getTotalGames()  { return this.get(this.KEYS.TOTAL_GAMES, 0); },
  getTotalWins()   { return this.get(this.KEYS.TOTAL_WINS, 0); },
  getAchievements(){ return this.get(this.KEYS.ACHIEVEMENTS, []); },
  getTheme()       { return this.get(this.KEYS.THEME, "dark"); },
  getVolume()      { return this.get(this.KEYS.VOLUME, 0.8); },
  getMuted()       { return this.get(this.KEYS.MUTED, false); },

  saveHighScore(val)    { this.set(this.KEYS.HIGH_SCORE, val); },
  saveTotalGames(val)   { this.set(this.KEYS.TOTAL_GAMES, val); },
  saveTotalWins(val)    { this.set(this.KEYS.TOTAL_WINS, val); },
  saveAchievements(arr) { this.set(this.KEYS.ACHIEVEMENTS, arr); },
  saveTheme(val)        { this.set(this.KEYS.THEME, val); },
  saveVolume(val)       { this.set(this.KEYS.VOLUME, val); },
  saveMuted(val)        { this.set(this.KEYS.MUTED, val); },

  clearStats() {
    localStorage.removeItem(this.KEYS.HIGH_SCORE);
    localStorage.removeItem(this.KEYS.TOTAL_GAMES);
    localStorage.removeItem(this.KEYS.TOTAL_WINS);
    localStorage.removeItem(this.KEYS.ACHIEVEMENTS);
  }
};

/* ════════════════════════════════════════════════════════════════════════
   ░░░  SECTION 3: ACHIEVEMENT SYSTEM  ░░░
   Defines all achievements and handles unlock logic.
   ════════════════════════════════════════════════════════════════════════ */
const AchievementSystem = {
  definitions: [
    { id: "first_steps",     icon: "🎯", name: "First Steps",     desc: "Complete your first sequence",        condition: (s) => s.totalGames >= 1 },
    { id: "level_5",         icon: "⚡", name: "Quick Learner",   desc: "Reach Level 5",                       condition: (s) => s.level >= 5 },
    { id: "level_10",        icon: "🔥", name: "On Fire",         desc: "Reach Level 10",                      condition: (s) => s.level >= 10 },
    { id: "level_20",        icon: "💎", name: "Diamond Mind",    desc: "Reach Level 20",                      condition: (s) => s.level >= 20 },
    { id: "memory_master",   icon: "👑", name: "Memory Master",   desc: "Score 200+ points",                   condition: (s) => s.score >= 200 },
    { id: "first_win",       icon: "🏆", name: "First Win",       desc: "Complete 10 levels in one run",       condition: (s) => s.level >= 10 && s.totalWins >= 1 },
    { id: "veteran",         icon: "🎖️",  name: "Veteran",         desc: "Play 10 games",                       condition: (s) => s.totalGames >= 10 },
    { id: "perfectionist",   icon: "✨", name: "Perfectionist",   desc: "Reach Level 15",                      condition: (s) => s.level >= 15 },
  ],

  unlockedIds: [],

  init() {
    this.unlockedIds = StorageManager.getAchievements();
    this.renderBadges();
  },

  check(state) {
    this.definitions.forEach(ach => {
      if (!this.unlockedIds.includes(ach.id) && ach.condition(state)) {
        this.unlock(ach);
      }
    });
  },

  unlock(ach) {
    this.unlockedIds.push(ach.id);
    StorageManager.saveAchievements(this.unlockedIds);
    this.renderBadges();
    UIController.showAchievementToast(ach.icon, ach.name);
  },

  renderBadges() {
    const grid = document.getElementById("achievements-grid");
    if (!grid) return;
    grid.innerHTML = "";
    this.definitions.forEach(ach => {
      const span = document.createElement("span");
      span.className = "ach-badge " + (this.unlockedIds.includes(ach.id) ? "unlocked" : "locked");
      span.textContent = ach.icon + " " + ach.name;
      span.title = ach.desc;
      grid.appendChild(span);
    });
  },
};

/* ════════════════════════════════════════════════════════════════════════
   ░░░  SECTION 4: SOUND CONTROLLER  ░░░
   Wraps the original playSound() with mute/volume support.
   ════════════════════════════════════════════════════════════════════════ */
const SoundController = {
  muted: false,
  volume: 0.8,

  init() {
    this.muted  = StorageManager.getMuted();
    this.volume = StorageManager.getVolume();
    this.applyMuteUI();
    document.getElementById("volume-slider").value = this.volume;
  },

  play(name) {
    if (this.muted) return;
    var audio = new Audio("sounds/" + name + ".mp3");
    audio.volume = this.volume;
    audio.play().catch(function() { /* autoplay policy — silently fail */ });
  },

  toggleMute() {
    this.muted = !this.muted;
    StorageManager.saveMuted(this.muted);
    this.applyMuteUI();
  },

  setVolume(val) {
    this.volume = parseFloat(val);
    StorageManager.saveVolume(this.volume);
    if (this.volume > 0 && this.muted) {
      this.muted = false;
      StorageManager.saveMuted(false);
      this.applyMuteUI();
    }
  },

  applyMuteUI() {
    document.getElementById("mute-icon").textContent = this.muted ? "🔇" : "🔊";
  },
};

/* ════════════════════════════════════════════════════════════════════════
   ░░░  SECTION 5: THEME CONTROLLER  ░░░
   Handles dark/light theme toggle and persistence.
   ════════════════════════════════════════════════════════════════════════ */
const ThemeController = {
  current: "dark",

  init() {
    this.current = StorageManager.getTheme();
    this.apply(this.current);
  },

  toggle() {
    this.current = this.current === "dark" ? "light" : "dark";
    this.apply(this.current);
    StorageManager.saveTheme(this.current);
  },

  apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.getElementById("theme-toggle").querySelector(".theme-icon").textContent =
      theme === "dark" ? "☀️" : "🌙";
  },
};

/* ════════════════════════════════════════════════════════════════════════
   ░░░  SECTION 6: STATS CONTROLLER  ░░░
   Updates all dashboard and start-screen stats in the DOM.
   ════════════════════════════════════════════════════════════════════════ */
const StatsController = {
  currentScore: 0,

  init() {
    this.currentScore = 0;
    this.refresh();
  },

  refresh() {
    const best   = StorageManager.getHighScore();
    const games  = StorageManager.getTotalGames();
    const wins   = StorageManager.getTotalWins();

    // Dashboard
    this._setText("dash-best",  best);
    this._setText("dash-games", games);
    this._setText("dash-score", this.currentScore);
    this._setText("dash-level", level);

    // Hero/start screen
    this._setText("hero-best",  best);
    this._setText("hero-games", games);
    this._setText("hero-wins",  wins);

    // Progress bar (max 20 levels)
    const pct = Math.min((level / 20) * 100, 100);
    const fill = document.getElementById("progress-fill");
    const label = document.getElementById("progress-label");
    if (fill)  fill.style.width = pct + "%";
    if (label) label.textContent = "Level " + level + " / 20";

    const container = document.getElementById("progress-bar-container");
    if (container) container.setAttribute("aria-valuenow", level);
  },

  addLevelScore() {
    this.currentScore += 10;
    this.refresh();
    this._bump("dash-score");
    this._bump("dash-level");

    // Check & save high score
    const best = StorageManager.getHighScore();
    if (this.currentScore > best) {
      StorageManager.saveHighScore(this.currentScore);
      this.refresh();
    }
  },

  _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  },

  _bump(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("bump");
    void el.offsetWidth; // reflow to re-trigger animation
    el.classList.add("bump");
  },
};

/* ════════════════════════════════════════════════════════════════════════
   ░░░  SECTION 7: UI CONTROLLER  ░░░
   Handles all show/hide logic for screens and modals.
   ════════════════════════════════════════════════════════════════════════ */
const UIController = {
  _toastTimer: null,

  showStartScreen() {
    document.getElementById("start-screen").classList.remove("hidden");
    document.getElementById("game-area").classList.add("hidden");
  },

  hideStartScreen() {
    document.getElementById("start-screen").classList.add("hidden");
    document.getElementById("game-area").classList.remove("hidden");
  },

  showModal(id) {
    document.getElementById(id).classList.remove("hidden");
    // Focus the panel for accessibility
    const panel = document.querySelector("#" + id + " .modal-panel");
    if (panel) setTimeout(function() { panel.focus(); }, 50);
  },

  hideModal(id) {
    document.getElementById(id).classList.add("hidden");
  },

  showGameOver(score, best, lvl, isNewHigh) {
    document.getElementById("final-score").textContent = score;
    document.getElementById("final-best").textContent  = best;
    document.getElementById("final-level").textContent = lvl;

    const newHighMsg  = document.getElementById("new-high-msg");
    const gameOverIcon = document.getElementById("gameover-icon");

    if (isNewHigh) {
      newHighMsg.classList.remove("hidden");
      gameOverIcon.textContent = "🎉";
    } else {
      newHighMsg.classList.add("hidden");
      gameOverIcon.textContent = "💀";
    }

    this.showModal("gameover-modal");
  },

  showAchievementToast(icon, name) {
    const toast = document.getElementById("achievement-toast");
    document.getElementById("toast-icon").textContent = icon;
    document.getElementById("toast-name").textContent = name;

    toast.classList.remove("hidden");

    // Auto-hide after 3.5 seconds
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(function() {
      toast.classList.add("hidden");
    }, 3500);
  },

  setButtonsDisabled(disabled) {
    $(".btn").toggleClass("disabled", disabled).attr("aria-pressed", false);
  },

  setButtonPressed(colour, pressed) {
    $("#" + colour).attr("aria-pressed", pressed ? "true" : "false");
  },
};

/* ════════════════════════════════════════════════════════════════════════
   ░░░  SECTION 8: PARTICLE SYSTEM  ░░░
   Animated floating particles in the background canvas.
   ════════════════════════════════════════════════════════════════════════ */
const ParticleSystem = {
  canvas: null,
  ctx: null,
  particles: [],
  animId: null,

  init() {
    this.canvas = document.getElementById("particle-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.resize();
    this.createParticles();
    this.animate();
    window.addEventListener("resize", () => { this.resize(); this.createParticles(); });
  },

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  createParticles() {
    this.particles = [];
    const count = Math.floor((window.innerWidth * window.innerHeight) / 15000);
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x:       Math.random() * this.canvas.width,
        y:       Math.random() * this.canvas.height,
        r:       Math.random() * 2 + 0.5,
        dx:      (Math.random() - 0.5) * 0.4,
        dy:      -Math.random() * 0.5 - 0.1,
        opacity: Math.random() * 0.5 + 0.1,
        color:   ["#a78bfa", "#60a5fa", "#f472b6", "#34d399"][Math.floor(Math.random() * 4)],
      });
    }
  },

  animate() {
    this.animId = requestAnimationFrame(() => this.animate());
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles.forEach(p => {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.opacity;
      this.ctx.fill();
      p.x += p.dx;
      p.y += p.dy;
      if (p.y < -10) { p.y = this.canvas.height + 10; p.x = Math.random() * this.canvas.width; }
      if (p.x < -10) p.x = this.canvas.width + 10;
      if (p.x > this.canvas.width + 10) p.x = -10;
    });
    this.ctx.globalAlpha = 1;
  },
};

/* ════════════════════════════════════════════════════════════════════════
   ░░░  SECTION 9: CONFETTI CONTROLLER  ░░░
   Launches canvas confetti on a new high score.
   ════════════════════════════════════════════════════════════════════════ */
const ConfettiController = {
  canvas: null,
  ctx: null,
  pieces: [],
  running: false,
  animId: null,

  init() {
    this.canvas = document.getElementById("confetti-canvas");
    this.ctx    = this.canvas.getContext("2d");
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    window.addEventListener("resize", () => {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
    });
  },

  launch() {
    this.pieces = [];
    const colors = ["#a78bfa","#60a5fa","#f472b6","#facc15","#34d399","#fb923c"];
    for (let i = 0; i < 160; i++) {
      this.pieces.push({
        x:     Math.random() * this.canvas.width,
        y:     Math.random() * this.canvas.height - this.canvas.height,
        w:     Math.random() * 10 + 5,
        h:     Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot:   Math.random() * 360,
        rotV:  (Math.random() - 0.5) * 6,
        dy:    Math.random() * 3 + 2,
        dx:    (Math.random() - 0.5) * 2,
        fade:  0,
      });
    }
    this.running = true;
    this._animate();
    // Stop after 4 seconds
    setTimeout(() => { this.running = false; }, 4000);
  },

  _animate() {
    if (!this.running && this.pieces.length === 0) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    requestAnimationFrame(() => this._animate());
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.pieces.forEach(p => {
      p.y   += p.dy;
      p.x   += p.dx;
      p.rot += p.rotV;
      p.fade += this.running ? 0 : 0.02;
      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rot * Math.PI) / 180);
      this.ctx.globalAlpha = Math.max(0, 1 - p.fade);
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      this.ctx.restore();
    });
    this.ctx.globalAlpha = 1;
    // Remove off-screen pieces
    this.pieces = this.pieces.filter(p => p.y < this.canvas.height + 20 && p.fade < 1);
  },
};

/* ════════════════════════════════════════════════════════════════════════
   ░░░  SECTION 10: RIPPLE EFFECT  ░░░
   Creates a ripple on button click.
   ════════════════════════════════════════════════════════════════════════ */
function createRipple(element, event) {
  const rect = element.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = (event ? event.clientX - rect.left : rect.width / 2)  - size / 2;
  const y = (event ? event.clientY - rect.top  : rect.height / 2) - size / 2;

  const ripple = document.createElement("span");
  ripple.classList.add("ripple");
  ripple.style.width  = size + "px";
  ripple.style.height = size + "px";
  ripple.style.left   = x + "px";
  ripple.style.top    = y + "px";
  element.appendChild(ripple);

  ripple.addEventListener("animationend", function() { ripple.remove(); });
}

/* ════════════════════════════════════════════════════════════════════════
   ░░░  SECTION 11: CORE GAME LOGIC  ░░░
   This section has been rewritten to be as easy to understand as possible.
   It handles sequence generation, user input checking, and game resets.
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Step 1: Check the User's Answer
 * This function is called every time the user clicks a button.
 * It checks if they clicked the correct colour at the correct step in the sequence.
 */
function checkAnswer(currentLevel) {
  let isCorrect = false;

  if (gameMode === "reverse") {
    // Reverse mode: The first click matches the last colour of the pattern, etc.
    const expectedColour = gamePattern[gamePattern.length - 1 - currentLevel];
    isCorrect = (expectedColour === userClickedPattern[currentLevel]);
  } else {
    // Normal mode: The first click matches the first colour of the pattern
    isCorrect = (gamePattern[currentLevel] === userClickedPattern[currentLevel]);
  }

  // Check if the MOST RECENT button the user clicked matches the expected button
  if (isCorrect) {
    
    // If they got it right, check if they have finished the entire sequence for this level
    if (userClickedPattern.length === gamePattern.length) {
      // They finished the level! Wait 1 second, then generate the next sequence
      setTimeout(function () {
        nextSequence();
      }, 1000);
    }

  } else {
    // If the colours don't match, the user got it wrong. Game Over!

    // Play the wrong answer sound
    playSound("wrong");

    // Flash the screen red to indicate a mistake
    $("body").addClass("game-over");
    setTimeout(function () {
      $("body").removeClass("game-over");
    }, 200);

    // Update the text on the screen
    $("#level-title").text("Game Over! Press Any Key to Restart");

    // --- UI Enhancements (Game Over Modal & Stats) ---
    const prevScore = StatsController.currentScore;
    const best = StorageManager.getHighScore();
    const isNewHigh = (prevScore >= best) && (prevScore > 0) && (prevScore === StorageManager.getHighScore());

    // Add 1 to the total games played and save it
    const totalGames = StorageManager.getTotalGames() + 1;
    StorageManager.saveTotalGames(totalGames);

    // Show the game over pop-up modal after a tiny delay
    setTimeout(function() {
      UIController.showGameOver(
        StatsController.currentScore,
        StorageManager.getHighScore(),
        level,
        isNewHigh
      );
      // Shoot confetti if they got a new high score!
      if (isNewHigh && prevScore > 0) {
        ConfettiController.launch();
      }
    }, 300);

    // Reset the game variables so they can play again
    startOver();
  }
}

/**
 * Step 2: Generate the Next Sequence
 * This function adds a new random colour to Simon's sequence and plays it.
 */
function nextSequence() {
  // Clear out the user's answers from the previous level so they start fresh
  userClickedPattern = [];

  // Increase the level by 1 and update the text on the screen
  level++;
  $("#level-title").text("Level " + level);

  // Generate a random number between 0 and 3
  const randomNumber = Math.floor(Math.random() * 4);

  // Use that random number to pick a random colour from our buttonColours array
  const randomChosenColour = buttonColours[randomNumber];

  // Add the newly chosen colour to the end of Simon's game pattern
  gamePattern.push(randomChosenColour);

  // --- UI Enhancements ---
  // Temporarily disable the buttons so the user can't click while Simon is showing the pattern
  UIController.setButtonsDisabled(true);

  // Play the entire sequence from start to finish
  let delay = 0;
  for (let i = 0; i < gamePattern.length; i++) {
    setTimeout(function() {
      const color = gamePattern[i];
      // Make the button flash on the screen (slower animation)
      $("#" + color).fadeIn(150).fadeOut(150).fadeIn(150);
      // Play the sound associated with that colour
      playSound(color);
    }, delay);
    
    // Add 1000ms (1 second) delay between each flash to make it easier to follow
    delay += 1000;
  }

  // Re-enable the buttons after the sequence finishes playing
  setTimeout(function() {
    UIController.setButtonsDisabled(false);
  }, delay);

  // Update the score and check if the user earned any achievements
  if (level > 1) {
    StatsController.addLevelScore();
  }
  StatsController.refresh();
  AchievementSystem.check({
    level: level,
    score: StatsController.currentScore,
    totalGames: StorageManager.getTotalGames(),
    totalWins: StorageManager.getTotalWins(),
  });
}

/**
 * Step 3: Animate the Button Press
 * Makes the button look like it's being pushed down when clicked.
 */
function animatePress(currentColor) {
  // Add an accessibility property
  UIController.setButtonPressed(currentColor, true);

  // Add the "pressed" CSS class to change how the button looks
  $("#" + currentColor).addClass("pressed");

  // Remove the class after 100 milliseconds (a fraction of a second) so it pops back up
  setTimeout(function () {
    $("#" + currentColor).removeClass("pressed");
    UIController.setButtonPressed(currentColor, false);
  }, 100);
}

/**
 * Step 4: Play a Sound
 * Takes the name of the sound (e.g., "red", "wrong") and plays the mp3 file.
 */
function playSound(name) {
  // We send the sound request to our SoundController which handles muting and volume
  SoundController.play(name);
}

/**
 * Step 5: Reset the Game
 * Clears all the variables so a brand new game can start.
 */
function startOver() {
  level = 0;
  gamePattern = [];
  started = false;
  
  // Make sure buttons are clickable again
  UIController.setButtonsDisabled(false);
}

/* ════════════════════════════════════════════════════════════════════════
   ░░░  SECTION 12: GAME START / RESTART  ░░░
   ════════════════════════════════════════════════════════════════════════ */
function beginGame() {
  if (started) return;

  // Read the selected game mode from the dropdown
  const modeSelector = document.getElementById("game-mode");
  if (modeSelector) {
    gameMode = modeSelector.value;
  }

  UIController.hideStartScreen();
  UIController.hideModal("gameover-modal");
  UIController.hideModal("instructions-modal");

  // Reset per-game score
  StatsController.currentScore = 0;
  StatsController.refresh();

  $("#level-title").text("Level " + level);
  nextSequence();
  started = true;
}

/* ════════════════════════════════════════════════════════════════════════
   ░░░  SECTION 13: ORIGINAL EVENT LISTENERS (preserved)  ░░░
   ════════════════════════════════════════════════════════════════════════ */

/* Original keypress handler — now also triggers game if on start screen */
$(document).keypress(function(e) {
  // Ignore key presses inside modals
  if ($(e.target).closest(".modal-panel").length) return;

  if (e.key === "m" || e.key === "M") { SoundController.toggleMute(); return; }
  if (e.key === "t" || e.key === "T") { ThemeController.toggle(); return; }

  if (!started) {
    beginGame();
  }
});

/* ESC closes modals */
$(document).keydown(function(e) {
  if (e.key === "Escape") {
    UIController.hideModal("instructions-modal");
    UIController.hideModal("gameover-modal");
  }
});

/* Main Game Button Click Handler */
$(".btn").click(function(e) {
  // Ignore clicks if the buttons are currently disabled (e.g. during Simon's turn)
  if ($(this).hasClass("disabled")) return;

  // Get the ID of the button the user just clicked (red, blue, green, or yellow)
  const userChosenColour = $(this).attr("id");

  // Add this colour to the list of colours the user has clicked this round
  userClickedPattern.push(userChosenColour);

  // Play the sound and show the animation for the clicked button
  playSound(userChosenColour);
  animatePress(userChosenColour);
  createRipple(this, e); // visual effect

  // Check if this latest click was the correct answer
  // (We pass in the index of the last item added to the array)
  checkAnswer(userClickedPattern.length - 1);
});

/* ════════════════════════════════════════════════════════════════════════
   ░░░  SECTION 14: UI EVENT LISTENERS  ░░░
   ════════════════════════════════════════════════════════════════════════ */

/* Start button */
document.getElementById("start-btn").addEventListener("click", function() {
  beginGame();
});

/* Instructions button (open modal) */
document.getElementById("instructions-btn").addEventListener("click", function() {
  UIController.showModal("instructions-modal");
});

/* Start from instructions modal */
document.getElementById("start-from-modal").addEventListener("click", function() {
  beginGame();
});

/* Play Again button */
document.getElementById("play-again-btn").addEventListener("click", function() {
  UIController.hideModal("gameover-modal");
  UIController.showStartScreen();
  StatsController.refresh();
});

/* Share Score button */
document.getElementById("share-btn").addEventListener("click", function() {
  const score = StatsController.currentScore;
  const lvl   = document.getElementById("final-level").textContent;
  const text  = "🧠 I just scored " + score + " points and reached Level " + lvl + " on NeuroFlash™ Simon Game Pro! Can you beat me? #SimonGame #NeuroFlash";
  if (navigator.share) {
    navigator.share({ title: "NeuroFlash™ Simon Game Pro", text: text }).catch(function() {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() {
      var btn = document.getElementById("share-btn");
      btn.textContent = "✅ Copied!";
      setTimeout(function() { btn.textContent = "📤 Share Score"; }, 2000);
    });
  }
});

/* Mute button */
document.getElementById("mute-btn").addEventListener("click", function() {
  SoundController.toggleMute();
});

/* Volume slider */
document.getElementById("volume-slider").addEventListener("input", function() {
  SoundController.setVolume(this.value);
});

/* Theme toggle */
document.getElementById("theme-toggle").addEventListener("click", function() {
  ThemeController.toggle();
});

/* Close modal buttons */
document.querySelectorAll(".modal-close").forEach(function(btn) {
  btn.addEventListener("click", function() {
    var modalId = btn.getAttribute("data-modal");
    UIController.hideModal(modalId);
  });
});

/* Close modals on overlay click */
document.querySelectorAll(".modal-overlay").forEach(function(overlay) {
  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) {
      overlay.classList.add("hidden");
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════
   ░░░  SECTION 15: APP INITIALISATION  ░░░
   Runs once on page load.
   ════════════════════════════════════════════════════════════════════════ */
$(document).ready(function() {
  // Clear all saved scores and achievements on refresh for a completely clean slate
  StorageManager.clearStats();

  // Boot all subsystems
  ThemeController.init();
  SoundController.init();
  AchievementSystem.init();
  StatsController.init();
  ParticleSystem.init();
  ConfettiController.init();

  // Show the start screen
  UIController.showStartScreen();

  console.log("%c NeuroFlash™ Simon Game Pro v2.0.0 ", "background:#7c3aed;color:#fff;font-size:14px;padding:4px 8px;border-radius:4px;");
  console.log("%c Original Simon Game logic preserved. Enhanced with premium UI.", "color:#a78bfa;font-size:12px;");
});
