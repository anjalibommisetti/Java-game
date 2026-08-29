-- ============================================================
-- Paper Territory IO - MySQL Workbench Database Setup
-- Host: localhost | Port: 3306 | User: root | Password: Anjali@18
-- ============================================================

-- Step 1: Create and select Database
CREATE DATABASE IF NOT EXISTS paper_territory;
USE paper_territory;

-- Step 2: Create Game Matches Table
CREATE TABLE IF NOT EXISTS game_matches (
    match_id INT AUTO_INCREMENT PRIMARY KEY,
    match_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_seconds INT,
    winner_name VARCHAR(100),
    player_territory_pct DOUBLE,
    total_players INT
);

-- Step 3: Create Player Scores Table
CREATE TABLE IF NOT EXISTS player_scores (
    score_id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT,
    player_name VARCHAR(100),
    is_ai TINYINT(1),
    territory_pct DOUBLE,
    claimed_cells INT,
    rank_position INT,
    eliminations INT,
    FOREIGN KEY(match_id) REFERENCES game_matches(match_id) ON DELETE CASCADE
);

-- ============================================================
-- Sample / Test Queries for Workbench
-- ============================================================

-- View Leaderboard
SELECT player_name, is_ai, territory_pct, claimed_cells, rank_position, eliminations 
FROM player_scores 
ORDER BY territory_pct DESC, claimed_cells DESC 
LIMIT 10;

-- View Match History
SELECT match_id, match_timestamp, duration_seconds, winner_name, player_territory_pct, total_players 
FROM game_matches 
ORDER BY match_id DESC 
LIMIT 10;
