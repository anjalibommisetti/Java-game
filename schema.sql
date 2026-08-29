-- ============================================================
-- Paper Territory IO - MySQL Workbench Database Setup
-- Database: paper_territory
-- ============================================================

CREATE DATABASE IF NOT EXISTS paper_territory;

USE paper_territory;

-- Step 1: Create Game Matches Table
CREATE TABLE IF NOT EXISTS game_matches (
    match_id INT AUTO_INCREMENT PRIMARY KEY,
    played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    winner_name VARCHAR(50) NOT NULL,
    duration_seconds INT NOT NULL
);

-- Step 2: Create Player Scores Table
CREATE TABLE IF NOT EXISTS player_scores (
    score_id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT,
    player_name VARCHAR(50) NOT NULL,
    is_human BOOLEAN NOT NULL,
    territory_pct DOUBLE NOT NULL,
    kills INT NOT NULL,
    final_rank INT NOT NULL,
    FOREIGN KEY (match_id) REFERENCES game_matches(match_id) ON DELETE CASCADE
);

-- ============================================================
-- Helpful Queries to View Saved Data in MySQL Workbench
-- ============================================================

-- View Leaderboard Scores
SELECT 
    player_name, 
    territory_pct, 
    kills, 
    final_rank 
FROM player_scores 
ORDER BY territory_pct DESC;

-- View Full Match History
SELECT 
    m.match_id, 
    m.played_at, 
    m.winner_name, 
    m.duration_seconds, 
    s.player_name, 
    s.territory_pct, 
    s.kills 
FROM game_matches m
JOIN player_scores s ON m.match_id = s.match_id
ORDER BY m.played_at DESC;
