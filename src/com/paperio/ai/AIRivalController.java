package com.paperio.ai;

import com.paperio.engine.CollisionEngine;
import com.paperio.engine.TerritoryGridManager;
import com.paperio.engine.TrailCaptureEngine;
import com.paperio.model.Direction;
import com.paperio.model.Player;

import java.awt.Point;
import java.util.*;

public class AIRivalController {
    private final TerritoryGridManager gridManager;
    private final TrailCaptureEngine captureEngine;
    private final CollisionEngine collisionEngine;

    private final List<AIThread> aiThreads = new ArrayList<>();
    private final List<Player> allPlayers;
    private final Random random = new Random();
    private volatile boolean running = false;
    private int stepDelayMs = 120; // AI tick speed

    public interface AIMoveCallback {
        void onAIMoved(Player aiPlayer, int capturedCount);
    }

    private AIMoveCallback moveCallback;

    public AIRivalController(TerritoryGridManager gridManager, TrailCaptureEngine captureEngine,
                             CollisionEngine collisionEngine, List<Player> allPlayers) {
        this.gridManager = gridManager;
        this.captureEngine = captureEngine;
        this.collisionEngine = collisionEngine;
        this.allPlayers = allPlayers;
    }

    public void setMoveCallback(AIMoveCallback moveCallback) {
        this.moveCallback = moveCallback;
    }

    public void setDifficulty(String difficulty) {
        switch (difficulty.toLowerCase()) {
            case "easy": stepDelayMs = 160; break;
            case "medium": stepDelayMs = 110; break;
            case "hard": stepDelayMs = 75; break;
            default: stepDelayMs = 110; break;
        }
    }

    public void startAIs() {
        stopAIs();
        running = true;
        aiThreads.clear();

        for (Player p : allPlayers) {
            if (p.isAI() && p.isAlive()) {
                AIThread thread = new AIThread(p);
                aiThreads.add(thread);
                thread.start();
            }
        }
    }

    public void stopAIs() {
        running = false;
        for (AIThread t : aiThreads) {
            t.interrupt();
        }
        aiThreads.clear();
    }

    private class AIThread extends Thread {
        private final Player aiPlayer;
        private int excursionSteps = 0;
        private int maxExcursion = 8 + random.nextInt(8);

        public AIThread(Player aiPlayer) {
            super("AI-Thread-" + aiPlayer.getName());
            this.aiPlayer = aiPlayer;
        }

        @Override
        public void run() {
            while (running && aiPlayer.isAlive() && !isInterrupted()) {
                try {
                    Thread.sleep(stepDelayMs + random.nextInt(20));

                    gridManager.getLock().lock();
                    try {
                        if (!running || !aiPlayer.isAlive()) break;

                        Direction chosenDir = decideNextDirection();
                        if (chosenDir != Direction.NONE) {
                            aiPlayer.setCurrentDirection(chosenDir);
                        }

                        // Execute movement step for AI
                        Direction curDir = aiPlayer.getCurrentDirection();
                        if (curDir != Direction.NONE) {
                            int nx = aiPlayer.getX() + curDir.getDx();
                            int ny = aiPlayer.getY() + curDir.getDy();

                            // Collision check
                            boolean survived = collisionEngine.checkAndHandleCollisions(aiPlayer, nx, ny, allPlayers);
                            if (!survived) {
                                break; // AI died
                            }

                            // Advance AI position
                            aiPlayer.setPosition(nx, ny);
                            int capturedCount = 0;

                            // Check territory state
                            int currentOwner = gridManager.getOwner(nx, ny);
                            if (currentOwner != aiPlayer.getId()) {
                                // Step outside owned territory -> append to trail
                                aiPlayer.setOutside(true);
                                aiPlayer.addTrailPoint(nx, ny);
                                gridManager.setTrailOwner(nx, ny, aiPlayer.getId());
                                excursionSteps++;
                            } else {
                                // Stepped into owned territory
                                if (aiPlayer.isOutside()) {
                                    // Safe return -> trigger capture fill!
                                    capturedCount = captureEngine.performCapture(aiPlayer);
                                    excursionSteps = 0;
                                    maxExcursion = 8 + random.nextInt(10);
                                }
                            }

                            if (moveCallback != null) {
                                moveCallback.onAIMoved(aiPlayer, capturedCount);
                            }
                        }
                    } finally {
                        gridManager.getLock().unlock();
                    }

                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }

        private Direction decideNextDirection() {
            Direction curDir = aiPlayer.getCurrentDirection();
            int cx = aiPlayer.getX();
            int cy = aiPlayer.getY();

            List<Direction> validDirs = getValidDirections(cx, cy, curDir);
            if (validDirs.isEmpty()) {
                return Direction.NONE;
            }

            boolean isOutside = aiPlayer.isOutside();

            // Should AI head home?
            if (isOutside && (excursionSteps >= maxExcursion || isRivalThreatNearby(cx, cy))) {
                Direction homeDir = getDirectionTowardsHome(cx, cy, validDirs);
                if (homeDir != Direction.NONE) {
                    return homeDir;
                }
            }

            // Prefer directions that step outside if inside, or continue loop if outside
            if (!isOutside) {
                // Inside home territory: occasionally pick a direction that leads outside
                for (Direction d : validDirs) {
                    int tx = cx + d.getDx();
                    int ty = cy + d.getDy();
                    if (gridManager.getOwner(tx, ty) != aiPlayer.getId()) {
                        return d;
                    }
                }
            } else {
                // Outside territory: try to keep current direction if safe
                if (validDirs.contains(curDir) && random.nextDouble() > 0.3) {
                    return curDir;
                }
            }

            // Pick a random valid direction
            return validDirs.get(random.nextInt(validDirs.size()));
        }

        private List<Direction> getValidDirections(int x, int y, Direction curDir) {
            List<Direction> valid = new ArrayList<>();
            Direction opposite = curDir.getOpposite();

            for (Direction d : Direction.values()) {
                if (d == Direction.NONE || d == opposite) continue;

                int nx = x + d.getDx();
                int ny = y + d.getDy();

                if (!gridManager.isValidCell(nx, ny)) continue;

                // Avoid self trail collision
                if (gridManager.getTrailOwner(nx, ny) == aiPlayer.getId()) continue;

                valid.add(d);
            }
            return valid;
        }

        private Direction getDirectionTowardsHome(int cx, int cy, List<Direction> candidates) {
            Direction best = Direction.NONE;
            double minDist = Double.MAX_VALUE;

            for (Direction d : candidates) {
                int nx = cx + d.getDx();
                int ny = cy + d.getDy();

                // Find closest owned cell
                double dist = getDistanceToNearestOwnedCell(nx, ny);
                if (dist < minDist) {
                    minDist = dist;
                    best = d;
                }
            }
            return best;
        }

        private double getDistanceToNearestOwnedCell(int startX, int startY) {
            int pId = aiPlayer.getId();
            if (gridManager.getOwner(startX, startY) == pId) return 0.0;

            double minSq = Double.MAX_VALUE;
            // Search in expanding radius for nearest owned cell
            for (int r = 1; r <= 15; r++) {
                for (int dx = -r; dx <= r; dx++) {
                    for (int dy = -r; dy <= r; dy++) {
                        int tx = startX + dx;
                        int ty = startY + dy;
                        if (gridManager.isValidCell(tx, ty) && gridManager.getOwner(tx, ty) == pId) {
                            double distSq = dx * dx + dy * dy;
                            if (distSq < minSq) minSq = distSq;
                        }
                    }
                }
                if (minSq < Double.MAX_VALUE) break;
            }
            return minSq;
        }

        private boolean isRivalThreatNearby(int x, int y) {
            for (Player other : allPlayers) {
                if (other.getId() != aiPlayer.getId() && other.isAlive()) {
                    int dist = Math.abs(other.getX() - x) + Math.abs(other.getY() - y);
                    if (dist < 6) return true;
                }
            }
            return false;
        }
    }
}
