package com.paperio.model;

import java.awt.Color;
import java.awt.Point;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Player {
    private final int id;
    private final String name;
    private final boolean isAI;
    private final Color fillColor;
    private final Color territoryColor;
    private final Color trailColor;

    private int x;
    private int y;
    private Direction currentDirection = Direction.NONE;
    private Direction nextDirection = Direction.NONE;

    private final List<Point> trail = Collections.synchronizedList(new ArrayList<>());
    private boolean isOutside = false;
    private boolean isAlive = true;

    private int claimedCount = 0;
    private double territoryPercentage = 0.0;
    private int killCount = 0;

    public Player(int id, String name, boolean isAI, Color fillColor, Color territoryColor, Color trailColor) {
        this.id = id;
        this.name = name;
        this.isAI = isAI;
        this.fillColor = fillColor;
        this.territoryColor = territoryColor;
        this.trailColor = trailColor;
    }

    public int getId() { return id; }
    public String getName() { return name; }
    public boolean isAI() { return isAI; }
    public Color getFillColor() { return fillColor; }
    public Color getTerritoryColor() { return territoryColor; }
    public Color getTrailColor() { return trailColor; }

    public int getX() { return x; }
    public int getY() { return y; }
    public void setPosition(int x, int y) {
        this.x = x;
        this.y = y;
    }

    public Direction getCurrentDirection() { return currentDirection; }
    public void setCurrentDirection(Direction currentDirection) { this.currentDirection = currentDirection; }

    public Direction getNextDirection() { return nextDirection; }
    public void setNextDirection(Direction nextDirection) { this.nextDirection = nextDirection; }

    public List<Point> getTrail() { return trail; }
    public void addTrailPoint(int tx, int ty) {
        trail.add(new Point(tx, ty));
    }
    public void clearTrail() {
        trail.clear();
    }

    public boolean isOutside() { return isOutside; }
    public void setOutside(boolean outside) { isOutside = outside; }

    public boolean isAlive() { return isAlive; }
    public void setAlive(boolean alive) { isAlive = alive; }

    public int getClaimedCount() { return claimedCount; }
    public void setClaimedCount(int claimedCount) { this.claimedCount = claimedCount; }

    public double getTerritoryPercentage() { return territoryPercentage; }
    public void setTerritoryPercentage(double territoryPercentage) { this.territoryPercentage = territoryPercentage; }

    public int getKillCount() { return killCount; }
    public void incrementKillCount() { this.killCount++; }
}
