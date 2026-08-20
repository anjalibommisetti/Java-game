// Paper.io 2 Official Web Engine

const GRID = 100;
const MAP_SIZE = 2400; // World pixel size
const CELL_SIZE = MAP_SIZE / GRID;

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
        this.zoomScale = 0.35; // Default wide arena overview (35% scale)
        this.isPaused = false;
        this.isGameOver = false;
        this.gameStarted = false; // Waiting for user to click PLAY GAME NOW
        this.matchInitialized = false;

        this.elapsedSeconds = 0;
        this.lastStepTime = 0;
        this.stepDelay = 80; // Smooth tick rate

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.setupPlayers();
        this.bindControls();
        this.startNewMatch();
        this.gameStarted = false; // Freeze match until user clicks PLAY GAME NOW

        requestAnimationFrame((t) => this.loop(t));
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

        document.getElementById('gameOverlay').classList.add('hidden');

        // Spawn Locations evenly distributed
        const spawns = [
            { x: 25, y: 25 },
            { x: 75, y: 75 },
            { x: 75, y: 25 },
            { x: 25, y: 75 },
            { x: 50, y: 20 },
            { x: 50, y: 80 },
            { x: 80, y: 50 }
        ];

        this.players.forEach((p, idx) => {
            let s = spawns[idx % spawns.length];
            p.x = s.x;
            p.y = s.y;
            p.vx = 0; // Wait for key press before moving
            p.vy = 0;
            p.trail = [];
            p.isOutside = false;
            p.isAlive = true;
            p.kills = 0;
            p.aiExcursion = 0;
            p.aiMaxExcursion = 8 + Math.floor(Math.random() * 8);

            // Initial 7x7 Base
            for (let dx = -3; dx <= 3; dx++) {
                for (let dy = -3; dy <= 3; dy++) {
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
    }

    isValid(x, y) {
        return x >= 0 && x < GRID && y >= 0 && y < GRID;
    }

    bindControls() {
        // Keyboard Controls for User Player
        window.addEventListener('keydown', (e) => {
            if (!this.humanPlayer || !this.humanPlayer.isAlive) return;
            const key = e.key.toLowerCase();
            if (key === 'arrowup' || key === 'w') {
                if (this.humanPlayer.vy !== 1) { this.humanPlayer.vx = 0; this.humanPlayer.vy = -1; }
            } else if (key === 'arrowdown' || key === 's') {
                if (this.humanPlayer.vy !== -1) { this.humanPlayer.vx = 0; this.humanPlayer.vy = 1; }
            } else if (key === 'arrowleft' || key === 'a') {
                if (this.humanPlayer.vx !== 1) { this.humanPlayer.vx = -1; this.humanPlayer.vy = 0; }
            } else if (key === 'arrowright' || key === 'd') {
                if (this.humanPlayer.vx !== -1) { this.humanPlayer.vx = 1; this.humanPlayer.vy = 0; }
            }
        });

        // On-Screen D-Pad Controls for Mouse Click / Touch
        const setUp = () => { if (this.humanPlayer && this.humanPlayer.vy !== 1) { this.humanPlayer.vx = 0; this.humanPlayer.vy = -1; } };
        const setDown = () => { if (this.humanPlayer && this.humanPlayer.vy !== -1) { this.humanPlayer.vx = 0; this.humanPlayer.vy = 1; } };
        const setLeft = () => { if (this.humanPlayer && this.humanPlayer.vx !== 1) { this.humanPlayer.vx = -1; this.humanPlayer.vy = 0; } };
        const setRight = () => { if (this.humanPlayer && this.humanPlayer.vx !== -1) { this.humanPlayer.vx = 1; this.humanPlayer.vy = 0; } };

        document.getElementById('btn-up')?.addEventListener('click', setUp);
        document.getElementById('btn-down')?.addEventListener('click', setDown);
        document.getElementById('btn-left')?.addEventListener('click', setLeft);
        document.getElementById('btn-right')?.addEventListener('click', setRight);

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
            e.preventDefault();
            if (e.deltaY > 0) {
                this.setZoom(this.zoomScale - 0.05);
            } else {
                this.setZoom(this.zoomScale + 0.05);
            }
        }, { passive: false });

        // Profile Editor Listeners
        const nameInput = document.getElementById('playerNameInput');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
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

        // Start Game Overlay Button
        const startBtn = document.getElementById('btn-start-play');
        if (startBtn) {
            startBtn.onclick = () => {
                const nameInput = document.getElementById('playerNameInput');
                const activeColorBtn = document.querySelector('.color-btn.active');
                let val = nameInput ? nameInput.value.trim() : '';
                if (!val) val = 'Player';
                const col = activeColorBtn ? activeColorBtn.getAttribute('data-color') : null;

                this.saveProfile(val, col, true);
                document.getElementById('startOverlay').classList.add('hidden');
                this.startNewMatch();
            };
        }

        document.getElementById('btn-restart').onclick = () => this.startNewMatch();
        document.getElementById('btn-demo-capture').onclick = () => this.demoCapture();
        document.getElementById('btn-demo-elim').onclick = () => this.demoElimination();
        document.getElementById('btn-db-modal').onclick = () => this.openDBModal();
        document.getElementById('btn-close-modal').onclick = () => document.getElementById('dbModal').classList.add('hidden');
        window.addEventListener('click', (e) => {
            const dbModal = document.getElementById('dbModal');
            if (e.target === dbModal) {
                dbModal.classList.add('hidden');
            }
        });
    }

    loop(now) {
        requestAnimationFrame((t) => this.loop(t));

        if (!this.gameStarted || this.isPaused || this.isGameOver) {
            this.render();
            return;
        }

        if (now - this.lastStepTime > this.stepDelay) {
            this.lastStepTime = now;
            this.updateStep();
        }

        this.render();
    }

    updateStep() {
        this.players.forEach(p => {
            if (!p.isAlive) return;

            if (p.isAI) {
                this.updateAIMovement(p);
            }

            if (p.vx === 0 && p.vy === 0) return;

            let nx = p.x + p.vx;
            let ny = p.y + p.vy;

            // Collision check
            if (!this.checkCollisions(p, nx, ny)) return;

            p.x = nx;
            p.y = ny;

            // Check territory state
            if (this.grid[nx][ny] !== p.id) {
                p.isOutside = true;
                p.trail.push({ x: nx, y: ny });
                this.trailGrid[nx][ny] = p.id;
                p.aiExcursion++;
            } else {
                if (p.isOutside) {
                    // Safe Return -> ENCLOSURE CAPTURE!
                    this.performCapture(p);
                    p.aiExcursion = 0;
                    p.aiMaxExcursion = 8 + Math.floor(Math.random() * 8);
                }
            }
        });

        this.updateStats();
        this.renderUI();
        this.checkGameOver();
    }

    performCapture(player) {
        let pId = player.id;

        // Convert trail to owned territory
        player.trail.forEach(pt => {
            this.grid[pt.x][pt.y] = pId;
            this.trailGrid[pt.x][pt.y] = 0;
        });

        // BFS Flood fill from perimeter
        let visited = Array(GRID).fill(false).map(() => Array(GRID).fill(false));
        let queue = [];

        for (let x = 0; x < GRID; x++) {
            this.pushSeed(x, 0, pId, visited, queue);
            this.pushSeed(x, GRID - 1, pId, visited, queue);
        }
        for (let y = 0; y < GRID; y++) {
            this.pushSeed(0, y, pId, visited, queue);
            this.pushSeed(GRID - 1, y, pId, visited, queue);
        }

        const dx = [0, 0, 1, -1];
        const dy = [1, -1, 0, 0];

        while (queue.length > 0) {
            let curr = queue.shift();
            for (let i = 0; i < 4; i++) {
                let nx = curr.x + dx[i];
                let ny = curr.y + dy[i];
                if (this.isValid(nx, ny) && !visited[nx][ny] && this.grid[nx][ny] !== pId) {
                    visited[nx][ny] = true;
                    queue.push({ x: nx, y: ny });
                }
            }
        }

        // Claim all enclosed unvisited cells
        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                if (!visited[x][y] && this.grid[x][y] !== pId) {
                    this.grid[x][y] = pId;
                }
            }
        }

        player.trail = [];
        player.isOutside = false;
    }

    pushSeed(x, y, pId, visited, queue) {
        if (!visited[x][y] && this.grid[x][y] !== pId) {
            visited[x][y] = true;
            queue.push({ x, y });
        }
    }

    checkCollisions(movingPlayer, nx, ny) {
        if (!this.isValid(nx, ny)) {
            this.eliminatePlayer(movingPlayer, null, "crashed into map border");
            return false;
        }

        let trailOwnerId = this.trailGrid[nx][ny];
        if (trailOwnerId > 0) {
            let victim = this.players.find(p => p.id === trailOwnerId);
            if (victim && victim.isAlive) {
                if (victim.id === movingPlayer.id) {
                    this.eliminatePlayer(movingPlayer, null, "self-collision");
                    return false;
                } else {
                    movingPlayer.kills++;
                    this.eliminatePlayer(victim, movingPlayer, "trail cut");
                }
            }
        }

        return true;
    }

    eliminatePlayer(victim, killer, reason) {
        if (!victim.isAlive) return;
        victim.isAlive = false;

        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                if (this.grid[x][y] === victim.id) this.grid[x][y] = 0;
                if (this.trailGrid[x][y] === victim.id) this.trailGrid[x][y] = 0;
            }
        }
        victim.trail = [];
        victim.claimedCount = 0;
        victim.percentage = 0.0;
    }

    updateAIMovement(ai) {
        let validDirs = [
            { x: 0, y: -1 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
            { x: 1, y: 0 }
        ].filter(d => {
            if (d.x === -ai.vx && d.y === -ai.vy && (ai.vx !== 0 || ai.vy !== 0)) return false;
            let tx = ai.x + d.x;
            let ty = ai.y + d.y;
            return this.isValid(tx, ty) && this.trailGrid[tx][ty] !== ai.id;
        });

        if (validDirs.length === 0) return;

        // Head towards home base if outside for long
        if (ai.isOutside && ai.aiExcursion >= ai.aiMaxExcursion) {
            let best = validDirs[0];
            let minDist = 9999;
            validDirs.forEach(d => {
                let tx = ai.x + d.x, ty = ai.y + d.y;
                let dist = this.distToHome(tx, ty, ai.id);
                if (dist < minDist) {
                    minDist = dist;
                    best = d;
                }
            });
            ai.vx = best.x;
            ai.vy = best.y;
            return;
        }

        // Keep current direction if valid
        let curValid = validDirs.find(d => d.x === ai.vx && d.y === ai.vy);
        if (curValid && Math.random() > 0.25) return;

        let picked = validDirs[Math.floor(Math.random() * validDirs.length)];
        ai.vx = picked.x;
        ai.vy = picked.y;
    }

    distToHome(x, y, pId) {
        if (this.grid[x][y] === pId) return 0;
        let minDist = 9999;
        for (let dx = -8; dx <= 8; dx++) {
            for (let dy = -8; dy <= 8; dy++) {
                let tx = x + dx, ty = y + dy;
                if (this.isValid(tx, ty) && this.grid[tx][ty] === pId) {
                    let d = dx * dx + dy * dy;
                    if (d < minDist) minDist = d;
                }
            }
        }
        return minDist;
    }

    updateStats() {
        let total = GRID * GRID;
        let counts = {};
        this.players.forEach(p => counts[p.id] = 0);

        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                let owner = this.grid[x][y];
                if (owner > 0 && counts[owner] !== undefined) counts[owner]++;
            }
        }

        this.players.forEach(p => {
            p.claimedCount = counts[p.id];
            p.percentage = parseFloat(((p.claimedCount / total) * 100).toFixed(2));
        });
    }

    renderUI() {
        // Top Left Score & Kills
        let pct = this.humanPlayer.percentage.toFixed(2);
        document.getElementById('playerPctText').textContent = `${pct} %`;
        document.getElementById('playerPctFill').style.width = `${Math.min(100, pct * 3)}%`;
        document.getElementById('playerKillsText').textContent = `x${this.humanPlayer.kills}`;

        // Top Right Leaderboard (Matching Image 2)
        let sorted = [...this.players].sort((a, b) => b.percentage - a.percentage);
        const lbContainer = document.getElementById('leaderboardList');
        lbContainer.innerHTML = '';

        sorted.slice(0, 5).forEach((p, rank) => {
            const card = document.createElement('div');
            card.className = `lb-card ${p === this.humanPlayer ? 'player-card' : ''}`;
            card.innerHTML = `
                <span class="lb-rank">${rank + 1}</span>
                <span class="lb-pct">${p.percentage.toFixed(2)}%</span>
                <span class="lb-name" style="color: ${p.color}">${p.name}</span>
            `;
            lbContainer.appendChild(card);
        });

        // Minimap Render (Matching Image 2)
        this.renderMinimap();
    }

    renderMinimap() {
        const mCtx = this.minimapCtx;
        const w = 120, h = 120;
        mCtx.fillStyle = '#EBF0F5';
        mCtx.fillRect(0, 0, w, h);

        const scale = w / GRID;
        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                let owner = this.grid[x][y];
                if (owner > 0) {
                    let p = this.players.find(pl => pl.id === owner);
                    if (p) {
                        mCtx.fillStyle = p.territoryColor;
                        mCtx.fillRect(x * scale, y * scale, scale + 0.5, scale + 0.5);
                    }
                }
            }
        }

        // Draw Player positions on Minimap
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
        if (!this.humanPlayer.isAlive) {
            this.isGameOver = true;
            let sorted = [...this.players].sort((a, b) => b.percentage - a.percentage);
            let winner = sorted[0].name;

            this.saveMatchToJDBC(winner, sorted);

            document.getElementById('overlayTitle').textContent = "YOU DIED";
            document.getElementById('overlaySubtitle').textContent = `Conquered ${this.humanPlayer.percentage.toFixed(2)}% of the arena`;

            let html = ``;
            sorted.forEach((p, idx) => {
                html += `<div>#${idx + 1} ${p.name} - ${p.percentage.toFixed(2)}% (${p.kills} kills)</div>`;
            });
            document.getElementById('overlayRankings').innerHTML = html;
            document.getElementById('gameOverlay').classList.remove('hidden');
        }
    }

    saveMatchToJDBC(winner, sorted) {
        let matches = JSON.parse(localStorage.getItem('paper_io_matches') || '[]');
        matches.unshift({
            id: matches.length + 1,
            time: new Date().toLocaleTimeString(),
            winner: winner,
            pct: this.humanPlayer.percentage,
            duration: this.elapsedSeconds
        });
        localStorage.setItem('paper_io_matches', JSON.stringify(matches.slice(0, 30)));
    }

    openDBModal() {
        let matches = JSON.parse(localStorage.getItem('paper_io_matches') || '[]');
        let body = document.getElementById('dbHistoryBody');
        body.innerHTML = '';
        matches.forEach(m => {
            body.innerHTML += `
                <tr>
                    <td>#${m.id}</td>
                    <td>${m.time}</td>
                    <td>${m.winner}</td>
                    <td>${m.pct.toFixed(2)}%</td>
                    <td>${m.duration}s</td>
                </tr>
            `;
        });
        document.getElementById('dbModal').classList.remove('hidden');
    }

    demoCapture() {
        if (!this.humanPlayer || !this.humanPlayer.isAlive) return;
        let hx = this.humanPlayer.x, hy = this.humanPlayer.y;
        for (let dx = 1; dx <= 6; dx++) {
            if (this.isValid(hx + dx, hy)) {
                this.humanPlayer.trail.push({ x: hx + dx, y: hy });
                this.trailGrid[hx + dx][hy] = this.humanPlayer.id;
            }
        }
        this.performCapture(this.humanPlayer);
        this.updateStats();
        this.renderUI();
    }

    demoElimination() {
        let ai = this.players.find(p => p.isAI && p.isAlive);
        if (ai) {
            this.eliminatePlayer(ai, this.humanPlayer, "demo elimination");
            this.updateStats();
            this.renderUI();
        }
    }

    render() {
        // Camera smooth follow centered on player cell
        let targetCamX = this.humanPlayer.x * CELL_SIZE + CELL_SIZE / 2;
        let targetCamY = this.humanPlayer.y * CELL_SIZE + CELL_SIZE / 2;
        this.cameraX += (targetCamX - this.cameraX) * 0.1;
        this.cameraY += (targetCamY - this.cameraY) * 0.1;

        this.ctx.fillStyle = '#EFF3F6';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        // Translate to center and apply zoom scale for full arena field-of-view
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(this.zoomScale, this.zoomScale);
        this.ctx.translate(-this.cameraX, -this.cameraY);

        // 1. Render Map Boundary Border
        this.ctx.strokeStyle = '#CBD5E1';
        this.ctx.lineWidth = 8;
        this.ctx.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);

        // 2. Render Territory Polygons (Matching Image 2 Aesthetic)
        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                let owner = this.grid[x][y];
                if (owner > 0) {
                    let p = this.players.find(pl => pl.id === owner);
                    if (p) {
                        this.ctx.fillStyle = p.territoryColor;
                        this.ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE + 0.5, CELL_SIZE + 0.5);
                    }
                }
            }
        }

        // 3. Render Active Trails
        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                let owner = this.trailGrid[x][y];
                if (owner > 0) {
                    let p = this.players.find(pl => pl.id === owner);
                    if (p) {
                        this.ctx.fillStyle = p.trailColor;
                        this.ctx.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
                    }
                }
            }
        }

        // 4. Render Player Avatars & Floating Names (Matching Image 2)
        this.players.forEach(p => {
            if (p.isAlive) {
                let px = p.x * CELL_SIZE + CELL_SIZE / 2;
                let py = p.y * CELL_SIZE + CELL_SIZE / 2;

                // Glowing outer ring
                this.ctx.fillStyle = p.color;
                this.ctx.beginPath();
                this.ctx.arc(px, py, CELL_SIZE * 0.7, 0, Math.PI * 2);
                this.ctx.fill();

                // Player Center Cube
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.fillRect(px - CELL_SIZE * 0.4, py - CELL_SIZE * 0.4, CELL_SIZE * 0.8, CELL_SIZE * 0.8);

                // Floating Name Label (Matching Image 2)
                this.ctx.font = 'bold 15px Outfit, sans-serif';
                this.ctx.fillStyle = '#1E293B';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(p.name, px, py - CELL_SIZE * 1.1);
            }
        });

        this.ctx.restore();
    }
}

window.onload = () => {
    new PaperIOGame();
};
