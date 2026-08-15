package com.paperio.ui;

import com.paperio.db.DatabaseManager;

import javax.swing.*;
import javax.swing.table.DefaultTableCellRenderer;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.util.List;
import java.util.Map;

public class LeaderboardDialog extends JDialog {
    private final DatabaseManager dbManager;

    private final JTable leaderboardTable = new JTable();
    private final JTable historyTable = new JTable();

    public LeaderboardDialog(Frame owner, DatabaseManager dbManager) {
        super(owner, "JDBC Territory Database & Leaderboard", true);
        this.dbManager = dbManager;

        setSize(720, 480);
        setLocationRelativeTo(owner);
        setLayout(new BorderLayout());

        JTabbedPane tabbedPane = new JTabbedPane();
        tabbedPane.setFont(new Font("Segoe UI", Font.BOLD, 13));

        // Tab 1: Leaderboard
        JPanel leaderboardPanel = createTablePanel(leaderboardTable,
                new String[]{"Rank", "Player Name", "Type", "Territory %", "Claimed Cells", "Eliminations"});
        tabbedPane.addTab("Top Territory Scores", leaderboardPanel);

        // Tab 2: Match History
        JPanel historyPanel = createTablePanel(historyTable,
                new String[]{"Match ID", "Timestamp", "Duration (s)", "Winner", "Player Territory %", "Rivals"});
        tabbedPane.addTab("JDBC Match History", historyPanel);

        // Bottom Action Bar
        JPanel bottomBar = new JPanel(new FlowLayout(FlowLayout.RIGHT, 10, 10));
        bottomBar.setBackground(new Color(15, 20, 32));

        JButton btnRefresh = new JButton("Refresh Data");
        JButton btnClear = new JButton("Clear History");
        JButton btnClose = new JButton("Close");

        styleButton(btnRefresh, new Color(0, 168, 255));
        styleButton(btnClear, new Color(232, 65, 24));
        styleButton(btnClose, new Color(113, 128, 147));

        btnRefresh.addActionListener(e -> loadDatabaseData());
        btnClear.addActionListener(e -> {
            int confirm = JOptionPane.showConfirmDialog(this,
                    "Are you sure you want to clear all stored JDBC records?",
                    "Confirm Reset", JOptionPane.YES_NO_OPTION);
            if (confirm == JOptionPane.YES_OPTION) {
                dbManager.clearHistory();
                loadDatabaseData();
            }
        });
        btnClose.addActionListener(e -> dispose());

        bottomBar.add(btnRefresh);
        bottomBar.add(btnClear);
        bottomBar.add(btnClose);

        add(tabbedPane, BorderLayout.CENTER);
        add(bottomBar, BorderLayout.SOUTH);

        loadDatabaseData();
    }

    private JPanel createTablePanel(JTable table, String[] columns) {
        DefaultTableModel model = new DefaultTableModel(columns, 0) {
            @Override
            public boolean isCellEditable(int row, int column) {
                return false;
            }
        };
        table.setModel(model);
        table.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        table.setRowHeight(26);
        table.getTableHeader().setFont(new Font("Segoe UI", Font.BOLD, 13));
        table.getTableHeader().setBackground(new Color(25, 32, 48));
        table.getTableHeader().setForeground(Color.WHITE);
        table.setBackground(new Color(18, 24, 38));
        table.setForeground(new Color(220, 230, 245));
        table.setGridColor(new Color(35, 45, 65));

        DefaultTableCellRenderer centerRenderer = new DefaultTableCellRenderer();
        centerRenderer.setHorizontalAlignment(JLabel.CENTER);
        for (int i = 0; i < table.getColumnCount(); i++) {
            table.getColumnModel().getColumn(i).setCellRenderer(centerRenderer);
        }

        JScrollPane scrollPane = new JScrollPane(table);
        scrollPane.getViewport().setBackground(new Color(18, 24, 38));

        JPanel p = new JPanel(new BorderLayout());
        p.add(scrollPane, BorderLayout.CENTER);
        return p;
    }

    private void styleButton(JButton btn, Color bg) {
        btn.setFont(new Font("Segoe UI", Font.BOLD, 12));
        btn.setBackground(bg);
        btn.setForeground(Color.WHITE);
        btn.setFocusPainted(false);
        btn.setBorder(BorderFactory.createEmptyBorder(6, 14, 6, 14));
    }

    public void loadDatabaseData() {
        // Load Leaderboard
        DefaultTableModel lbModel = (DefaultTableModel) leaderboardTable.getModel();
        lbModel.setRowCount(0);
        List<Map<String, Object>> topScores = dbManager.getLeaderboard(50);
        int rank = 1;
        for (Map<String, Object> row : topScores) {
            lbModel.addRow(new Object[]{
                    "#" + rank++,
                    row.get("player_name"),
                    (Boolean) row.get("is_ai") ? "AI Rival" : "Human Player",
                    String.format("%.2f%%", (Double) row.get("territory_pct")),
                    row.get("claimed_cells"),
                    row.get("eliminations")
            });
        }

        // Load Match History
        DefaultTableModel histModel = (DefaultTableModel) historyTable.getModel();
        histModel.setRowCount(0);
        List<Map<String, Object>> history = dbManager.getMatchHistory(50);
        for (Map<String, Object> row : history) {
            histModel.addRow(new Object[]{
                    "Match #" + row.get("match_id"),
                    row.get("match_timestamp"),
                    row.get("duration_seconds") + "s",
                    row.get("winner_name"),
                    String.format("%.2f%%", (Double) row.get("player_territory_pct")),
                    row.get("total_players")
            });
        }
    }
}
