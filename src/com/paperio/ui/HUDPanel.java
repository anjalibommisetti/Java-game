package com.paperio.ui;

import com.paperio.model.Player;

import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class HUDPanel extends JPanel {
    private final List<Player> players;

    private final JLabel timeLabel = new JLabel("TIME: 00:00");
    private final JLabel statusLabel = new JLabel("STATUS: LIVE MATCH");
    private final JPanel leaderboardListPanel = new JPanel();
    private final JTextArea eventLogArea = new JTextArea(4, 30);

    private int elapsedSeconds = 0;

    public HUDPanel(List<Player> players) {
        this.players = players;

        setLayout(new BorderLayout(10, 10));
        setBackground(new Color(13, 17, 28));
        setBorder(new EmptyBorder(10, 15, 10, 15));

        // --- Top Bar: Header Title & Timer ---
        JPanel topHeader = new JPanel(new BorderLayout());
        topHeader.setOpaque(false);

        JLabel titleLabel = new JLabel("PAPER TERRITORY IO");
        titleLabel.setFont(new Font("Segoe UI", Font.BOLD, 18));
        titleLabel.setForeground(new Color(0, 229, 255));

        timeLabel.setFont(new Font("Monospaced", Font.BOLD, 16));
        timeLabel.setForeground(Color.WHITE);

        statusLabel.setFont(new Font("Segoe UI", Font.BOLD, 12));
        statusLabel.setForeground(new Color(76, 209, 55));

        JPanel rightTop = new JPanel(new FlowLayout(FlowLayout.RIGHT, 15, 0));
        rightTop.setOpaque(false);
        rightTop.add(statusLabel);
        rightTop.add(timeLabel);

        topHeader.add(titleLabel, BorderLayout.WEST);
        topHeader.add(rightTop, BorderLayout.EAST);

        // --- Center: Live Territory Ranking Bars ---
        leaderboardListPanel.setLayout(new BoxLayout(leaderboardListPanel, BoxLayout.Y_AXIS));
        leaderboardListPanel.setOpaque(false);

        JScrollPane rankScroll = new JScrollPane(leaderboardListPanel);
        rankScroll.setOpaque(false);
        rankScroll.getViewport().setOpaque(false);
        rankScroll.setBorder(BorderFactory.createTitledBorder(
                BorderFactory.createLineBorder(new Color(40, 50, 75)),
                "LIVE TERRITORY SCOREBOARD",
                0, 0,
                new Font("Segoe UI", Font.BOLD, 12),
                new Color(160, 174, 192)
        ));

        // --- Bottom: Event Feed Log ---
        eventLogArea.setEditable(false);
        eventLogArea.setFont(new Font("Consolas", Font.PLAIN, 11));
        eventLogArea.setBackground(new Color(20, 26, 42));
        eventLogArea.setForeground(new Color(200, 215, 230));
        eventLogArea.setMargin(new Insets(5, 8, 5, 8));

        JScrollPane logScroll = new JScrollPane(eventLogArea);
        logScroll.setPreferredSize(new Dimension(280, 75));
        logScroll.setBorder(BorderFactory.createTitledBorder(
                BorderFactory.createLineBorder(new Color(40, 50, 75)),
                "LIVE EVENT TICKER",
                0, 0,
                new Font("Segoe UI", Font.BOLD, 11),
                new Color(160, 174, 192)
        ));

        add(topHeader, BorderLayout.NORTH);
        add(rankScroll, BorderLayout.CENTER);
        add(logScroll, BorderLayout.SOUTH);

        setPreferredSize(new Dimension(290, 600));
        updateHUD();
    }

    public void setElapsedSeconds(int sec) {
        this.elapsedSeconds = sec;
        int m = sec / 60;
        int s = sec % 60;
        timeLabel.setText(String.format("TIME: %02d:%02d", m, s));
    }

    public void setGameStatus(String status, Color color) {
        statusLabel.setText("STATUS: " + status);
        statusLabel.setForeground(color);
    }

    public void addEventLog(String message) {
        SwingUtilities.invokeLater(() -> {
            eventLogArea.append("> " + message + "\n");
            eventLogArea.setCaretPosition(eventLogArea.getDocument().getLength());
        });
    }

    public void clearLog() {
        eventLogArea.setText("");
    }

    public void updateHUD() {
        SwingUtilities.invokeLater(() -> {
            leaderboardListPanel.removeAll();

            List<Player> sorted = new ArrayList<>(players);
            sorted.sort(Comparator.comparingDouble(Player::getTerritoryPercentage).reversed());

            int rank = 1;
            for (Player p : sorted) {
                JPanel card = new JPanel(new BorderLayout(5, 5));
                card.setOpaque(false);
                card.setBorder(new EmptyBorder(4, 5, 4, 5));

                JLabel nameLabel = new JLabel(String.format("#%d  %s %s", rank, p.getName(), p.isAlive() ? "" : "(DEAD)"));
                nameLabel.setFont(new Font("Segoe UI", Font.BOLD, 12));
                nameLabel.setForeground(p.isAlive() ? p.getFillColor() : Color.GRAY);

                JLabel pctLabel = new JLabel(String.format("%.1f%%", p.getTerritoryPercentage()));
                pctLabel.setFont(new Font("Monospaced", Font.BOLD, 12));
                pctLabel.setForeground(p.isAlive() ? Color.WHITE : Color.GRAY);

                JProgressBar bar = new JProgressBar(0, 100);
                bar.setValue((int) Math.round(p.getTerritoryPercentage()));
                bar.setForeground(p.getFillColor());
                bar.setBackground(new Color(25, 32, 50));
                bar.setBorderPainted(false);
                bar.setPreferredSize(new Dimension(200, 8));

                JPanel textLine = new JPanel(new BorderLayout());
                textLine.setOpaque(false);
                textLine.add(nameLabel, BorderLayout.WEST);
                textLine.add(pctLabel, BorderLayout.EAST);

                card.add(textLine, BorderLayout.NORTH);
                card.add(bar, BorderLayout.SOUTH);

                leaderboardListPanel.add(card);
                leaderboardListPanel.add(Box.createVerticalStrut(6));
                rank++;
            }

            leaderboardListPanel.revalidate();
            leaderboardListPanel.repaint();
        });
    }
}
