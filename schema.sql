-- ============================================================
-- Paper Territory IO - Database Schema & Workbench Queries
-- Location in Java Code: src/com/paperio/db/DatabaseManager.java
-- Database File: paper_territory.db (SQLite)
-- ============================================================

-- 1. Create Game Matches Table
CREATE TABLE IF NOT EXISTS game_matches (
    match_id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_seconds INTEGER,
    winner_name TEXT,
    player_territory_pct REAL,
    total_players INTEGER
);

-- 2. Create Player Scores Table
CREATE TABLE IF NOT EXISTS player_scores (
    score_id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER,
    player_name TEXT,
    is_ai INTEGER,
    territory_pct REAL,
    claimed_cells INTEGER,
    rank_position INTEGER,
    eliminations INTEGER,
    FOREIGN KEY(match_id) REFERENCES game_matches(match_id) ON DELETE CASCADE
);

-- ============================================================
-- Useful SQL Queries for Workbench / DB Browser
-- ============================================================

-- View Leaderboard (Ordered by Highest Territory %)
SELECT player_name, is_ai, territory_pct, claimed_cells, rank_position, eliminations 
FROM player_scores 
ORDER BY territory_pct DESC, claimed_cells DESC 
LIMIT 10;

-- View Recent Match History
SELECT match_id, match_timestamp, duration_seconds, winner_name, player_territory_pct, total_players 
FROM game_matches 
ORDER BY match_id DESC 
LIMIT 10;

-- View Detailed Player Performance per Match
SELECT m.match_id, m.match_timestamp, ps.player_name, ps.territory_pct, ps.claimed_cells, ps.eliminations, ps.rank_position
FROM game_matches m
JOIN player_scores ps ON m.match_id = ps.match_id
ORDER BY m.match_id DESC, ps.rank_position ASC;

-- Clear All Game Data (Reset Leaderboard & History)
-- DELETE FROM player_scores;
-- DELETE FROM game_matches;
