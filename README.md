# Paper Territory IO (Paper.io 2 Single-Player Clone)

A full-featured Java single-player **Paper.io 2** implementation with a modern Swing GUI, real-time 2D grid territory capture engine, collision detection, multithreaded AI rivals, and SQLite JDBC database result tracking.

---

## 🌟 Modules & Features

### 1. Territory Grid Manager (`TerritoryGridManager.java`)
- Models map ownership using a 2D grid array (`grid[width][height]`).
- Spawns players with initial starting territories (5x5 / 7x7 square blocks).
- Calculates real-time territory ownership percentage `(claimed / total) * 100%`.
- Thread-safe grid operations backed by `ReentrantLock`.

### 2. Trail Drawing & Capture Engine (`TrailCaptureEngine.java`)
- Tracks player paths when venturing into unclaimed or enemy territory.
- **Enclosure Algorithm**: Upon returning safely to home territory, a perimeter-based Breadth-First Search (BFS) flood fill calculates the exact enclosed loop.
- Automatically converts all enclosed cells and trail cells to newly claimed player territory.

### 3. Collision Detection Engine (`CollisionEngine.java`)
- **Trail Elimination**: Stepping on an active trail eliminates the trail owner from the match.
- **Self-Collision**: Running into your own trail eliminates yourself.
- **Wall Collision**: Hitting map boundaries eliminates the player.
- Triggers event listener alerts and removes eliminated player territory/trails.

### 4. AI Rival Controller - Multithreading (`AIRivalController.java`)
- Each AI rival operates on a **dedicated background Java thread** (`AIThread`).
- State machine for AI behavior: roaming inside home territory, venturing out to capture loops, pathfinding back home, and evading threats.
- Configurable tick speeds and difficulty levels (Easy, Medium, Hard).

### 5. Territory Percentage & Result Tracker - JDBC (`DatabaseManager.java`)
- Embedded **SQLite JDBC** database integration (`paper_territory.db`).
- Persists match duration, winner, total players, player territory percentages, cell counts, and eliminations.
- Interactive **Leaderboard Dialog** with styled tables for top scores and match history log.

### 6. Modern Graphical User Interface (`MainFrame.java`, `GamePanel.java`, `HUDPanel.java`)
- High-DPI anti-aliased dark mode graphics with glowing trails and distinct neon player palettes.
- Floating capture text animations (`+14.5% Claimed!`) and elimination visual effects.
- Top & side HUD with live territory progress bars, countdown timer, and live event ticker feed.
- **Live Presentation Demo Menu** built specifically for live project demonstrations!

---

## 🎮 How to Run

### Method 1: Using `run.bat` (Windows)
Double-click `run.bat` or execute in PowerShell:
```cmd
.\run.bat
```

### Method 2: Manual Compilation & Execution
```cmd
# 1. Compile source files
javac -cp "lib/sqlite-jdbc.jar;src" -d bin src/com/paperio/model/*.java src/com/paperio/engine/*.java src/com/paperio/ai/*.java src/com/paperio/db/*.java src/com/paperio/ui/*.java src/com/paperio/Main.java

# 2. Launch GUI
java -cp "lib/sqlite-jdbc.jar;bin" com.paperio.Main
```

---

## 🕹️ Controls

| Action | Key |
|---|---|
| Move Up | `W` or `Up Arrow` |
| Move Down | `S` or `Down Arrow` |
| Move Left | `A` or `Left Arrow` |
| Move Right | `D` or `Right Arrow` |
| Pause / Resume | `P` |
| Quick Restart Match | `F2` |

---

## 📊 What Students Must Present (Live Demo Guide)

1. **Claiming New Territory**: Move outside your cyan territory, draw a loop, and re-enter your territory to witness the enclosed area capture and floating `+X%` text. Alternatively, select **Live Presentation Demo -> Demo: Perform Instant Territory Capture**.
2. **Collision / Elimination Event**: Cut an AI rival's glowing trail (or step on your own) to trigger an instant elimination alert in the live event log. Alternatively, select **Live Presentation Demo -> Demo: Trigger AI Collision Event**.
3. **Database Result Storage**: At match end (or by opening **Database (JDBC) -> View Stored Scores & History**), view the persisted match statistics saved directly to SQLite via JDBC.
