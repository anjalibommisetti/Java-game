// TERRITORY RUSH - Official Web Engine & Game Loop

const GRID = 140;
const CELL_SIZE = 28;
const MAP_SIZE = GRID * CELL_SIZE; // 3920px World arena size

class Player {
    constructor(id, name, isAI, color, territoryColor, trailColor, skinId = 'classic') {
        this.id = id;
        this.name = name;
        this.isAI = isAI;
        this.color = color;
        this.territoryColor = territoryColor;
        this.trailColor = trailColor;
        this.skinId = skinId;

        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;

        this.trail = [];
        this.isOutside = false;
        this.isAlive = true;

        this.claimedCount = 0;
        this.percentage = 0.0;
        this.maxPercentage = 0.0;
        this.finalPercentage = 0.0;
        this.kills = 0;
        this.coins = 0;
        this.score = 0;

        // Active Power-Ups Status
        this.shieldActive = false;
        this.shieldTimer = null;
        this.magnetActive = false;
        this.magnetTimer = null;
        this.speedBoostActive = false;
        this.speedBoostTimer = null;

        // AI behavior fields
        this.aiTarget = null;
        this.aiExcursion = 0;
        this.aiMaxExcursion = 10;
        this.deathReason = "";
        this.killedBy = "";
    }
}

class TerritoryRushGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');

        this.grid = Array(GRID).fill(0).map(() => Array(GRID).fill(0));
        this.trailGrid = Array(GRID).fill(0).map(() => Array(GRID).fill(0));

        this.players = [];
        this.humanPlayer = null;
        this.spawnedItems = []; // Collectible Coins & Power-Ups on canvas

        this.cameraX = 0;
        this.cameraY = 0;
        this.zoomScale = 0.90; // Default immersive camera scale (90%)
        this.isPaused = false;
        this.isGameOver = false;
        this.gameStarted = false;
        this.matchInitialized = false;

        this.elapsedSeconds = 0;
        this.lastStepTime = 0;
        this.lastTimerTick = 0;
        this.itemSpawnTimer = 0;

        // Sound Effects Synthesizer Context
        this.audioCtx = null;
        this.musicStepIndex = 0;
        this.lastMusicBeatTime = 0;
        this.setupAudioListeners();

        // Load Persistent Settings & Skins & Stats
        this.loadSettings();
        this.loadSkinsData();
        this.loadAchievementsData();
        this.loadStatsData();

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.setupPlayers();
        this.bindControls();
        this.startNewMatch();
        this.gameStarted = false; // Hold on start screen until PLAY GAME NOW is clicked
        
        document.getElementById('startOverlay').classList.remove('hidden');

        requestAnimationFrame((t) => this.loop(t));
    }

    // --- Web Audio API Procedural Sound Synthesizer ---
    setupAudioListeners() {
        const unlock = () => {
            this.initAudio();
        };
        ['click', 'pointerdown', 'touchstart', 'keydown'].forEach(evt => {
            window.addEventListener(evt, unlock, { passive: true });
        });
    }

    initAudio() {
        if (!this.audioCtx) {
            const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
            if (AudioCtxClass) this.audioCtx = new AudioCtxClass();
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
    }

    playSound(type) {
        if (!this.settings.soundFx) return;
        this.initAudio();
        if (!this.audioCtx) return;

        try {
            const ctx = this.audioCtx;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            const now = ctx.currentTime;

            if (type === 'click') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
                osc.start(now);
                osc.stop(now + 0.05);
            } else if (type === 'trail') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(320, now);
                osc.frequency.linearRampToValueAtTime(440, now + 0.04);
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.linearRampToValueAtTime(0.001, now + 0.04);
                osc.start(now);
                osc.stop(now + 0.04);
            } else if (type === 'dash') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
                osc.start(now);
                osc.stop(now + 0.15);
            } else if (type === 'capture') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.setValueAtTime(554.37, now + 0.08); // C#
                osc.frequency.setValueAtTime(659.25, now + 0.16); // E
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
            } else if (type === 'coin') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(987.77, now); // B5
                osc.frequency.setValueAtTime(1318.51, now + 0.06); // E6
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.18);
                osc.start(now);
                osc.stop(now + 0.18);
            } else if (type === 'powerup') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(900, now + 0.2);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
            } else if (type === 'shield_save') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
            } else if (type === 'kill') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(250, now);
                osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.22);
                osc.start(now);
                osc.stop(now + 0.22);
            } else if (type === 'victory') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(523.25, now); // C5
                osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
                osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
                osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
                osc.start(now);
                osc.stop(now + 0.5);
            } else if (type === 'gameover') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.45);
                osc.start(now);
                osc.stop(now + 0.45);
            }
        } catch (e) {
            // Audio context fallback safeguard
        }
    }

    playBackgroundArcadeBeat(now) {
        if (!this.settings.music || !this.gameStarted || this.isPaused || this.isGameOver) return;
        if (now - this.lastMusicBeatTime < 320) return;
        this.lastMusicBeatTime = now;
        this.initAudio();
        if (!this.audioCtx) return;

        try {
            const notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63]; // C4, E4, G4, C5, G4, E4
            const freq = notes[this.musicStepIndex % notes.length];
            this.musicStepIndex++;

            const ctx = this.audioCtx;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(0.04, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.25);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.25);
        } catch (e) {}
    }

    // --- Settings & Storage Handlers ---
    loadSettings() {
        this.settings = JSON.parse(localStorage.getItem('tr_settings') || JSON.stringify({
            soundFx: true,
            music: true,
            vibration: true,
            gfxQuality: 'high',
            speedMode: 'normal',
            controlMode: 'keyboard'
        }));
        this.setSpeedMode(this.settings.speedMode);
        this.setControlMode(this.settings.controlMode);
        this.updateSettingsUI();
    }

    saveSettings() {
        localStorage.setItem('tr_settings', JSON.stringify(this.settings));
        this.updateSettingsUI();
    }

    updateSettingsUI() {
        const sfxBtn = document.getElementById('toggle-sfx');
        const musicBtn = document.getElementById('toggle-music');
        const vibeBtn = document.getElementById('toggle-vibe');

        if (sfxBtn) { sfxBtn.textContent = this.settings.soundFx ? 'ON' : 'OFF'; sfxBtn.className = this.settings.soundFx ? 'btn-toggle active' : 'btn-toggle'; }
        if (musicBtn) { musicBtn.textContent = this.settings.music ? 'ON' : 'OFF'; musicBtn.className = this.settings.music ? 'btn-toggle active' : 'btn-toggle'; }
        if (vibeBtn) { vibeBtn.textContent = this.settings.vibration ? 'ON' : 'OFF'; vibeBtn.className = this.settings.vibration ? 'btn-toggle active' : 'btn-toggle'; }

        document.querySelectorAll('.gfx-btn').forEach(btn => {
            if (btn.getAttribute('data-gfx') === this.settings.gfxQuality) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    loadSkinsData() {
        this.availableSkins = [
            { id: 'classic', name: 'Classic Cyan', color: '#00E5FF', price: 0, unlocked: true },
            { id: 'neon', name: 'Neon Pink', color: '#FF2D55', price: 0, unlocked: true },
            { id: 'gold', name: 'Gold Yellow', color: '#FFCC00', price: 500, unlocked: false },
            { id: 'emerald', name: 'Emerald Green', color: '#00E676', price: 1000, unlocked: false },
            { id: 'ocean', name: 'Ocean Blue', color: '#0284C7', price: 1500, unlocked: false },
            { id: 'galaxy', name: 'Galaxy Purple', color: '#AF52DE', price: 2500, unlocked: false }
        ];

        const savedUnlocked = JSON.parse(localStorage.getItem('tr_unlocked_skins') || '["classic", "neon"]');
        this.availableSkins.forEach(s => {
            if (savedUnlocked.includes(s.id)) s.unlocked = true;
        });

        this.selectedSkinId = localStorage.getItem('tr_selected_skin') || 'classic';
        this.renderSkinsGrid();
        this.updateSkinPreviewUI();
    }

    saveSkinsData() {
        const unlockedIds = this.availableSkins.filter(s => s.unlocked).map(s => s.id);
        localStorage.setItem('tr_unlocked_skins', JSON.stringify(unlockedIds));
        localStorage.setItem('tr_selected_skin', this.selectedSkinId);
        this.renderSkinsGrid();
        this.updateSkinPreviewUI();
    }

    loadAchievementsData() {
        this.achievements = [
            { id: 'first_win', name: 'First Victory', desc: 'Win 1st Place in a match', icon: '🏆', unlocked: false },
            { id: 'killer_10', name: 'Killer', desc: 'Eliminate 10 rivals in total', icon: '⚔️', unlocked: false },
            { id: 'territory_25', name: 'Territory Master', desc: 'Capture 25% territory in a match', icon: '🌎', unlocked: false },
            { id: 'coin_1000', name: 'Coin Collector', desc: 'Accumulate 1,000 total gold coins', icon: '💰', unlocked: false },
            { id: 'survivor_3m', name: 'Survivor', desc: 'Survive for 3 minutes in a match', icon: '🔥', unlocked: false },
            { id: 'high_scorer', name: 'High Scorer', desc: 'Reach 5,000 points in a match', icon: '⭐', unlocked: false }
        ];

        const saved = JSON.parse(localStorage.getItem('tr_achievements') || '[]');
        this.achievements.forEach(a => {
            if (saved.includes(a.id)) a.unlocked = true;
        });
        this.renderAchievementsGrid();
    }

    triggerAchievement(id) {
        const ach = this.achievements.find(a => a.id === id);
        if (ach && !ach.unlocked) {
            ach.unlocked = true;
            const saved = JSON.parse(localStorage.getItem('tr_achievements') || '[]');
            if (!saved.includes(id)) saved.push(id);
            localStorage.setItem('tr_achievements', JSON.stringify(saved));
            this.renderAchievementsGrid();
            this.playSound('victory');
            this.addKillToast(`🏅 <b>ACHIEVEMENT UNLOCKED:</b> ${ach.name}!`);
        }
    }

    loadStatsData() {
        this.stats = JSON.parse(localStorage.getItem('tr_stats') || JSON.stringify({
            totalMatches: 0,
            totalWins: 0,
            bestScore: 0,
            bestTerritory: 0,
            totalKills: 0,
            totalCoins: 1250,
            sumScores: 0,
            sumTerritories: 0
        }));
        this.updateCoinsUI();
        this.renderStatsModal();
    }

    saveStatsData() {
        localStorage.setItem('tr_stats', JSON.stringify(this.stats));
        this.updateCoinsUI();
        this.renderStatsModal();
    }

    updateCoinsUI() {
        const elem = document.getElementById('coinsText');
        if (elem) elem.textContent = this.stats.totalCoins.toLocaleString();
    }

    addCoins(amount) {
        this.stats.totalCoins += amount;
        if (this.stats.totalCoins >= 1000) this.triggerAchievement('coin_1000');
        this.saveStatsData();
    }

    setSpeedMode(mode) {
        this.currentSpeedMode = mode;
        const speedMap = { slow: 130, normal: 95, fast: 60 };
        this.baseStepDelay = speedMap[mode] || 95;
        this.stepDelay = this.baseStepDelay;
        if (this.settings) {
            this.settings.speedMode = mode;
            this.saveSettings();
        }

        document.querySelectorAll('.speed-btn').forEach(btn => {
            if (btn.getAttribute('data-speed') === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    setControlMode(mode) {
        this.controlMode = mode;
        if (this.settings) {
            this.settings.controlMode = mode;
            this.saveSettings();
        }

        document.querySelectorAll('.ctrl-mode-btn').forEach(btn => {
            if (btn.getAttribute('data-mode') === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    setZoom(scale) {
        this.zoomScale = Math.min(1.5, Math.max(0.15, parseFloat(scale.toFixed(2))));
        const label = document.getElementById('zoomLabel');
        const slider = document.getElementById('zoomSlider');
        const pct = Math.round(this.zoomScale * 100);
        if (label) label.textContent = `${pct}%`;
        if (slider) slider.value = pct;
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setupPlayers() {
        const savedName = localStorage.getItem('tr_player_name') || 'Player';
        const activeSkin = this.availableSkins.find(s => s.id === this.selectedSkinId) || this.availableSkins[0];

        this.humanPlayer = new Player(1, savedName, false, activeSkin.color, activeSkin.color, activeSkin.color, activeSkin.id);
        this.players = [
            this.humanPlayer,
            new Player(2, "Estella", true, "#E040FB", "#C084FC", "#E040FB"),
            new Player(3, "Darkside Orbit", true, "#FFC107", "#FCD34D", "#FFC107"),
            new Player(4, "Bleach", true, "#1DE9B6", "#5EEAD4", "#1DE9B6"),
            new Player(5, "Eight Patrol", true, "#FF9100", "#FDBA74", "#FF9100"),
            new Player(6, "Girl Brownie", true, "#AEEA00", "#BEF264", "#AEEA00"),
            new Player(7, "Dahlia", true, "#00E676", "#6EE7B7", "#00E676")
        ];

        this.updateProfileHUD();
    }

    updateProfileHUD(updateInput = true) {
        const nameInput = document.getElementById('playerNameInput');
        const hudName = document.getElementById('hudPlayerName');
        const hudDot = document.getElementById('hudColorDot');

        const displayName = this.humanPlayer.name.trim() || 'Player';

        if (updateInput && nameInput) nameInput.value = this.humanPlayer.name;
        if (hudName) hudName.textContent = displayName;
        if (hudDot) hudDot.style.background = this.humanPlayer.color;
    }

    saveProfile(name, color, updateInput = true) {
        this.humanPlayer.name = name;
        if (color) {
            this.humanPlayer.color = color;
            this.humanPlayer.territoryColor = color;
            this.humanPlayer.trailColor = color;
        }
        const saveName = name.trim() || 'Player';
        localStorage.setItem('tr_player_name', saveName);
        this.updateProfileHUD(updateInput);
    }

    startNewMatch() {
        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                this.grid[x][y] = 0;
                this.trailGrid[x][y] = 0;
            }
        }

        this.spawnedItems = [];
        this.isGameOver = false;
        this.isPaused = false;
        this.gameStarted = true;
        this.matchInitialized = true;
        this.elapsedSeconds = 0;
        this.lastTimerTick = performance.now();

        document.getElementById('gameOverlay').classList.add('hidden');
        document.getElementById('pauseOverlay').classList.add('hidden');
        document.getElementById('startOverlay').classList.add('hidden');

        // Spawn Locations distributed on arena map
        const spawns = [
            { x: 30, y: 30 },
            { x: 110, y: 110 },
            { x: 110, y: 30 },
            { x: 30, y: 110 },
            { x: 70, y: 30 },
            { x: 70, y: 110 },
            { x: 110, y: 70 }
        ];

        const activeSkin = this.availableSkins.find(s => s.id === this.selectedSkinId) || this.availableSkins[0];
        this.humanPlayer.color = activeSkin.color;
        this.humanPlayer.territoryColor = activeSkin.color;
        this.humanPlayer.trailColor = activeSkin.color;

        this.players.forEach((p, idx) => {
            let s = spawns[idx % spawns.length];
            p.x = s.x;
            p.y = s.y;
            p.vx = 0;
            p.vy = 0;
            p.trail = [];
            p.isOutside = false;
            p.isAlive = true;
            p.claimedCount = 81;
            const initPct = (81 / (GRID * GRID)) * 100.0;
            p.percentage = initPct;
            p.maxPercentage = initPct;
            p.finalPercentage = initPct;
            p.kills = 0;
            p.coins = 0;
            p.score = 0;
            p.deathReason = "";
            p.killedBy = "";
            p.shieldActive = false;
            p.magnetActive = false;
            p.speedBoostActive = false;
            p.aiExcursion = 0;
            p.aiMaxExcursion = 8 + Math.floor(Math.random() * 8);

            // Initial 9x9 Base
            for (let dx = -4; dx <= 4; dx++) {
                for (let dy = -4; dy <= 4; dy++) {
                    let tx = p.x + dx;
                    let ty = p.y + dy;
                    if (this.isValid(tx, ty)) {
                        this.grid[tx][ty] = p.id;
                    }
                }
            }
        });

        this.spawnMapItems(6); // Initial coins & power-ups spawn
        this.updateStats();
        this.renderUI();
        this.addKillToast(`🎮 <b>TERRITORY RUSH STARTED!</b> Capture territory & collect power-ups!`);
    }

    // --- Collectible Canvas Power-Ups & Items Generator ---
    spawnMapItems(count = 3) {
        const types = ['coin', 'coin', 'coin', 'speed', 'shield', 'magnet', 'dash'];
        for (let i = 0; i < count; i++) {
            let rx = 10 + Math.floor(Math.random() * (GRID - 20));
            let ry = 10 + Math.floor(Math.random() * (GRID - 20));
            let type = types[Math.floor(Math.random() * types.length)];
            this.spawnedItems.push({ x: rx, y: ry, type: type, id: Math.random() });
        }
    }

    activatePowerup(p, type) {
        if (type === 'coin') {
            const amount = 25 + Math.floor(Math.random() * 50);
            p.coins += amount;
            this.addCoins(amount);
            this.playSound('coin');
            this.addKillToast(`🪙 <b>+${amount} Gold Coins Collected!</b>`);
        } else if (type === 'speed') {
            p.speedBoostActive = true;
            this.stepDelay = Math.max(35, Math.floor(this.baseStepDelay * 0.5));
            this.showPowerupHUD('⚡', 'Speed Boost', 6);
            this.playSound('powerup');
            this.addKillToast(`⚡ <b>SPEED BOOST ACTIVATED!</b> (6s)`);

            if (p.speedBoostTimer) clearTimeout(p.speedBoostTimer);
            p.speedBoostTimer = setTimeout(() => {
                p.speedBoostActive = false;
                this.stepDelay = this.baseStepDelay;
                this.hidePowerupHUD();
            }, 6000);
        } else if (type === 'shield') {
            p.shieldActive = true;
            this.showPowerupHUD('🛡️', 'Shield Invincibility', 6);
            this.playSound('powerup');
            this.addKillToast(`🛡️ <b>SHIELD ACTIVATED!</b> Protected from cut! (6s)`);

            if (p.shieldTimer) clearTimeout(p.shieldTimer);
            p.shieldTimer = setTimeout(() => {
                p.shieldActive = false;
                this.hidePowerupHUD();
            }, 6000);
        } else if (type === 'magnet') {
            p.magnetActive = true;
            this.showPowerupHUD('🧲', 'Coin Magnet', 8);
            this.playSound('powerup');
            this.addKillToast(`🧲 <b>COIN MAGNET ACTIVATED!</b> (8s)`);

            if (p.magnetTimer) clearTimeout(p.magnetTimer);
            p.magnetTimer = setTimeout(() => {
                p.magnetActive = false;
                this.hidePowerupHUD();
            }, 8000);
        } else if (type === 'dash') {
            this.performDash(p);
        }
    }

    performDash(p) {
        if (!p.isAlive || (p.vx === 0 && p.vy === 0)) return;
        this.playSound('powerup');
        this.addKillToast(`💨 <b>INSTANT DASH SURGE!</b>`);
        for (let step = 0; step < 3; step++) {
            if (p.isAlive) this.movePlayer(p);
        }
    }

    showPowerupHUD(icon, name, seconds) {
        const container = document.getElementById('activePowerupContainer');
        const iconElem = document.getElementById('powerupIcon');
        const nameElem = document.getElementById('powerupName');
        const timerElem = document.getElementById('powerupTimer');

        if (!container) return;
        if (iconElem) iconElem.textContent = icon;
        if (nameElem) nameElem.textContent = name;
        if (timerElem) timerElem.textContent = `${seconds}s`;
        container.classList.remove('hidden');
    }

    hidePowerupHUD() {
        const container = document.getElementById('activePowerupContainer');
        if (container) container.classList.add('hidden');
    }

    showStartOverlay() {
        this.gameStarted = false;
        this.isPaused = false;
        document.getElementById('gameOverlay').classList.add('hidden');
        document.getElementById('pauseOverlay').classList.add('hidden');
        document.getElementById('startOverlay').classList.remove('hidden');
    }

    pauseGame() {
        if (!this.gameStarted || this.isGameOver) return;
        this.isPaused = true;
        document.getElementById('pauseOverlay').classList.remove('hidden');
        this.playSound('click');
        this.addKillToast(`⏸ <b>Game Paused</b>`);
    }

    resumeGame() {
        this.isPaused = false;
        this.lastTimerTick = performance.now();
        document.getElementById('pauseOverlay').classList.add('hidden');
        this.playSound('click');
        this.addKillToast(`▶ <b>Resumed Match!</b>`);
    }

    togglePause() {
        if (this.isPaused) {
            this.resumeGame();
        } else {
            this.pauseGame();
        }
    }

    isValid(x, y) {
        return x >= 0 && x < GRID && y >= 0 && y < GRID;
    }

    bindControls() {
        // Mouse Cursor Steering
        window.addEventListener('mousemove', (e) => {
            if (this.controlMode !== 'mouse') return;
            if (!this.humanPlayer || !this.humanPlayer.isAlive || this.isPaused || !this.gameStarted) return;
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            const dx = e.clientX - centerX;
            const dy = e.clientY - centerY;

            if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    const targetVx = dx > 0 ? 1 : -1;
                    if (this.humanPlayer.vx !== -targetVx) {
                        this.humanPlayer.vx = targetVx;
                        this.humanPlayer.vy = 0;
                    }
                } else {
                    const targetVy = dy > 0 ? 1 : -1;
                    if (this.humanPlayer.vy !== -targetVy) {
                        this.humanPlayer.vx = 0;
                        this.humanPlayer.vy = targetVy;
                    }
                }
            }
        });

        // Keyboard Controls
        window.addEventListener('keydown', (e) => {
            const key = e.key ? e.key.toLowerCase() : '';
            if (key === 'p' || key === 'escape') {
                this.togglePause();
                return;
            }
            if (key === ' ') {
                this.performDash(this.humanPlayer);
                return;
            }

            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '].includes(key)) {
                if (document.activeElement && document.activeElement.tagName !== 'INPUT') {
                    e.preventDefault();
                }
            }

            if (!this.humanPlayer || !this.humanPlayer.isAlive || this.isPaused || !this.gameStarted) return;

            if (key === 'arrowup' || key === 'w' || e.code === 'ArrowUp' || e.code === 'KeyW') {
                if (this.humanPlayer.vy !== 1) { this.humanPlayer.vx = 0; this.humanPlayer.vy = -1; }
            } else if (key === 'arrowdown' || key === 's' || e.code === 'ArrowDown' || e.code === 'KeyS') {
                if (this.humanPlayer.vy !== -1) { this.humanPlayer.vx = 0; this.humanPlayer.vy = 1; }
            } else if (key === 'arrowleft' || key === 'a' || e.code === 'ArrowLeft' || e.code === 'KeyA') {
                if (this.humanPlayer.vx !== 1) { this.humanPlayer.vx = -1; this.humanPlayer.vy = 0; }
            } else if (key === 'arrowright' || key === 'd' || e.code === 'ArrowRight' || e.code === 'KeyD') {
                if (this.humanPlayer.vx !== -1) { this.humanPlayer.vx = 1; this.humanPlayer.vy = 0; }
            }
        });

        // D-Pad Touch Controls
        const setUp = () => { if (this.humanPlayer && this.humanPlayer.vy !== 1 && !this.isPaused) { this.humanPlayer.vx = 0; this.humanPlayer.vy = -1; } };
        const setDown = () => { if (this.humanPlayer && this.humanPlayer.vy !== -1 && !this.isPaused) { this.humanPlayer.vx = 0; this.humanPlayer.vy = 1; } };
        const setLeft = () => { if (this.humanPlayer && this.humanPlayer.vx !== 1 && !this.isPaused) { this.humanPlayer.vx = -1; this.humanPlayer.vy = 0; } };
        const setRight = () => { if (this.humanPlayer && this.humanPlayer.vx !== -1 && !this.isPaused) { this.humanPlayer.vx = 1; this.humanPlayer.vy = 0; } };

        document.getElementById('btn-up')?.addEventListener('click', setUp);
        document.getElementById('btn-down')?.addEventListener('click', setDown);
        document.getElementById('btn-left')?.addEventListener('click', setLeft);
        document.getElementById('btn-right')?.addEventListener('click', setRight);
        document.getElementById('btn-hud-powerup')?.addEventListener('click', () => this.performDash(this.humanPlayer));

        // HUD Pause & Resume & Menu Buttons
        document.getElementById('btn-pause-hud')?.addEventListener('click', () => this.pauseGame());
        document.getElementById('btn-resume-game')?.addEventListener('click', () => this.resumeGame());
        document.getElementById('btn-restart-paused')?.addEventListener('click', () => this.startNewMatch());
        document.getElementById('btn-main-menu-paused')?.addEventListener('click', () => this.showStartOverlay());
        document.getElementById('btn-main-menu-gameover')?.addEventListener('click', () => this.showStartOverlay());
        document.getElementById('btn-gameover-leaderboard')?.addEventListener('click', () => {
            document.getElementById('gameOverlay').classList.add('hidden');
            this.openDBModal();
        });

        // Zoom Controls
        const zoomSlider = document.getElementById('zoomSlider');
        if (zoomSlider) {
            zoomSlider.addEventListener('input', (e) => {
                this.setZoom(parseFloat(e.target.value) / 100);
            });
        }
        document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.setZoom(this.zoomScale + 0.15));
        document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.setZoom(this.zoomScale - 0.15));

        window.addEventListener('wheel', (e) => {
            if (e.target.closest('.modal') || e.target.closest('.overlay')) return;
            e.preventDefault();
            this.setZoom(e.deltaY > 0 ? this.zoomScale - 0.05 : this.zoomScale + 0.05);
        }, { passive: false });

        // Nickname Input Listeners
        const nameInput = document.getElementById('playerNameInput');
        const validationMsg = document.getElementById('nameValidationMsg');

        if (nameInput) {
            if (nameInput.value.trim() && validationMsg) validationMsg.classList.add('hidden');
            nameInput.addEventListener('input', (e) => {
                nameInput.classList.remove('input-error');
                if (validationMsg) validationMsg.classList.add('hidden');
                this.saveProfile(e.target.value, null, false);
            });
            nameInput.addEventListener('focus', () => nameInput.select());
            nameInput.addEventListener('keydown', (e) => e.stopPropagation());
        }

        document.getElementById('btn-clear-name')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (nameInput) {
                nameInput.value = '';
                nameInput.focus();
                this.saveProfile('', null, false);
            }
        });

        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setSpeedMode(btn.getAttribute('data-speed')));
        });

        document.querySelectorAll('.ctrl-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setControlMode(btn.getAttribute('data-mode')));
        });

        // Start Game CTA Button
        const startBtn = document.getElementById('btn-start-play');
        if (startBtn) {
            startBtn.onclick = () => {
                this.playSound('click');
                const val = nameInput ? nameInput.value.trim() : '';

                if (!val) {
                    if (nameInput) nameInput.classList.add('input-error');
                    if (validationMsg) validationMsg.classList.remove('hidden');
                    if (nameInput) nameInput.focus();
                    return;
                }

                if (nameInput) nameInput.classList.remove('input-error');
                if (validationMsg) validationMsg.classList.add('hidden');

                this.saveProfile(val, null, true);
                this.startNewMatch();
            };
        }

        document.getElementById('btn-restart').onclick = () => {
            this.playSound('click');
            this.startNewMatch();
        };

        // Main Arcade Screen Modal Buttons
        this.bindModalButtons();
    }

    bindModalButtons() {
        const openModal = (id) => {
            this.playSound('click');
            document.getElementById(id)?.classList.remove('hidden');
        };

        const closeModal = (id) => {
            this.playSound('click');
            document.getElementById(id)?.classList.add('hidden');
        };

        document.getElementById('btn-menu-skins')?.addEventListener('click', () => openModal('skinsModal'));
        document.getElementById('btn-open-skins-quick')?.addEventListener('click', () => openModal('skinsModal'));
        document.getElementById('btn-menu-leaderboard')?.addEventListener('click', () => this.openDBModal());
        document.getElementById('btn-db-modal')?.addEventListener('click', () => this.openDBModal());
        document.getElementById('btn-menu-stats')?.addEventListener('click', () => openModal('statsModal'));
        document.getElementById('btn-menu-achievements')?.addEventListener('click', () => openModal('achievementsModal'));
        document.getElementById('btn-menu-daily')?.addEventListener('click', () => this.openDailyRewardModal());
        document.getElementById('btn-menu-howto')?.addEventListener('click', () => openModal('howtoModal'));
        document.getElementById('btn-menu-settings')?.addEventListener('click', () => openModal('settingsModal'));
        document.getElementById('btn-settings-paused')?.addEventListener('click', () => openModal('settingsModal'));

        document.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => closeModal(btn.getAttribute('data-target')));
        });

        // Claim Daily Reward
        document.getElementById('btn-claim-reward')?.addEventListener('click', () => this.claimDailyReward());

        // Settings Toggles
        document.getElementById('toggle-sfx')?.addEventListener('click', () => {
            this.settings.soundFx = !this.settings.soundFx;
            this.saveSettings();
            this.playSound('click');
        });
        document.getElementById('toggle-music')?.addEventListener('click', () => {
            this.settings.music = !this.settings.music;
            this.saveSettings();
            this.playSound('click');
        });
        document.getElementById('toggle-vibe')?.addEventListener('click', () => {
            this.settings.vibration = !this.settings.vibration;
            this.saveSettings();
            this.playSound('click');
        });

        document.querySelectorAll('.gfx-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.settings.gfxQuality = btn.getAttribute('data-gfx');
                this.saveSettings();
                this.playSound('click');
            });
        });

        // Reset Progress Modal
        document.getElementById('btn-reset-progress')?.addEventListener('click', () => openModal('confirmResetModal'));
        document.getElementById('btn-cancel-reset')?.addEventListener('click', () => closeModal('confirmResetModal'));
        document.getElementById('btn-confirm-reset')?.addEventListener('click', () => {
            localStorage.clear();
            closeModal('confirmResetModal');
            location.reload();
        });
    }

    loop(now) {
        requestAnimationFrame((t) => this.loop(t));

        if (!this.lastStepTime) this.lastStepTime = now;
        const delta = now - this.lastStepTime;

        if (this.gameStarted && !this.isPaused && !this.isGameOver) {
            this.playBackgroundArcadeBeat(now);

            if (now - this.lastTimerTick >= 1000) {
                this.elapsedSeconds++;
                this.lastTimerTick = now;
                this.updateTimerDisplay();

                if (this.elapsedSeconds >= 180) this.triggerAchievement('survivor_3m');

                // Periodically spawn canvas items every 10s
                this.itemSpawnTimer++;
                if (this.itemSpawnTimer >= 10) {
                    this.itemSpawnTimer = 0;
                    if (this.spawnedItems.length < 12) this.spawnMapItems(2);
                }
            }
        }

        if (delta >= this.stepDelay && this.gameStarted && !this.isPaused && !this.isGameOver) {
            this.lastStepTime = now;
            this.updateGameLogic();
        }

        this.render();
    }

    updateTimerDisplay() {
        const timerElem = document.getElementById('gameTimeText');
        if (!timerElem) return;
        const mins = Math.floor(this.elapsedSeconds / 60);
        const secs = this.elapsedSeconds % 60;
        const fmtMins = mins < 10 ? `0${mins}` : `${mins}`;
        const fmtSecs = secs < 10 ? `0${secs}` : `${secs}`;
        timerElem.textContent = `${fmtMins}:${fmtSecs}`;
    }

    updateGameLogic() {
        // 1. Move Human Player
        if (this.humanPlayer.isAlive && (this.humanPlayer.vx !== 0 || this.humanPlayer.vy !== 0)) {
            this.movePlayer(this.humanPlayer);
        }

        // 2. AI Movement Logic
        this.players.filter(p => p.isAI && p.isAlive).forEach(ai => {
            this.updateAIMovement(ai);
            this.movePlayer(ai);
        });

        // 3. Collectible Item Pickups & Magnet Effect
        this.checkItemPickups();

        // 4. Collisions & Game Over Evaluation
        this.checkCollisions();
        this.updateStats();
        this.renderUI();
        this.checkGameOver();
    }

    checkItemPickups() {
        if (!this.humanPlayer || !this.humanPlayer.isAlive) return;

        this.spawnedItems = this.spawnedItems.filter(item => {
            let dist = Math.abs(this.humanPlayer.x - item.x) + Math.abs(this.humanPlayer.y - item.y);

            // Magnet Attraction Effect
            if (this.humanPlayer.magnetActive && dist <= 12) {
                if (item.x < this.humanPlayer.x) item.x++;
                else if (item.x > this.humanPlayer.x) item.x--;
                if (item.y < this.humanPlayer.y) item.y++;
                else if (item.y > this.humanPlayer.y) item.y--;
                dist = Math.abs(this.humanPlayer.x - item.x) + Math.abs(this.humanPlayer.y - item.y);
            }

            if (dist <= 1) {
                this.activatePowerup(this.humanPlayer, item.type);
                return false; // Remove collected item
            }
            return true;
        });
    }

    updateAIMovement(ai) {
        let isOwner = (this.grid[ai.x][ai.y] === ai.id);

        const wallMargin = 5;
        if (ai.x <= wallMargin && ai.vx < 0) { ai.vx = 0; ai.vy = ai.y > GRID / 2 ? -1 : 1; return; }
        if (ai.x >= GRID - wallMargin && ai.vx > 0) { ai.vx = 0; ai.vy = ai.y > GRID / 2 ? -1 : 1; return; }
        if (ai.y <= wallMargin && ai.vy < 0) { ai.vy = 0; ai.vx = ai.x > GRID / 2 ? -1 : 1; return; }
        if (ai.y >= GRID - wallMargin && ai.vy > 0) { ai.vy = 0; ai.vx = ai.x > GRID / 2 ? -1 : 1; return; }

        if (!ai.isOutside && isOwner) {
            let dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
            dirs = dirs.filter(d => this.isValid(ai.x + d.x * 4, ai.y + d.y * 4));
            if (dirs.length > 0) {
                let choice = dirs[Math.floor(Math.random() * dirs.length)];
                ai.vx = choice.x;
                ai.vy = choice.y;
                ai.aiExcursion = 0;
            }
        } else if (ai.isOutside) {
            ai.aiExcursion++;

            if (ai.aiExcursion >= ai.aiMaxExcursion) {
                this.steerAITowardsHome(ai);
            } else if (Math.random() < 0.15) {
                let candVx = 0, candVy = 0;
                if (ai.vx !== 0) {
                    candVy = Math.random() < 0.5 ? 1 : -1;
                    candVx = 0;
                } else {
                    candVx = Math.random() < 0.5 ? 1 : -1;
                    candVy = 0;
                }

                let tx = ai.x + candVx;
                let ty = ai.y + candVy;
                if (this.isValid(tx, ty) && this.trailGrid[tx][ty] !== ai.id) {
                    ai.vx = candVx;
                    ai.vy = candVy;
                }
            }
        }
    }

    steerAITowardsHome(ai) {
        let bestDist = 999;
        let target = null;
        for (let x = 0; x < GRID; x += 4) {
            for (let y = 0; y < GRID; y += 4) {
                if (this.grid[x][y] === ai.id) {
                    let d = Math.abs(x - ai.x) + Math.abs(y - ai.y);
                    if (d < bestDist) {
                        bestDist = d;
                        target = { x, y };
                    }
                }
            }
        }

        if (target) {
            let dx = target.x - ai.x;
            let dy = target.y - ai.y;

            let candVx = 0, candVy = 0;
            if (Math.abs(dx) > Math.abs(dy)) {
                candVx = dx > 0 ? 1 : -1;
                candVy = 0;
            } else {
                candVy = dy > 0 ? 1 : -1;
                candVx = 0;
            }

            let tx = ai.x + candVx;
            let ty = ai.y + candVy;
            if (this.isValid(tx, ty) && this.trailGrid[tx][ty] !== ai.id) {
                ai.vx = candVx;
                ai.vy = candVy;
            }
        }
    }

    movePlayer(p) {
        let nx = p.x + p.vx;
        let ny = p.y + p.vy;

        if (!this.isValid(nx, ny)) {
            p.deathReason = "crashed into map border";
            this.eliminatePlayer(p, null, "crashed into map border");
            return;
        }

        p.x = nx;
        p.y = ny;

        let existingTrailOwner = this.trailGrid[nx][ny];
        if (existingTrailOwner > 0 && existingTrailOwner !== p.id) {
            let victim = this.players.find(v => v.id === existingTrailOwner);
            if (victim && victim.isAlive) {
                // Shield Invincibility Check
                if (victim.shieldActive) {
                    victim.shieldActive = false;
                    this.playSound('shield_save');
                    this.addKillToast(`🛡️ <b>SHIELD SAVED ${victim.name.toUpperCase()}!</b>`);
                } else {
                    victim.killedBy = p.name;
                    victim.deathReason = "trail cut";
                    p.kills++;
                    if (p === this.humanPlayer) {
                        this.playSound('kill');
                        if (p.kills >= 10) this.triggerAchievement('killer_10');
                    }
                    this.eliminatePlayer(victim, p, "trail cut");
                }
            }
        }

        let currentOwner = this.grid[nx][ny];

        if (currentOwner !== p.id) {
            p.isOutside = true;
            if (p === this.humanPlayer) this.playSound('trail');

            if (this.trailGrid[nx][ny] === p.id) {
                p.deathReason = "self-collision";
                this.eliminatePlayer(p, p, "self-collision");
                return;
            }

            p.trail.push({ x: nx, y: ny });
            this.trailGrid[nx][ny] = p.id;
        } else {
            if (p.isOutside) {
                this.performCapture(p);
                p.isOutside = false;
                p.trail = [];
            }
        }
    }

    performCapture(p) {
        let pId = p.id;
        let prevPct = p.percentage;

        p.trail.forEach(pt => {
            this.grid[pt.x][pt.y] = pId;
            this.trailGrid[pt.x][pt.y] = 0;
        });

        let visited = Array(GRID).fill(false).map(() => Array(GRID).fill(false));
        let queue = [];

        for (let x = 0; x < GRID; x++) {
            if (this.grid[x][0] !== pId) { visited[x][0] = true; queue.push({ x, y: 0 }); }
            if (this.grid[x][GRID - 1] !== pId) { visited[x][GRID - 1] = true; queue.push({ x: x, y: GRID - 1 }); }
        }
        for (let y = 0; y < GRID; y++) {
            if (this.grid[0][y] !== pId) { visited[0][y] = true; queue.push({ x: 0, y }); }
            if (this.grid[GRID - 1][y] !== pId) { visited[GRID - 1][y] = true; queue.push({ x: GRID - 1, y }); }
        }

        while (queue.length > 0) {
            let curr = queue.shift();
            let dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
            dirs.forEach(d => {
                let tx = curr.x + d.x;
                let ty = curr.y + d.y;
                if (this.isValid(tx, ty) && !visited[tx][ty] && this.grid[tx][ty] !== pId) {
                    visited[tx][ty] = true;
                    queue.push({ x: tx, y: ty });
                }
            });
        }

        let newlyClaimed = 0;
        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                if (!visited[x][y]) {
                    if (this.grid[x][y] !== pId) newlyClaimed++;
                    this.grid[x][y] = pId;
                    this.trailGrid[x][y] = 0;
                }
            }
        }

        this.updateStats();
        let gainedPct = (p.percentage - prevPct).toFixed(2);
        if (p === this.humanPlayer) {
            if (gainedPct > 0.1) {
                this.playSound('capture');
                this.addKillToast(`✨ <b>Captured +${gainedPct}% Territory!</b>`);
            }
            if (p.percentage >= 25.0) this.triggerAchievement('territory_25');
        }
    }

    checkCollisions() {
        this.players.filter(p => p.isAlive).forEach(p => {
            this.players.filter(other => other.isAlive && other.id !== p.id).forEach(other => {
                if (p.x === other.x && p.y === other.y) {
                    p.deathReason = "head-to-head collision";
                    this.eliminatePlayer(p, other, "head-to-head collision");
                }
            });
        });
    }

    eliminatePlayer(victim, attacker, reason) {
        victim.isAlive = false;
        victim.vx = 0;
        victim.vy = 0;

        let totalCells = GRID * GRID;
        let count = 0;
        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                if (this.grid[x][y] === victim.id) count++;
            }
        }
        let currentPct = (count / totalCells) * 100.0;
        victim.finalPercentage = Math.max(currentPct, victim.percentage, victim.maxPercentage);
        if (victim.finalPercentage === 0) victim.finalPercentage = (81 / totalCells) * 100.0;

        victim.trail.forEach(pt => { this.trailGrid[pt.x][pt.y] = 0; });
        victim.trail = [];

        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                if (this.grid[x][y] === victim.id) this.grid[x][y] = 0;
                if (this.trailGrid[x][y] === victim.id) this.trailGrid[x][y] = 0;
            }
        }

        let msg = "";
        if (attacker && attacker !== victim) {
            msg = `💀 <b>${attacker.name}</b> eliminated <b>${victim.name}</b> (${reason})`;
        } else if (victim === this.humanPlayer) {
            msg = `⚠️ <b>YOU DIED:</b> ${reason}`;
            this.playSound('gameover');
        } else {
            msg = `💀 <b>${victim.name}</b> was eliminated (${reason})`;
        }
        this.addKillToast(msg);

        if (victim.isAI && !this.isGameOver) {
            setTimeout(() => {
                if (!this.isGameOver && !victim.isAlive) this.respawnAI(victim);
            }, 6000);
        }
    }

    respawnAI(ai) {
        let rx = 15 + Math.floor(Math.random() * (GRID - 30));
        let ry = 15 + Math.floor(Math.random() * (GRID - 30));

        ai.x = rx;
        ai.y = ry;
        ai.vx = 0;
        ai.vy = 0;
        ai.trail = [];
        ai.isOutside = false;
        ai.isAlive = true;

        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                let tx = rx + dx;
                let ty = ry + dy;
                if (this.isValid(tx, ty)) this.grid[tx][ty] = ai.id;
            }
        }
        this.updateStats();
        this.renderUI();
        this.addKillToast(`🤖 <b>${ai.name}</b> respawned!`);
    }

    addKillToast(text) {
        const feed = document.getElementById('killFeed');
        if (!feed) return;

        const toast = document.createElement('div');
        toast.className = 'kill-toast';
        toast.innerHTML = text;

        feed.appendChild(toast);

        setTimeout(() => {
            if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
        }, 3500);
    }

    calculateScore(p) {
        return Math.floor((p.percentage * 500) + (p.kills * 250) + (p.coins * 10) + (this.elapsedSeconds * 5));
    }

    updateStats() {
        let totalCells = GRID * GRID;
        this.players.forEach(p => {
            let count = 0;
            for (let x = 0; x < GRID; x++) {
                for (let y = 0; y < GRID; y++) {
                    if (this.grid[x][y] === p.id) count++;
                }
            }
            p.claimedCount = count;
            p.percentage = (count / totalCells) * 100.0;
            if (p.percentage > p.maxPercentage) p.maxPercentage = p.percentage;
            p.score = this.calculateScore(p);
        });

        if (this.humanPlayer && this.humanPlayer.score >= 5000) {
            this.triggerAchievement('high_scorer');
        }
    }

    renderUI() {
        const pctFill = document.getElementById('playerPctFill');
        const pctText = document.getElementById('playerPctText');
        const killsText = document.getElementById('playerKillsText');
        const scoreText = document.getElementById('playerScoreText');

        if (pctFill) pctFill.style.width = `${Math.min(100, this.humanPlayer.percentage)}%`;
        if (pctText) pctText.textContent = `🏆 ${this.humanPlayer.percentage.toFixed(2)} %`;
        if (killsText) killsText.textContent = `x${this.humanPlayer.kills}`;
        if (scoreText) scoreText.textContent = `⭐ ${this.humanPlayer.score.toLocaleString()} PTS`;

        const lbContainer = document.getElementById('leaderboardList');
        if (lbContainer) {
            let sorted = [...this.players].sort((a, b) => b.score - a.score);
            let html = '';
            sorted.slice(0, 5).forEach((p, idx) => {
                let isPlayer = (p.id === this.humanPlayer.id);
                let rankClass = isPlayer ? 'lb-card player-card' : 'lb-card';
                html += `
                    <div class="${rankClass}">
                        <span class="lb-rank">#${idx + 1}</span>
                        <span class="lb-name" style="color: ${p.color};">${p.name}</span>
                        <span class="lb-pct">${p.score} PTS</span>
                    </div>
                `;
            });
            lbContainer.innerHTML = html;
        }

        this.renderMinimap();
    }

    renderMinimap() {
        let mCanvas = this.minimapCanvas;
        let mCtx = this.minimapCtx;
        mCtx.clearRect(0, 0, mCanvas.width, mCanvas.height);

        let scale = mCanvas.width / GRID;

        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                let owner = this.grid[x][y];
                if (owner > 0) {
                    let p = this.players.find(player => player.id === owner);
                    if (p) {
                        mCtx.fillStyle = p.color;
                        mCtx.fillRect(x * scale, y * scale, scale, scale);
                    }
                }
            }
        }

        this.players.forEach(p => {
            if (p.isAlive) {
                mCtx.fillStyle = p.color;
                mCtx.beginPath();
                mCtx.arc(p.x * scale, p.y * scale, 2.5, 0, Math.PI * 2);
                mCtx.fill();
            }
        });
    }

    checkGameOver() {
        if (this.isGameOver) return;

        let aliveAIs = this.players.filter(p => p.isAI && p.isAlive).length;
        let humanDead = !this.humanPlayer.isAlive;
        let humanWon = !humanDead && aliveAIs === 0;

        if (humanDead || humanWon) {
            this.isGameOver = true;

            let finalPct = Math.max(this.humanPlayer.percentage, this.humanPlayer.finalPercentage, this.humanPlayer.maxPercentage);
            let finalScore = this.humanPlayer.score;

            let sorted = [...this.players].sort((a, b) => b.score - a.score);
            let winner = sorted[0].name;
            let humanRank = sorted.findIndex(p => p.id === this.humanPlayer.id) + 1;

            let coinsEarned = (this.humanPlayer.kills * 50) + Math.max(10, Math.floor(finalPct * 10)) + this.humanPlayer.coins;
            this.addCoins(coinsEarned);

            // Update Career Stats
            this.stats.totalMatches++;
            if (humanWon || humanRank === 1) {
                this.stats.totalWins++;
                this.triggerAchievement('first_win');
            }
            this.stats.totalKills += this.humanPlayer.kills;
            this.stats.sumScores += finalScore;
            this.stats.sumTerritories += finalPct;

            let isNewHighScore = false;
            if (finalScore > this.stats.bestScore) {
                this.stats.bestScore = finalScore;
                isNewHighScore = true;
            }
            if (finalPct > this.stats.bestTerritory) {
                this.stats.bestTerritory = finalPct;
            }
            this.saveStatsData();

            this.saveMatchRecord(winner, finalScore, finalPct, humanRank);

            const titleElem = document.getElementById('overlayTitle');
            const newHighElem = document.getElementById('newHighScoreBadge');
            const reasonElem = document.getElementById('overlayDeathReason');

            const scoreStat = document.getElementById('overlayScoreStat');
            const pctStat = document.getElementById('overlayPctStat');
            const killsStat = document.getElementById('overlayKillsStat');
            const coinsStat = document.getElementById('overlayCoinsStat');
            const timeStat = document.getElementById('overlayTimeStat');
            const rankStat = document.getElementById('overlayRankStat');
            const bestScoreStat = document.getElementById('overlayBestScoreStat');
            const bestPctStat = document.getElementById('overlayBestPctStat');

            if (scoreStat) scoreStat.textContent = `${finalScore.toLocaleString()}`;
            if (pctStat) pctStat.textContent = `${finalPct.toFixed(2)}%`;
            if (killsStat) killsStat.textContent = `${this.humanPlayer.kills}`;
            if (coinsStat) coinsStat.textContent = `+${coinsEarned}`;
            if (rankStat) rankStat.textContent = `#${humanRank}`;
            if (bestScoreStat) bestScoreStat.textContent = `${this.stats.bestScore.toLocaleString()}`;
            if (bestPctStat) bestPctStat.textContent = `${this.stats.bestTerritory.toFixed(2)}%`;

            const mins = Math.floor(this.elapsedSeconds / 60);
            const secs = this.elapsedSeconds % 60;
            if (timeStat) timeStat.textContent = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;

            if (isNewHighScore) {
                if (newHighElem) newHighElem.classList.remove('hidden');
                this.playSound('victory');
            } else {
                if (newHighElem) newHighElem.classList.add('hidden');
            }

            if (humanWon) {
                if (titleElem) { titleElem.textContent = "🏆 VICTORY!"; titleElem.style.color = "#10B981"; }
                if (reasonElem) {
                    reasonElem.innerHTML = `🏆 <b>1st Place Winner!</b>`;
                    reasonElem.style.background = "rgba(16, 185, 129, 0.2)";
                    reasonElem.style.color = "#10B981";
                    reasonElem.style.borderColor = "#059669";
                }
                this.playSound('victory');
            } else {
                if (titleElem) { titleElem.textContent = "GAME OVER"; titleElem.style.color = "#EF4444"; }
                if (reasonElem) {
                    let text = this.humanPlayer.killedBy ? `💀 Killed by <b>${this.humanPlayer.killedBy}</b>` : `💀 ${this.humanPlayer.deathReason || 'Eliminated'}`;
                    reasonElem.innerHTML = text;
                    reasonElem.style.background = "rgba(239, 68, 68, 0.15)";
                    reasonElem.style.color = "#F87171";
                }
            }

            let html = ``;
            sorted.forEach((p, idx) => {
                let badge = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                html += `<div>${badge} <b>${p.name}</b> - ${p.score.toLocaleString()} PTS (${p.percentage.toFixed(2)}%)</div>`;
            });
            document.getElementById('overlayRankings').innerHTML = html;
            document.getElementById('gameOverlay').classList.remove('hidden');
        }
    }

    saveMatchRecord(winner, score, pct, rank) {
        let matches = JSON.parse(localStorage.getItem('tr_match_records') || '[]');
        matches.unshift({
            id: matches.length + 1,
            player: this.humanPlayer.name,
            score: score,
            pct: pct,
            kills: this.humanPlayer.kills,
            time: `${Math.floor(this.elapsedSeconds / 60)}m ${this.elapsedSeconds % 60}s`,
            date: new Date().toLocaleDateString(),
            rank: rank
        });
        localStorage.setItem('tr_match_records', JSON.stringify(matches.slice(0, 20)));
    }

    openDBModal() {
        let matches = JSON.parse(localStorage.getItem('tr_match_records') || '[]');
        if (matches.length === 0) {
            matches = [
                { rank: 1, player: "Player", score: 4250, pct: 18.5, kills: 4, time: "2m 15s", date: "Today" },
                { rank: 2, player: "Dahlia", score: 3100, pct: 14.2, kills: 2, time: "1m 45s", date: "Yesterday" }
            ];
        }

        let body = document.getElementById('dbHistoryBody');
        body.innerHTML = '';
        matches.forEach((m) => {
            let medal = m.rank === 1 ? '🥇' : m.rank === 2 ? '🥈' : m.rank === 3 ? '🥉' : `#${m.rank}`;
            body.innerHTML += `
                <tr>
                    <td style="font-weight: 900; color: #38BDF8;">${medal}</td>
                    <td><b>${m.player}</b></td>
                    <td><span style="color:#FBBF24;font-weight:900;">${m.score.toLocaleString()}</span></td>
                    <td><span style="color:#00E5FF;">${m.pct.toFixed(2)}%</span></td>
                    <td>x${m.kills}</td>
                    <td>${m.time}</td>
                    <td>${m.date}</td>
                </tr>
            `;
        });
        document.getElementById('dbModal').classList.remove('hidden');
    }

    // --- Skins Grid UI ---
    renderSkinsGrid() {
        const grid = document.getElementById('skinsGrid');
        if (!grid) return;

        let html = '';
        this.availableSkins.forEach(s => {
            let isSelected = s.id === this.selectedSkinId;
            let cardClass = isSelected ? 'skin-card active' : 'skin-card';
            let btnText = isSelected ? 'SELECTED ✓' : s.unlocked ? 'SELECT' : `UNLOCK (${s.price} 🪙)`;
            let btnClass = isSelected ? 'btn-skin-action btn-secondary' : 'btn-skin-action';

            html += `
                <div class="${cardClass}">
                    <div class="skin-swatch" style="background: ${s.color};"></div>
                    <div class="skin-title">${s.name}</div>
                    <div class="skin-status">${s.unlocked ? 'Unlocked' : `Requires ${s.price} 🪙`}</div>
                    <button class="${btnClass}" onclick="window.gameInstance.handleSkinClick('${s.id}')">${btnText}</button>
                </div>
            `;
        });
        grid.innerHTML = html;
    }

    handleSkinClick(skinId) {
        const skin = this.availableSkins.find(s => s.id === skinId);
        if (!skin) return;

        if (skin.unlocked) {
            this.selectedSkinId = skinId;
            this.saveSkinsData();
            this.playSound('click');
        } else {
            if (this.stats.totalCoins >= skin.price) {
                this.stats.totalCoins -= skin.price;
                skin.unlocked = true;
                this.selectedSkinId = skinId;
                this.saveSkinsData();
                this.saveStatsData();
                this.playSound('victory');
                this.addKillToast(`🎨 <b>UNLOCKED ${skin.name.toUpperCase()} SKIN!</b> 🎉`);
            } else {
                this.playSound('gameover');
                this.addKillToast(`⚠️ Need ${skin.price - this.stats.totalCoins} more Gold Coins!`);
            }
        }
    }

    updateSkinPreviewUI() {
        const skin = this.availableSkins.find(s => s.id === this.selectedSkinId) || this.availableSkins[0];
        const dot = document.getElementById('skinPreviewDot');
        const name = document.getElementById('skinPreviewName');
        if (dot) dot.style.background = skin.color;
        if (name) name.textContent = skin.name;
    }

    // --- 7-Day Rewards & Streak System ---
    openDailyRewardModal() {
        const todayStr = new Date().toDateString();
        const lastClaim = localStorage.getItem('tr_last_daily_claim');
        const isAlreadyClaimed = (lastClaim === todayStr);

        let currentStreak = parseInt(localStorage.getItem('tr_daily_streak') || '1', 10);
        if (isNaN(currentStreak) || currentStreak < 1 || currentStreak > 7) currentStreak = 1;

        const rewardData = [
            { day: 1, text: '+100 🪙', amount: 100 },
            { day: 2, text: '+250 🪙', amount: 250 },
            { day: 3, text: '+500 🪙', amount: 500 },
            { day: 4, text: '⚡ + 750 🪙', amount: 750 },
            { day: 5, text: '+1,000 🪙', amount: 1000 },
            { day: 6, text: '🛡️ + 1.5K 🪙', amount: 1500 },
            { day: 7, text: '🎨 + 3.0K 🪙', amount: 3000 }
        ];

        const grid = document.getElementById('dailyStreakGrid');
        if (grid) {
            let html = '';
            rewardData.forEach(r => {
                let isClaimed = (r.day < currentStreak) || (r.day === currentStreak && isAlreadyClaimed);
                let isActive = (r.day === currentStreak && !isAlreadyClaimed);
                let cls = isClaimed ? 'day-card claimed' : isActive ? 'day-card active' : 'day-card';
                let statusText = isClaimed ? 'Claimed ✓' : isActive ? 'READY!' : 'Locked';

                html += `
                    <div class="${cls}">
                        <span class="day-num">Day ${r.day}</span>
                        <span class="day-reward-text">${r.text}</span>
                        <span>${statusText}</span>
                    </div>
                `;
            });
            grid.innerHTML = html;
        }

        const claimBtn = document.getElementById('btn-claim-reward');
        if (claimBtn) {
            if (isAlreadyClaimed) {
                claimBtn.textContent = "ALREADY CLAIMED TODAY ✓";
                claimBtn.disabled = true;
                claimBtn.style.opacity = "0.5";
                claimBtn.style.cursor = "not-allowed";
            } else {
                let activeReward = rewardData[(currentStreak - 1) % 7];
                claimBtn.textContent = `CLAIM DAY ${currentStreak} REWARD (${activeReward.text}) 🎉`;
                claimBtn.disabled = false;
                claimBtn.style.opacity = "1";
                claimBtn.style.cursor = "pointer";
            }
        }

        document.getElementById('rewardModal').classList.remove('hidden');
    }

    claimDailyReward() {
        const todayStr = new Date().toDateString();
        const lastClaim = localStorage.getItem('tr_last_daily_claim');

        if (lastClaim === todayStr) {
            this.playSound('gameover');
            this.addKillToast(`⚠️ <b>ALREADY CLAIMED TODAY!</b> Come back tomorrow for your next reward!`);
            document.getElementById('rewardModal').classList.add('hidden');
            return;
        }

        let currentStreak = parseInt(localStorage.getItem('tr_daily_streak') || '1', 10);
        if (isNaN(currentStreak) || currentStreak < 1 || currentStreak > 7) currentStreak = 1;

        const rewardData = [
            { day: 1, amount: 100 },
            { day: 2, amount: 250 },
            { day: 3, amount: 500 },
            { day: 4, amount: 750 },
            { day: 5, amount: 1000 },
            { day: 6, amount: 1500 },
            { day: 7, amount: 3000 }
        ];

        let reward = rewardData[(currentStreak - 1) % 7];
        this.addCoins(reward.amount);

        // Record today's claim date
        localStorage.setItem('tr_last_daily_claim', todayStr);

        // Advance streak for tomorrow (1 through 7, wraps back to 1)
        let nextStreak = (currentStreak % 7) + 1;
        localStorage.setItem('tr_daily_streak', nextStreak.toString());

        this.playSound('victory');
        this.addKillToast(`🎁 <b>DAY ${currentStreak} REWARD CLAIMED!</b> +${reward.amount} Gold Coins added! 🎉`);

        // Refresh modal UI to show "ALREADY CLAIMED TODAY" status
        this.openDailyRewardModal();

        setTimeout(() => {
            document.getElementById('rewardModal').classList.add('hidden');
        }, 1500);
    }

    // --- Achievements & Career Stats Modals ---
    renderAchievementsGrid() {
        const grid = document.getElementById('achievementsGrid');
        if (!grid) return;

        let html = '';
        this.achievements.forEach(a => {
            let cls = a.unlocked ? 'achievement-card unlocked' : 'achievement-card';
            html += `
                <div class="${cls}">
                    <span class="badge-icon">${a.icon}</span>
                    <div class="achievement-info">
                        <h4>${a.name} ${a.unlocked ? '✓' : ''}</h4>
                        <p>${a.desc}</p>
                    </div>
                </div>
            `;
        });
        grid.innerHTML = html;
    }

    renderStatsModal() {
        const totalMatches = document.getElementById('statTotalMatches');
        const totalWins = document.getElementById('statTotalWins');
        const bestScore = document.getElementById('statBestScore');
        const bestTerritory = document.getElementById('statBestTerritory');
        const totalKills = document.getElementById('statTotalKills');
        const totalCoins = document.getElementById('statTotalCoins');
        const avgScore = document.getElementById('statAvgScore');
        const avgTerritory = document.getElementById('statAvgTerritory');

        if (totalMatches) totalMatches.textContent = this.stats.totalMatches;
        if (totalWins) totalWins.textContent = this.stats.totalWins;
        if (bestScore) bestScore.textContent = this.stats.bestScore.toLocaleString();
        if (bestTerritory) bestTerritory.textContent = `${this.stats.bestTerritory.toFixed(2)}%`;
        if (totalKills) totalKills.textContent = this.stats.totalKills;
        if (totalCoins) totalCoins.textContent = this.stats.totalCoins.toLocaleString();

        const avgS = this.stats.totalMatches > 0 ? Math.floor(this.stats.sumScores / this.stats.totalMatches) : 0;
        const avgT = this.stats.totalMatches > 0 ? (this.stats.sumTerritories / this.stats.totalMatches).toFixed(2) : '0.00';

        if (avgScore) avgScore.textContent = avgS.toLocaleString();
        if (avgTerritory) avgTerritory.textContent = `${avgT}%`;
    }

    render() {
        let targetCamX = this.humanPlayer.x * CELL_SIZE + CELL_SIZE / 2;
        let targetCamY = this.humanPlayer.y * CELL_SIZE + CELL_SIZE / 2;
        this.cameraX += (targetCamX - this.cameraX) * 0.1;
        this.cameraY += (targetCamY - this.cameraY) * 0.1;

        let ctx = this.ctx;
        let w = this.canvas.width;
        let h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(this.zoomScale, this.zoomScale);
        ctx.translate(-this.cameraX, -this.cameraY);

        // 1. Draw World Arena Grid Background
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 1;
        for (let x = 0; x <= MAP_SIZE; x += CELL_SIZE) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, MAP_SIZE);
            ctx.stroke();
        }
        for (let y = 0; y <= MAP_SIZE; y += CELL_SIZE) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(MAP_SIZE, y);
            ctx.stroke();
        }

        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 6;
        ctx.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);

        // 2. Draw Territory Claims
        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                let owner = this.grid[x][y];
                if (owner > 0) {
                    let p = this.players.find(player => player.id === owner);
                    if (p) {
                        ctx.fillStyle = p.territoryColor;
                        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                    }
                }
            }
        }

        // 3. Draw Active Glowing Player Trails
        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                let trailOwner = this.trailGrid[x][y];
                if (trailOwner > 0) {
                    let p = this.players.find(player => player.id === trailOwner);
                    if (p) {
                        ctx.fillStyle = p.trailColor;
                        ctx.shadowColor = p.color;
                        ctx.shadowBlur = 8;
                        ctx.fillRect(x * CELL_SIZE + 2, y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
                        ctx.shadowBlur = 0;
                    }
                }
            }
        }

        // 4. Render Collectible Canvas Coins & Power-Ups
        this.spawnedItems.forEach(item => {
            let ix = item.x * CELL_SIZE + CELL_SIZE / 2;
            let iy = item.y * CELL_SIZE + CELL_SIZE / 2;

            ctx.save();
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (item.type === 'coin') {
                ctx.fillText('🪙', ix, iy);
            } else if (item.type === 'speed') {
                ctx.fillText('⚡', ix, iy);
            } else if (item.type === 'shield') {
                ctx.fillText('🛡️', ix, iy);
            } else if (item.type === 'magnet') {
                ctx.fillText('🧲', ix, iy);
            } else if (item.type === 'dash') {
                ctx.fillText('💨', ix, iy);
            }
            ctx.restore();
        });

        // 5. Render Player Heads, Shields & Nametags
        this.players.forEach(p => {
            if (p.isAlive) {
                let px = p.x * CELL_SIZE;
                let py = p.y * CELL_SIZE;

                if (p.shieldActive) {
                    ctx.strokeStyle = '#00E5FF';
                    ctx.lineWidth = 3;
                    ctx.shadowColor = '#00E5FF';
                    ctx.shadowBlur = 12;
                    ctx.strokeRect(px - 4, py - 4, CELL_SIZE + 8, CELL_SIZE + 8);
                    ctx.shadowBlur = 0;
                }

                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 12;
                ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
                ctx.shadowBlur = 0;

                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.strokeRect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4);

                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(px + CELL_SIZE / 3, py + CELL_SIZE / 3, CELL_SIZE / 3, CELL_SIZE / 3);

                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 12px Outfit, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(p.name, px + CELL_SIZE / 2, py - 6);
            }
        });

        ctx.restore();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.gameInstance = new TerritoryRushGame();
});
