package com.paperio.engine;

import com.paperio.model.Player;

import java.util.ArrayList;
import java.util.List;

public class CollisionEngine {
    private final TerritoryGridManager gridManager;

    public interface CollisionEventListener {
        void onPlayerEliminated(Player victim, Player killer, String reason);
    }

    private final List<CollisionEventListener> listeners = new ArrayList<>();

    public CollisionEngine(TerritoryGridManager gridManager) {
        this.gridManager = gridManager;
    }

    public void addListener(CollisionEventListener listener) {
        listeners.add(listener);
    }

    /**
     * Checks collisions when a player attempts to move to (nx, ny).
     * @return true if player survived the move, false if player died.
     */
    public boolean checkAndHandleCollisions(Player movingPlayer, int nx, int ny, List<Player> allPlayers) {
        gridManager.getLock().lock();
        try {
            // 1. Boundary Wall Collision
            if (!gridManager.isValidCell(nx, ny)) {
                eliminatePlayer(movingPlayer, null, movingPlayer.getName() + " crashed into the map boundary!");
                return false;
            }

            // 2. Trail Collision Check
            int trailOwnerId = gridManager.getTrailOwner(nx, ny);
            if (trailOwnerId > 0) {
                Player trailOwner = getPlayerById(allPlayers, trailOwnerId);
                if (trailOwner != null && trailOwner.isAlive()) {
                    if (trailOwner.getId() == movingPlayer.getId()) {
                        // Self-collision (Ran into own trail)
                        eliminatePlayer(movingPlayer, null, movingPlayer.getName() + " ran into their own trail!");
                        return false;
                    } else {
                        // Opponent trail collision (Rival cut trail)
                        movingPlayer.incrementKillCount();
                        eliminatePlayer(trailOwner, movingPlayer, trailOwner.getName() + "'s trail was cut by " + movingPlayer.getName() + "!");
                    }
                }
            }

            // 3. Head-to-Head Position Collision Check
            for (Player other : allPlayers) {
                if (other.getId() != movingPlayer.getId() && other.isAlive()) {
                    if (other.getX() == nx && other.getY() == ny) {
                        // Both outside home: double elimination or head-on collision
                        if (movingPlayer.isOutside() && other.isOutside()) {
                            eliminatePlayer(other, movingPlayer, "Head-to-head collision between " + movingPlayer.getName() + " & " + other.getName());
                            eliminatePlayer(movingPlayer, other, "Head-to-head collision between " + movingPlayer.getName() + " & " + other.getName());
                            return false;
                        }
                    }
                }
            }

            return true;
        } finally {
            gridManager.getLock().unlock();
        }
    }

    public void eliminatePlayer(Player victim, Player killer, String reason) {
        gridManager.getLock().lock();
        try {
            if (!victim.isAlive()) return;
            victim.setAlive(false);
            gridManager.clearPlayerTerritoryAndTrail(victim);

            for (CollisionEventListener l : listeners) {
                l.onPlayerEliminated(victim, killer, reason);
            }
        } finally {
            gridManager.getLock().unlock();
        }
    }

    private Player getPlayerById(List<Player> players, int id) {
        for (Player p : players) {
            if (p.getId() == id) return p;
        }
        return null;
    }
}
