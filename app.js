// Paper Territory IO - HTML5 Canvas Web Application

const GRID_SIZE = 80;
const CANVAS_SIZE = 720;
const CELL_SIZE = CANVAS_SIZE / GRID_SIZE;

// Direction Offsets
const DIRS = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
    NONE: { x: 0, y: 0 }
};

// Player Class
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
        this.curDir = DIRS.NONE;
        this.nextDir = DIRS.NONE;

        this.trail = [];
        this.isOutside = false;
        this.isAlive = true;

        this.claimedCount = 0;
        this.percentage = 0.0;
        this.kills = 0;
    }
}

// Sound System (Web Audio API)
class SoundSystem {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playCapture() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    playElimination() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.25);
    }
}

// Main Game Engine
class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.sound = new SoundSystem();

        this.grid = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
        this.trailGrid = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));

        this.players = [];
        this.humanPlayer = null;
        this.floatingTexts = [];

        this.isPaused = false;
        this.isGameOver = false;
        this.elapsedSeconds = 0;
        this.lastStepTime = 0;
        this.stepDelay = 110;

        this.setupPlayers();
        this.bindEvents();
        this.startNewMatch();
        this.gameLoop();
    }

    setupPlayers() {
        this.humanPlayer = new Player(1, "You (Human)", false, "#00E5FF", "rgba(0, 229, 255, 0.45)", "#00E5FF");
        this.players = [
            this.humanPlayer,
            new Player(2, "AI Red Comet", true, "#FF1744", "rgba(255, 23, 68, 0.45)", "#FF1744"),
            new Player(3, "AI Golden Viper", true, "#FFEA00", "rgba(255, 234, 0, 0.45)", "#FFEA00"),
            new Player(4, "AI Emerald Ghost", true, "#00E676", "rgba(0, 230, 118, 0.45)", "#00E676")
        ];
    }

    startNewMatch() {
        // Reset Grid
        for (let x = 0; x < GRID_SIZE; x++) {
            for (let y = 0; y < GRID_SIZE; y++) {
                this.grid[x][y] = 0;
                this.trailGrid[x][y] = 0;
            }
        }

        this.floatingTexts = [];
        this.elapsedSeconds = 0;
        this.isPaused = false;
        this.isGameOver = false;

        document.getElementById('gameOverlay').classList.add('hidden');
        this.updateStatusBadge("LIVE MATCH", "status-active");
        this.clearEventTicker();
        this.addEventLog("Match initialized with 3 AI Rivals.", "system");

        // Spawn Players
        const spawns = [
            { x: 20, y: 20 },
            { x: 60, y: 60 },
            { x: 60, y: 20 },
            { x: 20, y: 60 }
        ];

        this.players.forEach((p, idx) => {
            p.x = spawns[idx].x;
            p.y = spawns[idx].y;
            p.curDir = DIRS.NONE;
            p.nextDir = DIRS.NONE;
            p.trail = [];
            p.isOutside = false;
            p.isAlive = true;
            p.kills = 0;

            // 7x7 Initial Spawn Base
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
        this.renderScoreboard();
    }

    isValid(x, y) {
        return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => {
            this.sound.init();
            if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') this.setHumanDir(DIRS.UP);
            else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') this.setHumanDir(DIRS.DOWN);
            else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') this.setHumanDir(DIRS.LEFT);
            else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') this.setHumanDir(DIRS.RIGHT);
            else if (e.key.toLowerCase() === 'p') this.togglePause();
            else if (e.key === 'F2') this.startNewMatch();
        });

        // HUD Buttons
        document.getElementById('btn-pause').onclick = () => this.togglePause();
        document.getElementById('btn-restart').onclick = () => this.startNewMatch();
        document.getElementById('btn-overlay-play').onclick = () => this.startNewMatch();
        document.getElementById('btn-leaderboard').onclick = () => this.openLeaderboard();
        document.getElementById('btn-overlay-lb').onclick = () => this.openLeaderboard();
        document.getElementById('btn-help').onclick = () => this.openModal('rulesModal');

        // Modal Closers
        document.getElementById('btn-close-lb').onclick = () => this.closeModal('leaderboardModal');
        document.getElementById('btn-close-modal').onclick = () => this.closeModal('leaderboardModal');
        document.getElementById('btn-close-rules').onclick = () => this.closeModal('rulesModal');
        document.getElementById('btn-close-rules-modal').onclick = () => this.closeModal('rulesModal');

        // Tabs
        document.getElementById('tab-btn-top').onclick = () => this.switchTab('top');
        document.getElementById('tab-btn-history').onclick = () => this.switchTab('history');
        document.getElementById('btn-clear-db').onclick = () => {
            localStorage.removeItem('paper_io_matches');
            localStorage.removeItem('paper_io_scores');
            this.loadLeaderboardData();
            this.addEventLog("Database match history cleared.", "system");
        };

        // Live Demo Buttons
        document.getElementById('btn-demo-capture').onclick = () => this.demoCapture();
        document.getElementById('btn-demo-elim').onclick = () => this.demoElimination();

        // Timer Tick
        setInterval(() => {
            if (!this.isPaused && !this.isGameOver) {
                this.elapsedSeconds++;
                let m = String(Math.floor(this.elapsedSeconds / 60)).padStart(2, '0');
                let s = String(this.elapsedSeconds % 60).padStart(2, '0');
                document.getElementById('matchTimer').textContent = `${m}:${s}`;
            }
        }, 1000);
    }

    setHumanDir(dir) {
        if (!this.humanPlayer.isAlive) return;
        let cur = this.humanPlayer.curDir;
        if (dir.x !== -cur.x || dir.y !== -cur.y) {
            this.humanPlayer.nextDir = dir;
        }
    }

    togglePause() {
        if (this.isGameOver) return;
        this.isPaused = !this.isPaused;
        const btn = document.getElementById('btn-pause');
        if (this.isPaused) {
            btn.textContent = "▶ Resume";
            this.updateStatusBadge("PAUSED", "status-paused");
        } else {
            btn.textContent = "⏸ Pause";
            this.updateStatusBadge("LIVE MATCH", "status-active");
        }
    }

    gameLoop(now) {
        requestAnimationFrame((t) => this.gameLoop(t));

        if (this.isPaused || this.isGameOver) {
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
        // Update Players (Human + AI)
        this.players.forEach(p => {
            if (!p.isAlive) return;

            if (p.isAI) {
                p.curDir = this.decideAIDirection(p);
            } else {
                if (p.nextDir !== DIRS.NONE) p.curDir = p.nextDir;
            }

            if (p.curDir === DIRS.NONE) return;

            let nx = p.x + p.curDir.x;
            let ny = p.y + p.curDir.y;

            // Collision check
            if (!this.checkCollisions(p, nx, ny)) return;

            p.x = nx;
            p.y = ny;

            // Check territory state
            if (this.grid[nx][ny] !== p.id) {
                p.isOutside = true;
                p.trail.push({ x: nx, y: ny });
                this.trailGrid[nx][ny] = p.id;
            } else {
                if (p.isOutside) {
                    // Safe return -> Trigger Enclosure Capture Fill!
                    let captured = this.performCapture(p);
                    this.sound.playCapture();
                    let pct = ((captured / (GRID_SIZE * GRID_SIZE)) * 100).toFixed(1);
                    this.addFloatingText(`+${pct}%`, p.x, p.y, p.color);
                    this.addEventLog(`${p.name} captured ${captured} cells (+${pct}%)!`, "capture");
                }
            }
        });

        this.updateStats();
        this.renderScoreboard();
        this.checkMatchOver();
    }

    performCapture(player) {
        let pId = player.id;
        let initialCount = this.countCells(pId);

        // Convert Trail to owned territory
        player.trail.forEach(pt => {
            this.grid[pt.x][pt.y] = pId;
            this.trailGrid[pt.x][pt.y] = 0;
        });

        // Enclosure BFS Flood Fill from outer border
        let visited = Array(GRID_SIZE).fill(false).map(() => Array(GRID_SIZE).fill(false));
        let queue = [];

        for (let x = 0; x < GRID_SIZE; x++) {
            this.pushSeed(x, 0, pId, visited, queue);
            this.pushSeed(x, GRID_SIZE - 1, pId, visited, queue);
        }
        for (let y = 0; y < GRID_SIZE; y++) {
            this.pushSeed(0, y, pId, visited, queue);
            this.pushSeed(GRID_SIZE - 1, y, pId, visited, queue);
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

        // Claim all enclosed cells
        for (let x = 0; x < GRID_SIZE; x++) {
            for (let y = 0; y < GRID_SIZE; y++) {
                if (!visited[x][y] && this.grid[x][y] !== pId) {
                    this.grid[x][y] = pId;
                }
            }
        }

        player.trail = [];
        player.isOutside = false;

        let finalCount = this.countCells(pId);
        return finalCount - initialCount;
    }

    pushSeed(x, y, pId, visited, queue) {
        if (!visited[x][y] && this.grid[x][y] !== pId) {
            visited[x][y] = true;
            queue.push({ x, y });
        }
    }

    countCells(pId) {
        let cnt = 0;
        for (let x = 0; x < GRID_SIZE; x++) {
            for (let y = 0; y < GRID_SIZE; y++) {
                if (this.grid[x][y] === pId) cnt++;
            }
        }
        return cnt;
    }

    checkCollisions(movingPlayer, nx, ny) {
        // Boundary collision
        if (!this.isValid(nx, ny)) {
            this.eliminatePlayer(movingPlayer, null, `${movingPlayer.name} hit the map border!`);
            return false;
        }

        // Trail collision
        let trailOwnerId = this.trailGrid[nx][ny];
        if (trailOwnerId > 0) {
            let victim = this.players.find(p => p.id === trailOwnerId);
            if (victim && victim.isAlive) {
                if (victim.id === movingPlayer.id) {
                    this.eliminatePlayer(movingPlayer, null, `${movingPlayer.name} ran into their own trail!`);
                    return false;
                } else {
                    movingPlayer.kills++;
                    this.eliminatePlayer(victim, movingPlayer, `${victim.name}'s trail was cut by ${movingPlayer.name}!`);
                }
            }
        }

        return true;
    }

    eliminatePlayer(victim, killer, reason) {
        if (!victim.isAlive) return;
        victim.isAlive = false;
        this.sound.playElimination();

        // Clear territory and trail
        for (let x = 0; x < GRID_SIZE; x++) {
            for (let y = 0; y < GRID_SIZE; y++) {
                if (this.grid[x][y] === victim.id) this.grid[x][y] = 0;
                if (this.trailGrid[x][y] === victim.id) this.trailGrid[x][y] = 0;
            }
        }
        victim.trail = [];
        victim.claimedCount = 0;
        victim.percentage = 0.0;

        this.addEventLog(`ELIMINATION: ${reason}`, "elimination");
        this.addFloatingText("ELIMINATED!", victim.x, victim.y, "#FF1744");

        if (victim === this.humanPlayer) {
            this.updateStatusBadge("YOU DIED", "status-dead");
        }
    }

    decideAIDirection(ai) {
        let cur = ai.curDir;
        let validDirs = [];

        Object.values(DIRS).forEach(d => {
            if (d === DIRS.NONE || (d.x === -cur.x && d.y === -cur.y && cur !== DIRS.NONE)) return;
            let tx = ai.x + d.x;
            let ty = ai.y + d.y;
            if (this.isValid(tx, ty) && this.trailGrid[tx][ty] !== ai.id) {
                validDirs.push(d);
            }
        });

        if (validDirs.length === 0) return DIRS.NONE;

        // Return Home if trail gets long
        if (ai.isOutside && ai.trail.length >= 8) {
            let bestDir = DIRS.NONE;
            let minDist = 9999;
            validDirs.forEach(d => {
                let tx = ai.x + d.x;
                let ty = ai.y + d.y;
                let dist = this.distToHome(tx, ty, ai.id);
                if (dist < minDist) {
                    minDist = dist;
                    bestDir = d;
                }
            });
            if (bestDir !== DIRS.NONE) return bestDir;
        }

        // Continue straight if valid
        if (validDirs.includes(cur) && Math.random() > 0.3) return cur;

        return validDirs[Math.floor(Math.random() * validDirs.length)];
    }

    distToHome(x, y, pId) {
        if (this.grid[x][y] === pId) return 0;
        let minD = 9999;
        for (let r = 1; r <= 10; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    let tx = x + dx, ty = y + dy;
                    if (this.isValid(tx, ty) && this.grid[tx][ty] === pId) {
                        let d = dx * dx + dy * dy;
                        if (d < minD) minD = d;
                    }
                }
            }
            if (minD < 9999) break;
        }
        return minD;
    }

    updateStats() {
        let total = GRID_SIZE * GRID_SIZE;
        let counts = {};
        this.players.forEach(p => counts[p.id] = 0);

        for (let x = 0; x < GRID_SIZE; x++) {
            for (let y = 0; y < GRID_SIZE; y++) {
                let owner = this.grid[x][y];
                if (owner > 0 && counts[owner] !== undefined) counts[owner]++;
            }
        }

        this.players.forEach(p => {
            p.claimedCount = counts[p.id];
            p.percentage = parseFloat(((p.claimedCount / total) * 100).toFixed(1));
        });
    }

    renderScoreboard() {
        const container = document.getElementById('scoreboardList');
        container.innerHTML = '';

        let sorted = [...this.players].sort((a, b) => b.percentage - a.percentage);
        let alive = this.players.filter(p => p.isAlive).length;
        document.getElementById('aliveCount').textContent = `${alive} Alive`;

        sorted.forEach((p, rank) => {
            const card = document.createElement('div');
            card.className = 'score-card';
            card.innerHTML = `
                <div class="score-info">
                    <span style="color: ${p.isAlive ? p.color : '#64748B'}">#${rank + 1} ${p.name} ${p.isAlive ? '' : '(DEAD)'}</span>
                    <span>${p.percentage.toFixed(1)}%</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width: ${Math.min(100, p.percentage * 2.5)}%; background: ${p.color}"></div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    checkMatchOver() {
        if (this.isGameOver) return;
        let alive = this.players.filter(p => p.isAlive);

        if (!this.humanPlayer.isAlive || alive.length <= 1) {
            this.isGameOver = true;
            let sorted = [...this.players].sort((a, b) => b.percentage - a.percentage);
            let winner = sorted[0].name;

            this.saveMatchData(winner, sorted);

            document.getElementById('overlayTitle').textContent = this.humanPlayer.isAlive ? "VICTORY!" : "GAME OVER";
            document.getElementById('overlaySubtitle').textContent = `Winner: ${winner} | Matches saved to JDBC Database`;

            let html = `<strong>Final Rankings:</strong><br>`;
            sorted.forEach((p, idx) => {
                html += `${idx + 1}. ${p.name} - ${p.percentage.toFixed(1)}% (${p.claimedCount} cells, ${p.kills} kills)<br>`;
            });
            document.getElementById('overlayRankings').innerHTML = html;
            document.getElementById('gameOverlay').classList.remove('hidden');
        }
    }

    saveMatchData(winner, sorted) {
        let matches = JSON.parse(localStorage.getItem('paper_io_matches') || '[]');
        let scores = JSON.parse(localStorage.getItem('paper_io_scores') || '[]');

        let matchId = matches.length + 1;
        matches.unshift({
            match_id: matchId,
            match_timestamp: new Date().toLocaleTimeString(),
            duration_seconds: this.elapsedSeconds,
            winner_name: winner,
            player_territory_pct: this.humanPlayer.percentage,
            total_players: this.players.length
        });

        sorted.forEach((p, rank) => {
            scores.unshift({
                match_id: matchId,
                player_name: p.name,
                is_ai: p.isAI,
                territory_pct: p.percentage,
                claimed_cells: p.claimedCount,
                rank_position: rank + 1,
                eliminations: p.kills
            });
        });

        localStorage.setItem('paper_io_matches', JSON.stringify(matches.slice(0, 50)));
        localStorage.setItem('paper_io_scores', JSON.stringify(scores.slice(0, 100)));
    }

    addEventLog(msg, type = "normal") {
        const ticker = document.getElementById('eventTicker');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `> ${msg}`;
        ticker.appendChild(entry);
        ticker.scrollTop = ticker.scrollHeight;
    }

    clearEventTicker() {
        document.getElementById('eventTicker').innerHTML = '';
    }

    addFloatingText(text, x, y, color) {
        this.floatingTexts.push({ text, x: x * CELL_SIZE, y: y * CELL_SIZE, color, alpha: 1.0, offsetY: 0 });
    }

    demoCapture() {
        if (!this.humanPlayer.isAlive) return;
        let hx = this.humanPlayer.x;
        let hy = this.humanPlayer.y;
        for (let dx = 1; dx <= 5; dx++) {
            if (this.isValid(hx + dx, hy)) {
                this.humanPlayer.trail.push({ x: hx + dx, y: hy });
                this.trailGrid[hx + dx][hy] = this.humanPlayer.id;
            }
        }
        let claimed = this.performCapture(this.humanPlayer);
        this.updateStats();
        this.renderScoreboard();
        this.addEventLog(`DEMO CAPTURE: Instant capture executed (+${claimed} cells)!`, "capture");
        this.addFloatingText("DEMO CAPTURE!", hx, hy, this.humanPlayer.color);
    }

    demoElimination() {
        let ai = this.players.find(p => p.isAI && p.isAlive);
        if (ai) {
            this.eliminatePlayer(ai, this.humanPlayer, `${ai.name} was eliminated in Demo presentation!`);
            this.updateStats();
            this.renderScoreboard();
        }
    }

    openLeaderboard() {
        this.loadLeaderboardData();
        this.openModal('leaderboardModal');
    }

    loadLeaderboardData() {
        let scores = JSON.parse(localStorage.getItem('paper_io_scores') || '[]');
        let matches = JSON.parse(localStorage.getItem('paper_io_matches') || '[]');

        let topBody = document.getElementById('topScoresBody');
        topBody.innerHTML = '';
        scores.slice(0, 20).forEach((s, idx) => {
            topBody.innerHTML += `
                <tr>
                    <td>#${idx + 1}</td>
                    <td>${s.player_name}</td>
                    <td>${s.is_ai ? 'AI Rival' : 'Human Player'}</td>
                    <td>${s.territory_pct.toFixed(1)}%</td>
                    <td>${s.claimed_cells}</td>
                    <td>${s.eliminations}</td>
                </tr>
            `;
        });

        let histBody = document.getElementById('historyBody');
        histBody.innerHTML = '';
        matches.slice(0, 20).forEach(m => {
            histBody.innerHTML += `
                <tr>
                    <td>Match #${m.match_id}</td>
                    <td>${m.match_timestamp}</td>
                    <td>${m.duration_seconds}s</td>
                    <td>${m.winner_name}</td>
                    <td>${m.player_territory_pct.toFixed(1)}%</td>
                    <td>${m.total_players}</td>
                </tr>
            `;
        });
    }

    openModal(id) { document.getElementById(id).classList.remove('hidden'); }
    closeModal(id) { document.getElementById(id).classList.add('hidden'); }

    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        document.getElementById(`tab-btn-${tab}`).classList.add('active');
        document.getElementById(`tab-content-${tab}`).classList.add('active');
    }

    updateStatusBadge(text, className) {
        const badge = document.getElementById('matchStatus');
        badge.textContent = text;
        badge.className = `status-badge ${className}`;
    }

    render() {
        this.ctx.fillStyle = '#111625';
        this.ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // 1. Territories
        for (let x = 0; x < GRID_SIZE; x++) {
            for (let y = 0; y < GRID_SIZE; y++) {
                let owner = this.grid[x][y];
                if (owner > 0) {
                    let p = this.players.find(pl => pl.id === owner);
                    if (p) {
                        this.ctx.fillStyle = p.territoryColor;
                        this.ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                    }
                }
            }
        }

        // 2. Grid lines
        this.ctx.strokeStyle = '#1C2333';
        this.ctx.lineWidth = 0.5;
        for (let i = 0; i <= CANVAS_SIZE; i += CELL_SIZE * 5) {
            this.ctx.beginPath();
            this.ctx.moveTo(i, 0); this.ctx.lineTo(i, CANVAS_SIZE);
            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.moveTo(0, i); this.ctx.lineTo(CANVAS_SIZE, i);
            this.ctx.stroke();
        }

        // 3. Trails
        for (let x = 0; x < GRID_SIZE; x++) {
            for (let y = 0; y < GRID_SIZE; y++) {
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

        // 4. Player Heads
        this.players.forEach(p => {
            if (p.isAlive) {
                let px = p.x * CELL_SIZE;
                let py = p.y * CELL_SIZE;

                this.ctx.fillStyle = p.color;
                this.ctx.beginPath();
                this.ctx.arc(px + CELL_SIZE / 2, py + CELL_SIZE / 2, CELL_SIZE / 2 + 2, 0, Math.PI * 2);
                this.ctx.fill();

                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.fillRect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4);
            }
        });

        // 5. Floating Text
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            let ft = this.floatingTexts[i];
            ft.offsetY -= 1;
            ft.alpha -= 0.02;
            if (ft.alpha <= 0) {
                this.floatingTexts.splice(i, 1);
                continue;
            }
            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, ft.alpha);
            this.ctx.font = 'bold 14px Inter, sans-serif';
            this.ctx.fillStyle = ft.color;
            this.ctx.fillText(ft.text, ft.x - 10, ft.y + ft.offsetY);
            this.ctx.restore();
        }
    }
}

window.onload = () => {
    new GameEngine();
};
