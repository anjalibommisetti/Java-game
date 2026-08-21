package com.paperio.ui;

import com.paperio.ai.AIRivalController;
import com.paperio.db.DatabaseManager;
import com.paperio.engine.CollisionEngine;
import com.paperio.engine.TerritoryGridManager;
import com.paperio.engine.TrailCaptureEngine;
import com.paperio.model.Direction;
import com.paperio.model.Player;

import javax.swing.*;
import java.awt.*;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class MainFrame extends JFrame implements CollisionEngine.CollisionEventListener, AIRivalController.AIMoveCallback {
    private static final int GRID_SIZE = 80;

    private TerritoryGridManager gridManager;
    private TrailCaptureEngine captureEngine;
    private CollisionEngine collisionEngine;
    private AIRivalController aiController;
    private DatabaseManager dbManager;

    private final List<Player> players = new ArrayList<>();
    private Player humanPlayer;

    private GamePanel gamePanel;
    private HUDPanel hudPanel;

    private Timer gameLoopTimer;
    private Timer matchTimer;
    private int elapsedSeconds = 0;
    private int playerStepDelay = 110;
    private long lastPlayerMoveTime = 0;

    private boolean isPaused = false;
    private boolean isGameOver = false;
    private int aiRivalCount = 3;
    private String currentDifficulty = "Medium";

    public MainFrame() {
        setTitle("PAPER TERRITORY IO - Multithreaded Java Capstone");
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setResizable(false);

        // 1. Initialize DB Manager
        dbManager = new DatabaseManager();

        // 2. Initialize Core Engines
        initGameEngines(aiRivalCount);

        // 3. Setup UI Layout
        setLayout(new BorderLayout());

        gamePanel = new GamePanel(gridManager, players);
        hudPanel = new HUDPanel(players);

        add(gamePanel, BorderLayout.CENTER);
        add(hudPanel, BorderLayout.EAST);

        setupMenuBar();
        setupKeyListeners();

        pack();
        setLocationRelativeTo(null);

        // 4. Game Loop Timers
        // Repaint Timer at ~60 FPS
        gameLoopTimer = new Timer(16, e -> {
            if (!isPaused && !isGameOver) {
                processPlayerMovement();
                gamePanel.repaint();
            }
        });

        // Match Second Counter
        matchTimer = new Timer(1000, e -> {
            if (!isPaused && !isGameOver) {
                elapsedSeconds++;
                hudPanel.setElapsedSeconds(elapsedSeconds);
            }
        });

        startNewMatch();
    }

    private void initGameEngines(int rivalCount) {
        gridManager = new TerritoryGridManager(GRID_SIZE, GRID_SIZE);
        captureEngine = new TrailCaptureEngine(gridManager);
        collisionEngine = new CollisionEngine(gridManager);
        collisionEngine.addListener(this);

        players.clear();

        // Add Human Player (Cyan)
        humanPlayer = new Player(1, "You (Human)", false,
                new Color(0, 229, 255),
                new Color(0, 229, 255, 110),
                new Color(0, 229, 255));
        players.add(humanPlayer);

        // AI Colors
        Color[] aiColors = {
                new Color(255, 23, 68),   // Red Comet
                new Color(255, 234, 0),   // Golden Viper
                new Color(0, 230, 118),   // Emerald Ghost
                new Color(224, 64, 251)   // Neon Phantom
        };
        String[] aiNames = {"AI Red Comet", "AI Golden Viper", "AI Emerald Ghost", "AI Neon Phantom"};

        for (int i = 0; i < rivalCount; i++) {
            Color mainColor = aiColors[i % aiColors.length];
            Color terrColor = new Color(mainColor.getRed(), mainColor.getGreen(), mainColor.getBlue(), 110);
            Player ai = new Player(i + 2, aiNames[i], true, mainColor, terrColor, mainColor);
            players.add(ai);
        }

        aiController = new AIRivalController(gridManager, captureEngine, collisionEngine, players);
        aiController.setMoveCallback(this);
        aiController.setDifficulty(currentDifficulty);
    }

    private void startNewMatch() {
        if (aiController != null) {
            aiController.stopAIs();
        }

        gridManager.resetGrid();
        elapsedSeconds = 0;
        isGameOver = false;
        isPaused = false;
        hudPanel.clearLog();
        hudPanel.setElapsedSeconds(0);
        hudPanel.setGameStatus("MATCH ACTIVE", new Color(76, 209, 55));
        hudPanel.addEventLog("Match started with " + (players.size() - 1) + " AI rivals!");

        // Spawn Human at Center Top-Left
        gridManager.spawnPlayer(humanPlayer, 20, 20, 3);

        // Spawn AI Players at evenly spaced coordinates
        int[][] spawnCoords = {{60, 60}, {60, 20}, {20, 60}, {40, 40}};
        int aiIdx = 0;
        for (Player p : players) {
            if (p.isAI()) {
                int[] pos = spawnCoords[aiIdx % spawnCoords.length];
                gridManager.spawnPlayer(p, pos[0], pos[1], 3);
                aiIdx++;
            }
        }

        gridManager.updateTerritoryStats(players);
        hudPanel.updateHUD();

        aiController.startAIs();
        gameLoopTimer.start();
        matchTimer.start();
    }

    private void processPlayerMovement() {
        if (!humanPlayer.isAlive()) return;

        long now = System.currentTimeMillis();
        if (now - lastPlayerMoveTime < playerStepDelay) return;
        lastPlayerMoveTime = now;

        Direction nextDir = humanPlayer.getNextDirection();
        if (nextDir != Direction.NONE && nextDir != humanPlayer.getCurrentDirection().getOpposite()) {
            humanPlayer.setCurrentDirection(nextDir);
        }

        Direction curDir = humanPlayer.getCurrentDirection();
        if (curDir == Direction.NONE) return;

        int nx = humanPlayer.getX() + curDir.getDx();
        int ny = humanPlayer.getY() + curDir.getDy();

        // Collision detection check
        boolean survived = collisionEngine.checkAndHandleCollisions(humanPlayer, nx, ny, players);
        if (!survived) {
            checkMatchEndCondition();
            return;
        }

        humanPlayer.setPosition(nx, ny);

        // Check if outside territory
        int cellOwner = gridManager.getOwner(nx, ny);
        if (cellOwner != humanPlayer.getId()) {
            humanPlayer.setOutside(true);
            humanPlayer.addTrailPoint(nx, ny);
            gridManager.setTrailOwner(nx, ny, humanPlayer.getId());
        } else {
            if (humanPlayer.isOutside()) {
                // Safe return to home -> perform capture fill!
                int claimed = captureEngine.performCapture(humanPlayer);
                gridManager.updateTerritoryStats(players);

                gamePanel.addFloatingText("+" + String.format("%.1f%%", (claimed / (double)(GRID_SIZE*GRID_SIZE))*100), nx, ny, humanPlayer.getFillColor());
                hudPanel.addEventLog("You captured " + claimed + " cells!");
                hudPanel.updateHUD();

                checkMatchEndCondition();
            }
        }
    }

    @Override
    public void onAIMoved(Player aiPlayer, int capturedCount) {
        if (capturedCount > 0) {
            gridManager.updateTerritoryStats(players);
            gamePanel.addFloatingText("+" + String.format("%.1f%%", (capturedCount / (double)(GRID_SIZE*GRID_SIZE))*100), aiPlayer.getX(), aiPlayer.getY(), aiPlayer.getFillColor());
            hudPanel.addEventLog(aiPlayer.getName() + " captured " + capturedCount + " cells!");
            hudPanel.updateHUD();
            checkMatchEndCondition();
        }
    }

    private String humanPlayerDeathReason = "";

    @Override
    public void onPlayerEliminated(Player victim, Player killer, String reason) {
        hudPanel.addEventLog("ELIMINATION: " + reason);
        gamePanel.addFloatingText("ELIMINATED!", victim.getX(), victim.getY(), Color.RED);

        gridManager.updateTerritoryStats(players);
        hudPanel.updateHUD();

        if (victim == humanPlayer) {
            humanPlayerDeathReason = reason;
            hudPanel.setGameStatus("YOU DIED!", Color.RED);
            hudPanel.addEventLog("Game Over! You were eliminated: " + reason);
        }

        checkMatchEndCondition();
    }

    private synchronized void checkMatchEndCondition() {
        if (isGameOver) return;

        int aliveCount = 0;
        Player lastSurvivor = null;

        for (Player p : players) {
            if (p.isAlive()) {
                aliveCount++;
                lastSurvivor = p;
            }
        }

        boolean humanDead = !humanPlayer.isAlive();
        boolean allAIsDead = (aliveCount == 1 && lastSurvivor == humanPlayer);

        if (humanDead || allAIsDead || aliveCount == 0) {
            isGameOver = true;
            aiController.stopAIs();
            matchTimer.stop();

            // Rank players by territory percentage
            List<Player> rankings = new ArrayList<>(players);
            rankings.sort(Comparator.comparingDouble(Player::getTerritoryPercentage).reversed());

            String winnerName = rankings.isEmpty() ? "None" : rankings.get(0).getName();
            hudPanel.setGameStatus("MATCH OVER", Color.ORANGE);
            hudPanel.addEventLog("Match finished! Winner: " + winnerName);

            // SAVE RESULTS TO DATABASE (Module 5)
            boolean saved = dbManager.saveMatchResults(elapsedSeconds, winnerName, rankings);
            if (saved) {
                hudPanel.addEventLog("Saved final scores to SQLite JDBC database!");
            }

            // Show Game Over Dialog
            SwingUtilities.invokeLater(() -> showGameOverDialog(winnerName, rankings));
        }
    }

    private void showGameOverDialog(String winnerName, List<Player> rankings) {
        StringBuilder sb = new StringBuilder();
        if (!humanPlayer.isAlive()) {
            sb.append("💀 CAUSE OF ELIMINATION:\n");
            sb.append("   ").append(humanPlayerDeathReason.isEmpty() ? "You were eliminated!" : humanPlayerDeathReason).append("\n\n");
        } else {
            sb.append("🏆 VICTORY!\n   You conquered the arena & eliminated all rivals!\n\n");
        }
        sb.append("Winner: ").append(winnerName).append("\n\n");
        sb.append("Final Territory Rankings:\n");
        int rank = 1;
        for (Player p : rankings) {
            String status = p.isAlive() ? "" : " (Out)";
            sb.append(String.format("%d. %s%s - %.2f%% (%d cells, %d kills)\n",
                    rank++, p.getName(), status, p.getTerritoryPercentage(), p.getClaimedCount(), p.getKillCount()));
        }

        sb.append("\nResults have been persisted via JDBC to SQLite database.");

        int choice = JOptionPane.showOptionDialog(this,
                sb.toString(),
                "Match Over!",
                JOptionPane.YES_NO_OPTION,
                JOptionPane.INFORMATION_MESSAGE,
                null,
                new String[]{"Play Again", "View Leaderboard"},
                "Play Again");

        if (choice == JOptionPane.YES_OPTION) {
            startNewMatch();
        } else if (choice == JOptionPane.NO_OPTION) {
            showLeaderboardDialog();
        }
    }

    private void showLeaderboardDialog() {
        LeaderboardDialog dialog = new LeaderboardDialog(this, dbManager);
        dialog.setVisible(true);
    }

    private void setupMenuBar() {
        JMenuBar mb = new JMenuBar();

        // Game Menu
        JMenu gameMenu = new JMenu("Game");
        JMenuItem miNew = new JMenuItem("New Match (F2)");
        JMenuItem miPause = new JMenuItem("Pause / Resume (P)");
        JMenuItem miExit = new JMenuItem("Exit");

        miNew.addActionListener(e -> startNewMatch());
        miPause.addActionListener(e -> togglePause());
        miExit.addActionListener(e -> System.exit(0));

        gameMenu.add(miNew);
        gameMenu.add(miPause);
        gameMenu.addSeparator();
        gameMenu.add(miExit);

        // Options Menu
        JMenu optMenu = new JMenu("Options");
        JMenu rivalMenu = new JMenu("AI Rivals Count");
        for (int i = 1; i <= 4; i++) {
            int count = i;
            JMenuItem mi = new JMenuItem(count + " AI Rival" + (count > 1 ? "s" : ""));
            mi.addActionListener(e -> {
                aiRivalCount = count;
                initGameEngines(aiRivalCount);
                startNewMatch();
            });
            rivalMenu.add(mi);
        }

        JMenu diffMenu = new JMenu("AI Difficulty");
        String[] diffs = {"Easy", "Medium", "Hard"};
        for (String d : diffs) {
            JMenuItem mi = new JMenuItem(d);
            mi.addActionListener(e -> {
                currentDifficulty = d;
                aiController.setDifficulty(d);
                hudPanel.addEventLog("AI Difficulty set to " + d);
            });
            diffMenu.add(mi);
        }

        optMenu.add(rivalMenu);
        optMenu.add(diffMenu);

        // Database Menu
        JMenu dbMenu = new JMenu("Database (JDBC)");
        JMenuItem miLeaderboard = new JMenuItem("View Stored Scores & History");
        miLeaderboard.addActionListener(e -> showLeaderboardDialog());
        dbMenu.add(miLeaderboard);

        // Live Demo Menu (For Capstone Presentation)
        JMenu demoMenu = new JMenu("Live Presentation Demo");
        JMenuItem miDemoCapture = new JMenuItem("Demo: Perform Instant Territory Capture");
        JMenuItem miDemoElimination = new JMenuItem("Demo: Trigger AI Collision Event");

        miDemoCapture.addActionListener(e -> {
            if (humanPlayer != null && humanPlayer.isAlive()) {
                // Simulate human drawing a small loop
                int hx = humanPlayer.getX();
                int hy = humanPlayer.getY();
                for (int dx = 1; dx <= 5; dx++) {
                    humanPlayer.addTrailPoint(hx + dx, hy);
                    gridManager.setTrailOwner(hx + dx, hy, humanPlayer.getId());
                }
                int claimed = captureEngine.performCapture(humanPlayer);
                gridManager.updateTerritoryStats(players);
                hudPanel.addEventLog("LIVE DEMO: Instant Territory Capture performed (+" + claimed + " cells)!");
                gamePanel.addFloatingText("DEMO CAPTURE!", hx, hy, humanPlayer.getFillColor());
                hudPanel.updateHUD();
                gamePanel.repaint();
            }
        });

        miDemoElimination.addActionListener(e -> {
            for (Player p : players) {
                if (p.isAI() && p.isAlive()) {
                    collisionEngine.eliminatePlayer(p, humanPlayer, p.getName() + " was eliminated in Live Demo!");
                    hudPanel.addEventLog("LIVE DEMO: Elimination event triggered!");
                    gamePanel.repaint();
                    break;
                }
            }
        });

        demoMenu.add(miDemoCapture);
        demoMenu.add(miDemoElimination);

        // Help Menu
        JMenu helpMenu = new JMenu("Help");
        JMenuItem miRules = new JMenuItem("Controls & Rules");
        miRules.addActionListener(e -> JOptionPane.showMessageDialog(this,
                "PAPER TERRITORY IO - CONTROLS & RULES\n\n" +
                "Controls:\n" +
                " - Arrow Keys / WASD: Move Player\n" +
                " - P: Pause / Resume Match\n" +
                " - F2: Quick Restart Match\n\n" +
                "Rules:\n" +
                " 1. Step outside your color territory to draw a trail.\n" +
                " 2. Return safely to your territory to claim all enclosed area!\n" +
                " 3. Do not run into your own trail or allow AI rivals to cut your trail!\n" +
                " 4. Cut opponent trails to eliminate them from the match.\n" +
                " 5. Highest territory percentage at match end wins!",
                "Game Instructions", JOptionPane.INFORMATION_MESSAGE));
        helpMenu.add(miRules);

        mb.add(gameMenu);
        mb.add(optMenu);
        mb.add(dbMenu);
        mb.add(demoMenu);
        mb.add(helpMenu);

        setJMenuBar(mb);
    }

    private void togglePause() {
        isPaused = !isPaused;
        hudPanel.setGameStatus(isPaused ? "PAUSED" : "MATCH ACTIVE", isPaused ? Color.YELLOW : new Color(76, 209, 55));
    }

    private void setupKeyListeners() {
        addKeyListener(new KeyAdapter() {
            @Override
            public void keyPressed(KeyEvent e) {
                int key = e.getKeyCode();
                if (key == KeyEvent.VK_UP || key == KeyEvent.VK_W) {
                    humanPlayer.setNextDirection(Direction.UP);
                } else if (key == KeyEvent.VK_DOWN || key == KeyEvent.VK_S) {
                    humanPlayer.setNextDirection(Direction.DOWN);
                } else if (key == KeyEvent.VK_LEFT || key == KeyEvent.VK_A) {
                    humanPlayer.setNextDirection(Direction.LEFT);
                } else if (key == KeyEvent.VK_RIGHT || key == KeyEvent.VK_D) {
                    humanPlayer.setNextDirection(Direction.RIGHT);
                } else if (key == KeyEvent.VK_P) {
                    togglePause();
                } else if (key == KeyEvent.VK_F2) {
                    startNewMatch();
                }
            }
        });
        setFocusable(true);
        requestFocusInWindow();
    }
}
