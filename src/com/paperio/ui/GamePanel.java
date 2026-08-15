package com.paperio.ui;

import com.paperio.engine.TerritoryGridManager;
import com.paperio.model.Direction;
import com.paperio.model.Player;

import javax.swing.*;
import java.awt.*;
import java.awt.geom.RoundRectangle2D;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

public class GamePanel extends JPanel {
    private final TerritoryGridManager gridManager;
    private final List<Player> players;

    private static final int CELL_SIZE = 9; // Grid cell rendering pixel size
    private static final Color COLOR_BG = new Color(17, 22, 37);
    private static final Color COLOR_GRID_LINE = new Color(26, 33, 51);
    private static final Color COLOR_UNCLAIMED = new Color(22, 27, 41);

    private final List<FloatingEffect> floatingEffects = new ArrayList<>();

    public static class FloatingEffect {
        String text;
        int x, y;
        Color color;
        float alpha = 1.0f;
        int offsetY = 0;

        public FloatingEffect(String text, int x, int y, Color color) {
            this.text = text;
            this.x = x;
            this.y = y;
            this.color = color;
        }

        public boolean update() {
            offsetY -= 1;
            alpha -= 0.025f;
            return alpha > 0;
        }
    }

    public GamePanel(TerritoryGridManager gridManager, List<Player> players) {
        this.gridManager = gridManager;
        this.players = players;

        int preferredW = gridManager.getWidth() * CELL_SIZE;
        int preferredH = gridManager.getHeight() * CELL_SIZE;
        setPreferredSize(new Dimension(preferredW, preferredH));
        setBackground(COLOR_BG);
        setDoubleBuffered(true);
    }

    public void addFloatingText(String text, int gridX, int gridY, Color color) {
        synchronized (floatingEffects) {
            floatingEffects.add(new FloatingEffect(text, gridX * CELL_SIZE, gridY * CELL_SIZE, color));
        }
    }

    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        Graphics2D g2 = (Graphics2D) g.create();

        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

        int width = gridManager.getWidth();
        int height = gridManager.getHeight();

        // 1. Draw Unclaimed Background Grid
        g2.setColor(COLOR_UNCLAIMED);
        g2.fillRect(0, 0, width * CELL_SIZE, height * CELL_SIZE);

        // 2. Draw Territory Ownership
        for (int x = 0; x < width; x++) {
            for (int y = 0; y < height; y++) {
                int ownerId = gridManager.getOwner(x, y);
                if (ownerId > 0) {
                    Player p = getPlayerById(ownerId);
                    if (p != null) {
                        g2.setColor(p.getTerritoryColor());
                        g2.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                    }
                }
            }
        }

        // 3. Draw Subtle Grid Lines
        g2.setColor(COLOR_GRID_LINE);
        for (int x = 0; x <= width * CELL_SIZE; x += CELL_SIZE * 5) {
            g2.drawLine(x, 0, x, height * CELL_SIZE);
        }
        for (int y = 0; y <= height * CELL_SIZE; y += CELL_SIZE * 5) {
            g2.drawLine(0, y, width * CELL_SIZE, y);
        }

        // 4. Draw Active Trails
        for (int x = 0; x < width; x++) {
            for (int y = 0; y < height; y++) {
                int trailOwnerId = gridManager.getTrailOwner(x, y);
                if (trailOwnerId > 0) {
                    Player p = getPlayerById(trailOwnerId);
                    if (p != null) {
                        g2.setColor(p.getTrailColor());
                        g2.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
                    }
                }
            }
        }

        // 5. Draw Player Heads & Avatars
        for (Player p : players) {
            if (p.isAlive()) {
                int px = p.getX() * CELL_SIZE;
                int py = p.getY() * CELL_SIZE;

                // Outer Glowing Ring
                g2.setColor(p.getTrailColor());
                g2.fillOval(px - 2, py - 2, CELL_SIZE + 4, CELL_SIZE + 4);

                // Player Head Square
                g2.setColor(p.getFillColor());
                g2.fill(new RoundRectangle2D.Float(px, py, CELL_SIZE, CELL_SIZE, 4, 4));

                // Head border
                g2.setColor(Color.WHITE);
                g2.draw(new RoundRectangle2D.Float(px, py, CELL_SIZE, CELL_SIZE, 4, 4));

                // Direction Indicator
                Direction dir = p.getCurrentDirection();
                if (dir != Direction.NONE) {
                    g2.setColor(Color.BLACK);
                    int cx = px + CELL_SIZE / 2;
                    int cy = py + CELL_SIZE / 2;
                    g2.drawLine(cx, cy, cx + dir.getDx() * 4, cy + dir.getDy() * 4);
                }
            }
        }

        // 6. Draw Floating Effects / Capture Animations
        synchronized (floatingEffects) {
            Iterator<FloatingEffect> it = floatingEffects.iterator();
            while (it.hasNext()) {
                FloatingEffect fe = it.next();
                if (!fe.update()) {
                    it.remove();
                    continue;
                }
                g2.setFont(new Font("SansSerif", Font.BOLD, 13));
                Composite origComp = g2.getComposite();
                g2.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, Math.max(0.0f, fe.alpha)));
                g2.setColor(fe.color);
                g2.drawString(fe.text, fe.x - 10, fe.y + fe.offsetY);
                g2.setComposite(origComp);
            }
        }

        g2.dispose();
    }

    private Player getPlayerById(int id) {
        for (Player p : players) {
            if (p.getId() == id) return p;
        }
        return null;
    }
}
