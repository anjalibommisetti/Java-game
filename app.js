// Paper.io 2 Official Web Engine

const GRID = 140;
const CELL_SIZE = 28;
const MAP_SIZE = GRID * CELL_SIZE; // 3920px World pixel size

class Player {
    constructor(id, name, isAI, color, territoryColor, trailColor) {
        this.id = id;
        this.name = name;
        this.isAI = isAI;
        this.color = color;
        this.territoryColor = territoryColor;
        this.trailColor = trailColor;

        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;

        this.trail = [];
        this.isOutside = false;
        this.isAlive = true;

        this.claimedCount = 0;
        this.percentage = 0.0;
        this.kills = 0;

        // AI behavior fields
        this.aiTarget = null;
        this.aiExcursion = 0;
        this.aiMaxExcursion = 10;
        this.deathReason = "";
        this.killedBy = "";
    }
}

class PaperIOGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');

        this.grid = Array(GRID).fill(0).map(() => Array(GRID).fill(0));
        this.trailGrid = Array(GRID).fill(0).map(() => Array(GRID).fill(0));

        this.players = [];
        this.humanPlayer = null;

        this.cameraX = 0;
        this.cameraY = 0;
        this.zoomScale = 0.90; // Default wide immersive camera scale (90%)
        this.isPaused = false;
        this.isGameOver = false;
        this.gameStarted = false; // Waiting for user to click PLAY GAME NOW
        this.matchInitialized = false;

        this.elapsedSeconds = 0;
        this.lastStepTime = 0;
        this.lastTimerTick = 0;
        
        this.setSpeedMode(localStorage.getItem('paperio_speed_mode') || 'normal');
        this.setControlMode(localStorage.getItem('paperio_control_mode') || 'keyboard');

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.setupPlayers();
        this.bindControls();
        this.startNewMatch();
        this.gameStarted = false; // Freeze match until user clicks PLAY GAME NOW
        document.getElementById('startOverlay').classList.remove('hidden');

        requestAnimationFrame((t) => this.loop(t));
    }

    setSpeedMode(mode) {
        this.currentSpeedMode = mode;
        const speedMap = { slow: 130, normal: 95, fast: 60 };
        this.baseStepDelay = speedMap[mode] || 95;
        this.stepDelay = this.baseStepDelay;
        localStorage.setItem('paperio_speed_mode', mode);

        const speedBtns = document.querySelectorAll('.speed-btn');
        speedBtns.forEach(btn => {
            if (btn.getAttribute('data-speed') === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    setControlMode(mode) {
        this.controlMode = mode;
        localStorage.setItem('paperio_control_mode', mode);

        const ctrlBtns = document.querySelectorAll('.ctrl-mode-btn');
        ctrlBtns.forEach(btn => {
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
        const savedName = localStorage.getItem('paperio_player_name') || 'Player';
        const savedColor = localStorage.getItem('paperio_player_color') || '#00E5FF';

        this.humanPlayer = new Player(1, savedName, false, savedColor, "#DC2626", savedColor);
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
        }
        const saveName = name.trim() || 'Player';
        localStorage.setItem('paperio_player_name', saveName);
        if (color) localStorage.setItem('paperio_player_color', color);
        this.updateProfileHUD(updateInput);
    }

    startNewMatch() {
        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                this.grid[x][y] = 0;
                this.trailGrid[x][y] = 0;
            }
        }

        this.isGameOver = false;
        this.isPaused = false;
        this.gameStarted = true;
        this.matchInitialized = true;
        this.elapsedSeconds = 0;
        this.lastTimerTick = performance.now();

        document.getElementById('gameOverlay').classList.add('hidden');
        document.getElementById('pauseOverlay').classList.add('hidden');
        document.getElementById('startOverlay').classList.add('hidden');

        // Spawn Locations evenly distributed on 140x140 arena map
        const spawns = [
            { x: 30, y: 30 },
            { x: 110, y: 110 },
            { x: 110, y: 30 },
            { x: 30, y: 110 },
            { x: 70, y: 30 },
            { x: 70, y: 110 },
            { x: 110, y: 70 }
        ];

        this.players.forEach((p, idx) => {
            let s = spawns[idx % spawns.length];
            p.x = s.x;
            p.y = s.y;
            p.vx = 0; // Wait for player directional input before moving
            p.vy = 0;
            p.trail = [];
            p.isOutside = false;
            p.isAlive = true;
            p.kills = 0;
            p.deathReason = "";
            p.killedBy = "";
            p.aiExcursion = 0;
            p.aiMaxExcursion = 8 + Math.floor(Math.random() * 8);

            // Initial 9x9 Base (radius 4)
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

        this.updateStats();
        this.renderUI();
        this.addKillToast(`🎮 <b>Match Started!</b> Conquer the arena!`);
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
        this.addKillToast(`⏸ <b>Game Paused</b>`);
    }

    resumeGame() {
        this.isPaused = false;
        this.lastTimerTick = performance.now();
        document.getElementById('pauseOverlay').classList.add('hidden');
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
        // Mouse Cursor Steering Controls (Only active if Mouse Follow mode is selected)
        window.addEventListener('mousemove', (e) => {
            if (this.controlMode !== 'mouse') return; // Ignore mouse movements in Keyboard & D-Pad mode!
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

        // Keyboard Controls for User Player & Pause
        window.addEventListener('keydown', (e) => {
            const key = e.key ? e.key.toLowerCase() : '';
            if (key === 'p' || key === 'escape') {
                this.togglePause();
                return;
            }

            // Prevent browser window scroll when using arrow keys / WASD during gameplay
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

        // On-Screen D-Pad Controls for Mouse Click / Touch
        const setUp = () => { if (this.humanPlayer && this.humanPlayer.vy !== 1 && !this.isPaused) { this.humanPlayer.vx = 0; this.humanPlayer.vy = -1; } };
        const setDown = () => { if (this.humanPlayer && this.humanPlayer.vy !== -1 && !this.isPaused) { this.humanPlayer.vx = 0; this.humanPlayer.vy = 1; } };
        const setLeft = () => { if (this.humanPlayer && this.humanPlayer.vx !== 1 && !this.isPaused) { this.humanPlayer.vx = -1; this.humanPlayer.vy = 0; } };
        const setRight = () => { if (this.humanPlayer && this.humanPlayer.vx !== -1 && !this.isPaused) { this.humanPlayer.vx = 1; this.humanPlayer.vy = 0; } };

        document.getElementById('btn-up')?.addEventListener('click', setUp);
        document.getElementById('btn-down')?.addEventListener('click', setDown);
        document.getElementById('btn-left')?.addEventListener('click', setLeft);
        document.getElementById('btn-right')?.addEventListener('click', setRight);

        // HUD Pause & Resume & Menu Buttons
        document.getElementById('btn-pause-hud')?.addEventListener('click', () => this.pauseGame());
        document.getElementById('btn-resume-game')?.addEventListener('click', () => this.resumeGame());
        document.getElementById('btn-restart-paused')?.addEventListener('click', () => this.startNewMatch());
        document.getElementById('btn-main-menu-paused')?.addEventListener('click', () => this.showStartOverlay());
        document.getElementById('btn-main-menu-gameover')?.addEventListener('click', () => this.showStartOverlay());

        // Zoom Slider & Zoom Buttons & Mouse Wheel Zoom
        const zoomSlider = document.getElementById('zoomSlider');
        if (zoomSlider) {
            zoomSlider.addEventListener('input', (e) => {
                this.setZoom(parseFloat(e.target.value) / 100);
            });
        }
        document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.setZoom(this.zoomScale + 0.15));
        document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.setZoom(this.zoomScale - 0.15));

        window.addEventListener('wheel', (e) => {
            if (e.target.closest('#dbModal') || e.target.closest('#gameOverlay') || e.target.closest('#startOverlay')) return;
            e.preventDefault();
            if (e.deltaY > 0) {
                this.setZoom(this.zoomScale - 0.05);
            } else {
                this.setZoom(this.zoomScale + 0.05);
            }
        }, { passive: false });

        // Profile Editor Listeners
        const nameInput = document.getElementById('playerNameInput');
        const validationMsg = document.getElementById('nameValidationMsg');

        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                nameInput.classList.remove('input-error');
                if (validationMsg) validationMsg.classList.add('hidden');
                this.saveProfile(e.target.value, null, false);
            });
            nameInput.addEventListener('focus', () => {
                nameInput.select();
            });
            nameInput.addEventListener('keydown', (e) => {
                e.stopPropagation();
            });
        }

        const clearBtn = document.getElementById('btn-clear-name');
        if (clearBtn && nameInput) {
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                nameInput.value = '';
                nameInput.focus();
                this.saveProfile('', null, false);
            });
        }

        const colorBtns = document.querySelectorAll('.color-btn');
        colorBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                colorBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const selectedColor = btn.getAttribute('data-color');
                this.saveProfile(this.humanPlayer.name, selectedColor, false);
            });
        });

        const speedBtns = document.querySelectorAll('.speed-btn');
        speedBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-speed');
                this.setSpeedMode(mode);
            });
        });

        const ctrlBtns = document.querySelectorAll('.ctrl-mode-btn');
        ctrlBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-mode');
                this.setControlMode(mode);
            });
        });

        const openProfileEditor = () => {
            this.gameStarted = false;
            document.getElementById('startOverlay').classList.remove('hidden');
            setTimeout(() => document.getElementById('playerNameInput')?.focus(), 100);
        };

        document.getElementById('btn-edit-profile')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openProfileEditor();
        });

        document.querySelector('.profile-pill')?.addEventListener('click', openProfileEditor);

        // Start Game Button with Nickname Validation
        const startBtn = document.getElementById('btn-start-play');
        if (startBtn) {
            startBtn.onclick = () => {
                const inputElem = document.getElementById('playerNameInput');
                const val = inputElem ? inputElem.value.trim() : '';

                if (!val) {
                    if (inputElem) inputElem.classList.add('input-error');
                    if (validationMsg) validationMsg.classList.remove('hidden');
                    if (inputElem) inputElem.focus();
                    return;
                }

                if (inputElem) inputElem.classList.remove('input-error');
                if (validationMsg) validationMsg.classList.add('hidden');

                const activeColorBtn = document.querySelector('.color-btn.active');
                const col = activeColorBtn ? activeColorBtn.getAttribute('data-color') : null;

                if (document.activeElement) document.activeElement.blur();
                window.focus();
                this.saveProfile(val, col, true);
                this.startNewMatch();
            };
        }

        document.getElementById('btn-restart').onclick = () => this.startNewMatch();
        document.getElementById('btn-daily-reward')?.addEventListener('click', () => {
            document.getElementById('rewardModal').classList.remove('hidden');
        });
        document.getElementById('btn-claim-reward')?.addEventListener('click', () => {
            document.getElementById('rewardModal').classList.add('hidden');
            this.claimDailyReward();
        });
        document.getElementById('btn-speed-boost')?.addEventListener('click', () => {
            this.activateSpeedBoost();
        });
        document.getElementById('btn-db-modal').onclick = () => this.openDBModal();
        document.getElementById('btn-close-modal').onclick = () => document.getElementById('dbModal').classList.add('hidden');
        
        window.addEventListener('click', (e) => {
            const dbModal = document.getElementById('dbModal');
            const rewardModal = document.getElementById('rewardModal');
            if (e.target === dbModal) dbModal.classList.add('hidden');
            if (e.target === rewardModal) rewardModal.classList.add('hidden');
        });
    }

    loop(now) {
        requestAnimationFrame((t) => this.loop(t));

        if (!this.lastStepTime) this.lastStepTime = now;
        const delta = now - this.lastStepTime;

        // Timer Tick Increment (Every 1 second when active & not paused)
        if (this.gameStarted && !this.isPaused && !this.isGameOver) {
            if (now - this.lastTimerTick >= 1000) {
                this.elapsedSeconds++;
                this.lastTimerTick = now;
                this.updateTimerDisplay();
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

        // 3. Collision Checks & Game Over Evaluation
        this.checkCollisions();
        this.updateStats();
        this.renderUI();
        this.checkGameOver();
    }

    updateAIMovement(ai) {
        let isOwner = (this.grid[ai.x][ai.y] === ai.id);

        // 1. Boundary Wall Avoidance (Steer away if approaching map borders)
        const wallMargin = 5;
        if (ai.x <= wallMargin && ai.vx < 0) { ai.vx = 0; ai.vy = ai.y > GRID / 2 ? -1 : 1; return; }
        if (ai.x >= GRID - wallMargin && ai.vx > 0) { ai.vx = 0; ai.vy = ai.y > GRID / 2 ? -1 : 1; return; }
        if (ai.y <= wallMargin && ai.vy < 0) { ai.vy = 0; ai.vx = ai.x > GRID / 2 ? -1 : 1; return; }
        if (ai.y >= GRID - wallMargin && ai.vy > 0) { ai.vy = 0; ai.vx = ai.x > GRID / 2 ? -1 : 1; return; }

        // 2. Excursion Control
        if (!ai.isOutside && isOwner) {
            // Inside home base: venture out in a safe cardinal direction
            let dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
            // Filter directions that don't immediately hit a wall
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
                // Time to turn back towards home base
                this.steerAITowardsHome(ai);
            } else if (Math.random() < 0.15) {
                // Turn 90 degrees safely (avoiding immediate 180-degree self-collisions)
                let candVx = 0, candVy = 0;
                if (ai.vx !== 0) {
                    candVy = Math.random() < 0.5 ? 1 : -1;
                    candVx = 0;
                } else {
                    candVx = Math.random() < 0.5 ? 1 : -1;
                    candVy = 0;
                }

                // Check target cell is valid and NOT own trail
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
        // Find closest owned territory cell for AI
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

            // Verify steer target doesn't walk straight into own trail
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

        // Wall Border Collision
        if (!this.isValid(nx, ny)) {
            p.deathReason = "crashed into map border";
            this.eliminatePlayer(p, null, "crashed into map border");
            return;
        }

        p.x = nx;
        p.y = ny;

        // Check if player/AI steps on another player's active trail (TRAIL CUT ELIMINATION)
        let existingTrailOwner = this.trailGrid[nx][ny];
        if (existingTrailOwner > 0 && existingTrailOwner !== p.id) {
            let victim = this.players.find(v => v.id === existingTrailOwner);
            if (victim && victim.isAlive) {
                victim.killedBy = p.name;
                victim.deathReason = "trail cut";
                p.kills++;
                this.eliminatePlayer(victim, p, "trail cut");
            }
        }

        let currentOwner = this.grid[nx][ny];

        if (currentOwner !== p.id) {
            // Player is outside home territory drawing a trail
            p.isOutside = true;

            // Self-Collision (stepping on own trail)
            if (this.trailGrid[nx][ny] === p.id) {
                p.deathReason = "self-collision";
                this.eliminatePlayer(p, p, "self-collision");
                return;
            }

            p.trail.push({ x: nx, y: ny });
            this.trailGrid[nx][ny] = p.id;
        } else {
            // Player returned safely to home territory -> Capture Enclosed Area!
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

        // 1. Convert active trail to owned territory
        p.trail.forEach(pt => {
            this.grid[pt.x][pt.y] = pId;
            this.trailGrid[pt.x][pt.y] = 0;
        });

        // 2. Perimeter BFS Flood Fill to capture enclosed area
        let visited = Array(GRID).fill(false).map(() => Array(GRID).fill(false));
        let queue = [];

        // Push map borders into BFS queue if not owned by player
        for (let x = 0; x < GRID; x++) {
            if (this.grid[x][0] !== pId) { visited[x][0] = true; queue.push({ x, y: 0 }); }
            if (this.grid[x][GRID - 1] !== pId) { visited[x][GRID - 1] = true; queue.push({ x: x, y: GRID - 1 }); }
        }
        for (let y = 0; y < GRID; y++) {
            if (this.grid[0][y] !== pId) { visited[0][y] = true; queue.push({ x: 0, y }); }
            if (this.grid[GRID - 1][y] !== pId) { visited[GRID - 1][y] = true; queue.push({ x: GRID - 1, y }); }
        }

        // BFS traversal for all exterior uncaptured cells
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

        // 3. Any cell not visited by exterior flood fill is enclosed -> Claim it!
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
        if (p === this.humanPlayer && gainedPct > 0.1) {
            this.addKillToast(`✨ <b>Captured +${gainedPct}% Territory!</b>`);
        }
    }

    checkCollisions() {
        this.players.filter(p => p.isAlive).forEach(p => {
            // Check Head-to-Head Collisions
            this.players.filter(other => other.isAlive && other.id !== p.id).forEach(other => {
                if (p.x === other.x && p.y === other.y) {
                    if (p.isOutside && !other.isOutside) {
                        p.deathReason = "head-to-head collision";
                        this.eliminatePlayer(p, other, "head-to-head collision");
                    } else if (!p.isOutside && other.isOutside) {
                        other.deathReason = "head-to-head collision";
                        this.eliminatePlayer(other, p, "head-to-head collision");
                    } else {
                        p.deathReason = "head-to-head collision";
                        this.eliminatePlayer(p, other, "head-to-head collision");
                    }
                }
            });

            // Check Trail Cutting Collisions
            let trailOwnerId = this.trailGrid[p.x][p.y];
            if (trailOwnerId > 0 && trailOwnerId !== p.id) {
                let victim = this.players.find(v => v.id === trailOwnerId);
                if (victim && victim.isAlive) {
                    victim.killedBy = p.name;
                    victim.deathReason = "trail cut";
                    p.kills++;
                    this.eliminatePlayer(victim, p, "trail cut");
                }
            }
        });
    }

    eliminatePlayer(victim, attacker, reason) {
        victim.isAlive = false;
        victim.vx = 0;
        victim.vy = 0;

        // Clear victim's territory and active trail
        victim.trail.forEach(pt => {
            this.trailGrid[pt.x][pt.y] = 0;
        });
        victim.trail = [];

        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                if (this.grid[x][y] === victim.id) this.grid[x][y] = 0;
                if (this.trailGrid[x][y] === victim.id) this.trailGrid[x][y] = 0;
            }
        }

        // Live Feed Kill Toast Feedback
        let msg = "";
        if (attacker && attacker !== victim) {
            msg = `💀 <b>${attacker.name}</b> eliminated <b>${victim.name}</b> (${reason})`;
        } else if (victim === this.humanPlayer) {
            msg = `⚠️ <b>YOU DIED:</b> ${reason}`;
        } else {
            msg = `💀 <b>${victim.name}</b> was eliminated (${reason})`;
        }
        this.addKillToast(msg);

        // Schedule AI respawn after 6 seconds to keep map populated
        if (victim.isAI && !this.isGameOver) {
            setTimeout(() => {
                if (!this.isGameOver && !victim.isAlive) {
                    this.respawnAI(victim);
                }
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
        ai.aiExcursion = 0;

        // Spawn new 5x5 base
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                let tx = rx + dx;
                let ty = ry + dy;
                if (this.isValid(tx, ty)) {
                    this.grid[tx][ty] = ai.id;
                }
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
            if (toast && toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3500);
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
        });
    }

    renderUI() {
        // 1. Update Human Player Score Bar
        const pctFill = document.getElementById('playerPctFill');
        const pctText = document.getElementById('playerPctText');
        const killsText = document.getElementById('playerKillsText');

        if (pctFill) pctFill.style.width = `${Math.min(100, this.humanPlayer.percentage)}%`;
        if (pctText) pctText.textContent = `🏆 ${this.humanPlayer.percentage.toFixed(2)} %`;
        if (killsText) killsText.textContent = `x${this.humanPlayer.kills}`;

        // 2. Render Top Right Leaderboard
        const lbContainer = document.getElementById('leaderboardList');
        if (lbContainer) {
            let sorted = [...this.players].sort((a, b) => b.percentage - a.percentage);
            let html = '';
            sorted.slice(0, 5).forEach((p, idx) => {
                let isPlayer = (p.id === this.humanPlayer.id);
                let rankClass = isPlayer ? 'lb-card player-card' : 'lb-card';
                html += `
                    <div class="${rankClass}">
                        <span class="lb-rank">#${idx + 1}</span>
                        <span class="lb-name" style="color: ${p.color};">${p.name}</span>
                        <span class="lb-pct">${p.percentage.toFixed(2)}%</span>
                    </div>
                `;
            });
            lbContainer.innerHTML = html;
        }

        // 3. Render Minimap Radar
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

        // Render player dots on radar
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
            let sorted = [...this.players].sort((a, b) => b.percentage - a.percentage);
            let winner = sorted[0].name;

            // Calculate coins earned: 50 coins per kill + territory bonus
            let coinsEarned = (this.humanPlayer.kills * 50) + Math.floor(this.humanPlayer.percentage * 10);
            this.addCoins(coinsEarned);

            this.saveMatchToJDBC(winner, sorted);

            const titleElem = document.getElementById('overlayTitle');
            const subtitleElem = document.getElementById('overlaySubtitle');
            const reasonElem = document.getElementById('overlayDeathReason');

            const pctStat = document.getElementById('overlayPctStat');
            const killsStat = document.getElementById('overlayKillsStat');
            const coinsStat = document.getElementById('overlayCoinsStat');
            const timeStat = document.getElementById('overlayTimeStat');

            if (pctStat) pctStat.textContent = `${this.humanPlayer.percentage.toFixed(2)}%`;
            if (killsStat) killsStat.textContent = `${this.humanPlayer.kills}`;
            if (coinsStat) coinsStat.textContent = `+${coinsEarned}`;
            
            const mins = Math.floor(this.elapsedSeconds / 60);
            const secs = this.elapsedSeconds % 60;
            if (timeStat) timeStat.textContent = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;

            if (humanWon) {
                if (titleElem) { titleElem.textContent = "🏆 VICTORY!"; titleElem.style.color = "#10B981"; }
                if (subtitleElem) subtitleElem.textContent = `You conquered ${this.humanPlayer.percentage.toFixed(2)}% of the arena & eliminated all rivals!`;
                if (reasonElem) {
                    reasonElem.innerHTML = `🏆 <b>1st Place Winner!</b>`;
                    reasonElem.style.background = "rgba(16, 185, 129, 0.2)";
                    reasonElem.style.color = "#10B981";
                    reasonElem.style.borderColor = "#059669";
                }
            } else {
                if (titleElem) { titleElem.textContent = "GAME OVER"; titleElem.style.color = "#EF4444"; }
                if (subtitleElem) subtitleElem.textContent = `Conquered ${this.humanPlayer.percentage.toFixed(2)}% of the arena`;

                if (reasonElem) {
                    let text = "";
                    if (this.humanPlayer.killedBy) {
                        text = `💀 Killed by <strong style="color: #F8FAFC; margin: 0 4px;">${this.humanPlayer.killedBy}</strong> (${this.humanPlayer.deathReason || 'Trail Cut'})`;
                    } else if (this.humanPlayer.deathReason === "self-collision") {
                        text = `⚠️ Ran into your own trail!`;
                    } else if (this.humanPlayer.deathReason === "crashed into map border") {
                        text = `🧱 Crashed into the map boundary!`;
                    } else if (this.humanPlayer.deathReason === "head-to-head collision") {
                        text = `💥 Head-to-head collision!`;
                    } else {
                        text = `💀 ${this.humanPlayer.deathReason || 'Eliminated'}`;
                    }
                    reasonElem.innerHTML = text;
                    reasonElem.style.background = "rgba(239, 68, 68, 0.15)";
                    reasonElem.style.color = "#F87171";
                    reasonElem.style.borderColor = "rgba(239, 68, 68, 0.4)";
                }
            }

            let html = ``;
            sorted.forEach((p, idx) => {
                let badge = !p.isAlive ? ` <span style="color:#94A3B8;font-size:0.8rem;">(Out)</span>` : '';
                html += `<div>#${idx + 1} ${p.name}${badge} - ${p.percentage.toFixed(2)}% (${p.kills} kills)</div>`;
            });
            document.getElementById('overlayRankings').innerHTML = html;
            document.getElementById('gameOverlay').classList.remove('hidden');
        }
    }

    addCoins(amount) {
        const coinsElem = document.getElementById('coinsText');
        let currentCoins = 12591;
        if (coinsElem) {
            let parsed = parseInt(coinsElem.textContent.replace(/,/g, ''), 10);
            if (!isNaN(parsed)) currentCoins = parsed;
            currentCoins += amount;
            coinsElem.textContent = currentCoins.toLocaleString();
        }
    }

    saveMatchToJDBC(winner, sorted) {
        let matches = JSON.parse(localStorage.getItem('paper_io_matches') || '[]');
        matches.unshift({
            id: matches.length + 1,
            time: new Date().toLocaleTimeString(),
            winner: winner,
            pct: this.humanPlayer.percentage,
            kills: this.humanPlayer.kills,
            duration: this.elapsedSeconds
        });
        localStorage.setItem('paper_io_matches', JSON.stringify(matches.slice(0, 30)));
    }

    openDBModal() {
        let matches = JSON.parse(localStorage.getItem('paper_io_matches') || '[]');
        if (matches.length === 0) {
            matches = [
                { id: 1, time: "12:45:10 PM", winner: "Player", pct: 14.85, duration: 42 },
                { id: 2, time: "01:12:34 PM", winner: "Dahlia", pct: 9.12, duration: 35 },
                { id: 3, time: "01:30:00 PM", winner: "Player", pct: 22.40, duration: 58 }
            ];
            localStorage.setItem('paper_io_matches', JSON.stringify(matches));
        }

        let body = document.getElementById('dbHistoryBody');
        body.innerHTML = '';
        matches.slice(0, 10).forEach((m, idx) => {
            let medal = idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : `#${idx + 1} `;
            body.innerHTML += `
                <tr>
                    <td style="font-weight: 900; color: #38BDF8;">${medal}</td>
                    <td>${m.time}</td>
                    <td><b>${m.winner}</b></td>
                    <td><span style="color:#00E5FF;font-weight:800;">${m.pct.toFixed(2)}%</span></td>
                    <td>${m.duration}s</td>
                </tr>
            `;
        });
        document.getElementById('dbModal').classList.remove('hidden');
    }

    claimDailyReward() {
        this.addCoins(1000);
        this.addKillToast(`🎁 <b>DAILY REWARD CLAIMED!</b> +1,000 Gold Coins added! 🎉`);
        this.activateSpeedBoost(10);
    }

    activateSpeedBoost(seconds = 6) {
        this.stepDelay = Math.max(35, Math.floor(this.baseStepDelay * 0.5));
        this.addKillToast(`⚡ <b>SPEED SURGE ACTIVATED!</b> 2x Speed for ${seconds}s!`);
        if (this.speedTimer) clearTimeout(this.speedTimer);
        this.speedTimer = setTimeout(() => {
            this.stepDelay = this.baseStepDelay;
            this.addKillToast(`⏱️ Speed boost expired.`);
        }, seconds * 1000);
    }

    render() {
        // Camera smooth follow centered on player cell
        let targetCamX = this.humanPlayer.x * CELL_SIZE + CELL_SIZE / 2;
        let targetCamY = this.humanPlayer.y * CELL_SIZE + CELL_SIZE / 2;
        this.cameraX += (targetCamX - this.cameraX) * 0.1;
        this.cameraY += (targetCamY - this.cameraY) * 0.1;

        let ctx = this.ctx;
        let w = this.canvas.width;
        let h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        ctx.save();
        // Camera Centering & Zoom Scale Transformation
        ctx.translate(w / 2, h / 2);
        ctx.scale(this.zoomScale, this.zoomScale);
        ctx.translate(-this.cameraX, -this.cameraY);

        // 1. Draw World Arena Grid Background
        ctx.fillStyle = '#0F172A'; // Dark Gaming Arena Background
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

        // World Arena Outer Border Glow
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

        // 4. Render Player Square Heads & Nametags
        this.players.forEach(p => {
            if (p.isAlive) {
                let px = p.x * CELL_SIZE;
                let py = p.y * CELL_SIZE;

                // Player Square Box
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 12;
                ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
                ctx.shadowBlur = 0;

                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.strokeRect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4);

                // Inner Eye Indicator Dot
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(px + CELL_SIZE / 3, py + CELL_SIZE / 3, CELL_SIZE / 3, CELL_SIZE / 3);

                // Nametag
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 12px Outfit, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(p.name, px + CELL_SIZE / 2, py - 6);
            }
        });

        ctx.restore();
    }
}

// Initialize Game Engine on DOM Load
window.addEventListener('DOMContentLoaded', () => {
    window.gameInstance = new PaperIOGame();
});
