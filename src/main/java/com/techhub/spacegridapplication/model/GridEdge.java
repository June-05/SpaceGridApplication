package com.techhub.spacegridapplication.model;

import com.techhub.spacegridapplication.exception.ValidationException;

import java.util.ArrayList;
import java.util.List;

/**
 * Value object: one line between spots, always stored in a standard form so each line has one name:
 *   HORIZONTAL (row, col) = the line ABOVE spot (row, col)   (row == rows means the bottom border)
 *   VERTICAL   (row, col) = the line LEFT OF spot (row, col)  (col == cols means the right border)
 */
public record GridEdge(int row, int col, Orientation orientation) {

    public GridEdge {
        if (row < 0 || col < 0) {
            throw new ValidationException("Row and column can't be negative.");
        }
        if (orientation == null) {
            throw new ValidationException("Orientation is required.");
        }
    }

    /** Converts "side of a spot" to the standard form, e.g. RIGHT of (0,0) -> VERTICAL (0,1). */
    public static GridEdge of(GridPosition position, Side side) {
        return switch (side) {
            case TOP -> new GridEdge(position.row(), position.col(), Orientation.HORIZONTAL);
            case BOTTOM -> new GridEdge(position.row() + 1, position.col(), Orientation.HORIZONTAL);
            case LEFT -> new GridEdge(position.row(), position.col(), Orientation.VERTICAL);
            case RIGHT -> new GridEdge(position.row(), position.col() + 1, Orientation.VERTICAL);
        };
    }

    /** True if this line belongs to a grid of the given size (borders included). */
    public boolean isWithin(int rows, int cols) {
        return orientation == Orientation.HORIZONTAL
                ? row <= rows && col < cols
                : row < rows && col <= cols;
    }

    /** The 1-2 spots on either side of this line (border lines have only one). */
    public List<GridPosition> adjacentPositions() {
        List<GridPosition> result = new ArrayList<>(2);
        if (orientation == Orientation.HORIZONTAL) {
            if (row > 0) {
                result.add(new GridPosition(row - 1, col));   // spot above the line
            }
            result.add(new GridPosition(row, col));           // spot below the line (may be outside the grid)
        } else {
            if (col > 0) {
                result.add(new GridPosition(row, col - 1));   // spot left of the line
            }
            result.add(new GridPosition(row, col));           // spot right of the line (may be outside the grid)
        }
        return result;
    }
}
