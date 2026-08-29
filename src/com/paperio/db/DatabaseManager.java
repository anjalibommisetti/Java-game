package com.paperio.db;

import com.paperio.model.Player;

import java.sql.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class DatabaseManager {
    // MySQL Database credentials
    private static final String MYSQL_URL = "jdbc:mysql://localhost:3306/paper_territory?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC";
    private static final String MYSQL_USER = "root";
    private static final String MYSQL_PASS = "Anjali@18";

    // SQLite Fallback
    private static final String SQLITE_URL = "jdbc:sqlite:paper_territory.db";

    private boolean isMySQLActive = false;

    public DatabaseManager() {
        // First attempt to connect to MySQL
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
            try (Connection conn = DriverManager.getConnection(MYSQL_URL, MYSQL_USER, MYSQL_PASS)) {
                isMySQLActive = true;
                System.out.println("✅ Connected to MySQL Database (localhost:3306/paper_territory) as root!");
            }
        } catch (Throwable e) {
            System.out.println("⚠️ Could not connect to MySQL (" + e.getMessage() + "). Falling back to SQLite database.");
            try {
                Class.forName("org.sqlite.JDBC");
            } catch (Throwable ex) {
                System.err.println("SQLite JDBC Driver Error: " + ex.getMessage());
            }
        }

        initTables();
    }

    private Connection getConnection() throws SQLException {
        if (isMySQLActive) {
            return DriverManager.getConnection(MYSQL_URL, MYSQL_USER, MYSQL_PASS);
        } else {
            return DriverManager.getConnection(SQLITE_URL);
        }
    }

    private void initTables() {
        String createMatchesTable;
        String createPlayerScoresTable;

        if (isMySQLActive) {
            createMatchesTable = "CREATE TABLE IF NOT EXISTS game_matches (" +
                    "match_id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                    "winner_name VARCHAR(50) NOT NULL, " +
                    "duration_seconds INT NOT NULL" +
                    ");";

            createPlayerScoresTable = "CREATE TABLE IF NOT EXISTS player_scores (" +
                    "score_id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "match_id INT, " +
                    "player_name VARCHAR(50) NOT NULL, " +
                    "is_human BOOLEAN NOT NULL, " +
                    "territory_pct DOUBLE NOT NULL, " +
                    "kills INT NOT NULL, " +
                    "final_rank INT NOT NULL, " +
                    "FOREIGN KEY (match_id) REFERENCES game_matches(match_id) ON DELETE CASCADE" +
                    ");";
        } else {
            createMatchesTable = "CREATE TABLE IF NOT EXISTS game_matches (" +
                    "match_id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                    "played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                    "winner_name TEXT NOT NULL, " +
                    "duration_seconds INTEGER NOT NULL" +
                    ");";

            createPlayerScoresTable = "CREATE TABLE IF NOT EXISTS player_scores (" +
                    "score_id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                    "match_id INTEGER, " +
                    "player_name TEXT NOT NULL, " +
                    "is_human INTEGER NOT NULL, " +
                    "territory_pct REAL NOT NULL, " +
                    "kills INTEGER NOT NULL, " +
                    "final_rank INTEGER NOT NULL, " +
                    "FOREIGN KEY (match_id) REFERENCES game_matches(match_id) ON DELETE CASCADE" +
                    ");";
        }

        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute(createMatchesTable);
            stmt.execute(createPlayerScoresTable);
            System.out.println("Database Tables Initialized Successfully (" + (isMySQLActive ? "MySQL" : "SQLite") + ").");
        } catch (SQLException e) {
            System.err.println("Failed to initialize database tables: " + e.getMessage());
        }
    }

    public synchronized boolean saveMatchResults(int durationSec, String winnerName, List<Player> rankedPlayers) {
        String insertMatchSql = "INSERT INTO game_matches (winner_name, duration_seconds) VALUES (?, ?)";
        String insertScoreSql = "INSERT INTO player_scores (match_id, player_name, is_human, territory_pct, kills, final_rank) VALUES (?, ?, ?, ?, ?, ?)";

        try (Connection conn = getConnection()) {
            conn.setAutoCommit(false);

            int matchId = -1;
            try (PreparedStatement pstmtMatch = conn.prepareStatement(insertMatchSql, Statement.RETURN_GENERATED_KEYS)) {
                pstmtMatch.setString(1, winnerName);
                pstmtMatch.setInt(2, durationSec);
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
                        pstmtScore.setBoolean(3, !p.isAI());
                        pstmtScore.setDouble(4, p.getTerritoryPercentage());
                        pstmtScore.setInt(5, p.getKillCount());
                        pstmtScore.setInt(6, i + 1);
                        pstmtScore.addBatch();
                    }
                    pstmtScore.executeBatch();
                }
            }

            conn.commit();
            System.out.println("Match results saved to " + (isMySQLActive ? "MySQL" : "SQLite") + " database! (Match ID: " + matchId + ")");
            return true;
        } catch (SQLException e) {
            System.err.println("JDBC Error saving match results: " + e.getMessage());
            return false;
        }
    }

    public List<Map<String, Object>> getLeaderboard(int limit) {
        List<Map<String, Object>> list = new ArrayList<>();
        String sql = "SELECT player_name, is_human, territory_pct, kills, final_rank " +
                     "FROM player_scores ORDER BY territory_pct DESC, kills DESC LIMIT ?";

        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, limit);
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("player_name", rs.getString("player_name"));
                    map.put("is_human", rs.getBoolean("is_human"));
                    map.put("territory_pct", rs.getDouble("territory_pct"));
                    map.put("kills", rs.getInt("kills"));
                    map.put("final_rank", rs.getInt("final_rank"));
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
        String sql = "SELECT match_id, played_at, winner_name, duration_seconds " +
                     "FROM game_matches ORDER BY match_id DESC LIMIT ?";

        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, limit);
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("match_id", rs.getInt("match_id"));
                    map.put("played_at", rs.getString("played_at"));
                    map.put("winner_name", rs.getString("winner_name"));
                    map.put("duration_seconds", rs.getInt("duration_seconds"));
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
