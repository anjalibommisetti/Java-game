package com.paperio.engine;

import com.paperio.model.Direction;
import com.paperio.model.Player;

import java.awt.Point;
import java.util.List;
import java.util.concurrent.locks.ReentrantLock;

public class TerritoryGridManager {
    private final int width;
    private final int height;
    private final int[][] grid;       // Territory ownership: 0 = Unclaimed, Player ID = Claimed
    private final int[][] trailGrid;  // Active trail ownership: 0 = None, Player ID = Trail
    private final ReentrantLock lock = new ReentrantLock();

    public TerritoryGridManager(int width, int height) {
        this.width = width;
        this.height = height;
        this.grid = new int[width][height];
        this.trailGrid = new int[width][height];
    }

    public int getWidth() { return width; }
    public int getHeight() { return height; }

    public ReentrantLock getLock() { return lock; }

    public void resetGrid() {
        lock.lock();
        try {
            for (int x = 0; x < width; x++) {
                for (int y = 0; y < height; y++) {
                    grid[x][y] = 0;
                    trailGrid[x][y] = 0;
                }
            }
        } finally {
            lock.unlock();
        }
    }

    public void spawnPlayer(Player player, int startX, int startY, int radius) {
        lock.lock();
        try {
            player.setPosition(startX, startY);
            player.setCurrentDirection(Direction.NONE);
            player.setNextDirection(Direction.NONE);
            player.setOutside(false);
            player.setAlive(true);
            player.clearTrail();

            for (int dx = -radius; dx <= radius; dx++) {
                for (int dy = -radius; dy <= radius; dy++) {
                    int tx = startX + dx;
                    int ty = startY + dy;
                    if (isValidCell(tx, ty)) {
                        grid[tx][ty] = player.getId();
                    }
                }
            }
        } finally {
            lock.unlock();
        }
    }

    public boolean isValidCell(int x, int y) {
        return x >= 0 && x < width && y >= 0 && y < height;
    }

    public int getOwner(int x, int y) {
        if (!isValidCell(x, y)) return -1;
        return grid[x][y];
    }

    public void setOwner(int x, int y, int ownerId) {
        if (isValidCell(x, y)) {
            grid[x][y] = ownerId;
        }
    }

    public int getTrailOwner(int x, int y) {
        if (!isValidCell(x, y)) return -1;
        return trailGrid[x][y];
    }

    public void setTrailOwner(int x, int y, int trailOwnerId) {
        if (isValidCell(x, y)) {
            trailGrid[x][y] = trailOwnerId;
        }
    }

    public void clearPlayerTerritoryAndTrail(Player player) {
        lock.lock();
        try {
            int pId = player.getId();
            for (int x = 0; x < width; x++) {
                for (int y = 0; y < height; y++) {
                    if (grid[x][y] == pId) {
                        grid[x][y] = 0;
                    }
                    if (trailGrid[x][y] == pId) {
                        trailGrid[x][y] = 0;
                    }
                }
            }
            player.clearTrail();
            player.setClaimedCount(0);
            player.setTerritoryPercentage(0.0);
        } finally {
            lock.unlock();
        }
    }

    public void updateTerritoryStats(List<Player> players) {
        lock.lock();
        try {
            int totalCells = width * height;
            int[] counts = new int[players.size() + 10]; // player IDs

            for (int x = 0; x < width; x++) {
                for (int y = 0; y < height; y++) {
                    int owner = grid[x][y];
                    if (owner > 0 && owner < counts.length) {
                        counts[owner]++;
                    }
                }
            }

            for (Player p : players) {
                int count = (p.getId() < counts.length) ? counts[p.getId()] : 0;
                p.setClaimedCount(count);
                double pct = (double) count / totalCells * 100.0;
                p.setTerritoryPercentage(Math.round(pct * 100.0) / 100.0);
            }
        } finally {
            lock.unlock();
        }
    }

    public int[][] getGridCopy() {
        lock.lock();
        try {
            int[][] copy = new int[width][height];
            for (int x = 0; x < width; x++) {
                System.arraycopy(grid[x], 0, copy[x], 0, height);
            }
            return copy;
        } finally {
            lock.unlock();
        }
    }
}
