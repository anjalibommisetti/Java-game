package com.paperio.db;

import com.paperio.model.Player;

import java.sql.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class DatabaseManager {
    private static final String DB_URL = "jdbc:sqlite:paper_territory.db";

    public DatabaseManager() {
        try {
            Class.forName("org.sqlite.JDBC");
            initTables();
        } catch (Throwable e) {
            System.err.println("JDBC Database Init Warning: " + e.getMessage());
        }
    }

    private Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL);
    }

    private void initTables() {
        String createMatchesTable = "CREATE TABLE IF NOT EXISTS game_matches (" +
                "match_id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "match_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                "duration_seconds INTEGER, " +
                "winner_name TEXT, " +
                "player_territory_pct REAL, " +
                "total_players INTEGER" +
                ");";

        String createPlayerScoresTable = "CREATE TABLE IF NOT EXISTS player_scores (" +
                "score_id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "match_id INTEGER, " +
                "player_name TEXT, " +
                "is_ai INTEGER, " +
                "territory_pct REAL, " +
                "claimed_cells INTEGER, " +
                "rank_position INTEGER, " +
                "eliminations INTEGER, " +
                "FOREIGN KEY(match_id) REFERENCES game_matches(match_id) ON DELETE CASCADE" +
                ");";

        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute(createMatchesTable);
            stmt.execute(createPlayerScoresTable);
            System.out.println("SQLite JDBC Tables Initialized Successfully.");
        } catch (SQLException e) {
            System.err.println("Failed to initialize database tables: " + e.getMessage());
        }
    }

    public synchronized boolean saveMatchResults(int durationSec, String winnerName, List<Player> rankedPlayers) {
        String insertMatchSql = "INSERT INTO game_matches (duration_seconds, winner_name, player_territory_pct, total_players) VALUES (?, ?, ?, ?)";
        String insertScoreSql = "INSERT INTO player_scores (match_id, player_name, is_ai, territory_pct, claimed_cells, rank_position, eliminations) VALUES (?, ?, ?, ?, ?, ?, ?)";

        double humanPct = 0.0;
        for (Player p : rankedPlayers) {
            if (!p.isAI()) {
                humanPct = p.getTerritoryPercentage();
                break;
            }
        }

        try (Connection conn = getConnection()) {
            conn.setAutoCommit(false);

            int matchId = -1;
            try (PreparedStatement pstmtMatch = conn.prepareStatement(insertMatchSql, Statement.RETURN_GENERATED_KEYS)) {
                pstmtMatch.setInt(1, durationSec);
                pstmtMatch.setString(2, winnerName);
                pstmtMatch.setDouble(3, humanPct);
                pstmtMatch.setInt(4, rankedPlayers.size());
                pstmtMatch.executeUpdate();

                try (ResultSet rs = pstmtMatch.getGeneratedKeys()) {
                    if (rs.next()) {
                        matchId = rs.getInt(1);
                    }
                }
            }

            if (matchId != -1) {
                try (PreparedStatement pstmtScore = conn.prepareStatement(insertScoreSql)) {
                    for (int i = 0; i < rankedPlayers.size(); i++) {
                        Player p = rankedPlayers.get(i);
                        pstmtScore.setInt(1, matchId);
                        pstmtScore.setString(2, p.getName());
                        pstmtScore.setInt(3, p.isAI() ? 1 : 0);
                        pstmtScore.setDouble(4, p.getTerritoryPercentage());
                        pstmtScore.setInt(5, p.getClaimedCount());
                        pstmtScore.setInt(6, i + 1);
                        pstmtScore.setInt(7, p.getKillCount());
                        pstmtScore.addBatch();
                    }
                    pstmtScore.executeBatch();
                }
            }

            conn.commit();
            System.out.println("Match results saved to SQLite JDBC database! (Match ID: " + matchId + ")");
            return true;
        } catch (SQLException e) {
            System.err.println("JDBC Error saving match results: " + e.getMessage());
            return false;
        }
    }

    public List<Map<String, Object>> getLeaderboard(int limit) {
        List<Map<String, Object>> list = new ArrayList<>();
        String sql = "SELECT player_name, is_ai, territory_pct, claimed_cells, rank_position, eliminations " +
                     "FROM player_scores ORDER BY territory_pct DESC, claimed_cells DESC LIMIT ?";

        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, limit);
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("player_name", rs.getString("player_name"));
                    map.put("is_ai", rs.getInt("is_ai") == 1);
                    map.put("territory_pct", rs.getDouble("territory_pct"));
                    map.put("claimed_cells", rs.getInt("claimed_cells"));
                    map.put("rank_position", rs.getInt("rank_position"));
                    map.put("eliminations", rs.getInt("eliminations"));
                    list.add(map);
                }
            }
        } catch (SQLException e) {
            System.err.println("JDBC Error fetching leaderboard: " + e.getMessage());
        }
        return list;
    }

    public List<Map<String, Object>> getMatchHistory(int limit) {
        List<Map<String, Object>> list = new ArrayList<>();
        String sql = "SELECT match_id, match_timestamp, duration_seconds, winner_name, player_territory_pct, total_players " +
                     "FROM game_matches ORDER BY match_id DESC LIMIT ?";

        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, limit);
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("match_id", rs.getInt("match_id"));
                    map.put("match_timestamp", rs.getString("match_timestamp"));
                    map.put("duration_seconds", rs.getInt("duration_seconds"));
                    map.put("winner_name", rs.getString("winner_name"));
                    map.put("player_territory_pct", rs.getDouble("player_territory_pct"));
                    map.put("total_players", rs.getInt("total_players"));
                    list.add(map);
                }
            }
        } catch (SQLException e) {
            System.err.println("JDBC Error fetching match history: " + e.getMessage());
        }
        return list;
    }

    public void clearHistory() {
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute("DELETE FROM player_scores;");
            stmt.execute("DELETE FROM game_matches;");
        } catch (SQLException e) {
            System.err.println("JDBC Error clearing history: " + e.getMessage());
        }
    }
}
