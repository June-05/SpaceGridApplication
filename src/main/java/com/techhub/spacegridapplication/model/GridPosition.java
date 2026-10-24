package com.techhub.spacegridapplication.model;

import com.techhub.spacegridapplication.exception.ValidationException;

/** Value object: one spot on a property's grid (0-based row and column). */
public record GridPosition(int row, int col) {

    public GridPosition {
        if (row < 0 || col < 0) {
            throw new ValidationException("Row and column can't be negative.");
        }
    }

    /** True if this spot fits inside a grid of the given size. */
    public boolean isWithin(int rows, int cols) {
        return row < rows && col < cols;
    }

    /** The spot next to this one on the given side (may be outside the grid). */
    public GridPosition neighbor(Side side) {
        int r = row, c = col;
        switch (side) {
            case TOP -> r--;
            case BOTTOM -> r++;
            case LEFT -> c--;
            case RIGHT -> c++;
        }
        return (r < 0 || c < 0) ? null : new GridPosition(r, c);
    }

    /** "Row 1, Col 3" (1-based for people). */
    public String toDisplayString() {
        return "Row " + (row + 1) + ", Col " + (col + 1);
    }
}
