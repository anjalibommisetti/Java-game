package com.paperio.engine;

import com.paperio.model.Player;

import java.awt.Point;
import java.util.ArrayDeque;
import java.util.List;
import java.util.Queue;

public class TrailCaptureEngine {
    private final TerritoryGridManager gridManager;

    public TrailCaptureEngine(TerritoryGridManager gridManager) {
        this.gridManager = gridManager;
    }

    /**
     * Executes enclosure capture for the player upon returning safely to their territory.
     * @return Number of newly claimed cells in this capture event.
     */
    public int performCapture(Player player) {
        gridManager.getLock().lock();
        try {
            int width = gridManager.getWidth();
            int height = gridManager.getHeight();
            int pId = player.getId();

            int initialClaimed = countOwnedCells(pId);

            // Step 1: Convert all trail points to player's territory & clear trail grid
            List<Point> trail = player.getTrail();
            for (Point pt : trail) {
                gridManager.setOwner(pt.x, pt.y, pId);
                gridManager.setTrailOwner(pt.x, pt.y, 0);
            }

            // Step 2: Flood-fill from grid boundary to mark all cells reachable from outside
            boolean[][] visited = new boolean[width][height];
            Queue<Point> queue = new ArrayDeque<>();

            // Seed queue with all perimeter cells not owned by pId
            for (int x = 0; x < width; x++) {
                addSeed(x, 0, pId, visited, queue);
                addSeed(x, height - 1, pId, visited, queue);
            }
            for (int y = 0; y < height; y++) {
                addSeed(0, y, pId, visited, queue);
                addSeed(width - 1, y, pId, visited, queue);
            }

            // BFS expansion
            int[] dx = {0, 0, 1, -1};
            int[] dy = {1, -1, 0, 0};

            while (!queue.isEmpty()) {
                Point current = queue.poll();
                for (int i = 0; i < 4; i++) {
                    int nx = current.x + dx[i];
                    int ny = current.y + dy[i];

                    if (gridManager.isValidCell(nx, ny) && !visited[nx][ny] && gridManager.getOwner(nx, ny) != pId) {
                        visited[nx][ny] = true;
                        queue.add(new Point(nx, ny));
                    }
                }
            }

            // Step 3: Any cell NOT visited and NOT owned by pId is enclosed -> Claim it!
            for (int x = 0; x < width; x++) {
                for (int y = 0; y < height; y++) {
                    if (!visited[x][y] && gridManager.getOwner(x, y) != pId) {
                        gridManager.setOwner(x, y, pId);
                    }
                }
            }

            // Step 4: Clear trail list and update state
            player.clearTrail();
            player.setOutside(false);

            int finalClaimed = countOwnedCells(pId);
            return finalClaimed - initialClaimed;
        } finally {
            gridManager.getLock().unlock();
        }
    }

    private void addSeed(int x, int y, int pId, boolean[][] visited, Queue<Point> queue) {
        if (!visited[x][y] && gridManager.getOwner(x, y) != pId) {
            visited[x][y] = true;
            queue.add(new Point(x, y));
        }
    }

    private int countOwnedCells(int pId) {
        int count = 0;
        for (int x = 0; x < gridManager.getWidth(); x++) {
            for (int y = 0; y < gridManager.getHeight(); y++) {
                if (gridManager.getOwner(x, y) == pId) {
                    count++;
                }
            }
        }
        return count;
    }
}
