package com.techhub.spacegridapplication.model;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

/** Grid rules of Property. No database needed: create the objects in memory and check their behavior. */
@Disabled("Write these tests after the model classes are implemented")
class PropertyTest {

    @Test
    void assignSpot_takesSpotFromOtherZone() {
        // TODO: assign (0,0) to Unit 101, then to Unit 102 → only Unit 102 has it
    }

    @Test
    void assignSpot_outsideGrid_isRejected() {
        // TODO: row 9 on a 4-row grid → ValidationException
    }

    @Test
    void resizeGrid_removesSpotsOutside() {
        // TODO: 4×6 → 3×5 removes spots and edge overrides outside
    }

    @Test
    void resizeGrid_over30_isRejected() {
        // TODO: resizeGrid(31, 5) → ValidationException
    }

    @Test
    void autoWall_betweenUnitAndHallway() {
        // TODO: unit next to a walkway → automatic WALL
    }

    @Test
    void noAutoWall_betweenGrassAndWalkway() {
        // TODO: two outdoor areas → no wall
    }

    @Test
    void doorOverride_replacesAutoWall() {
        // TODO: setEdge(DOOR) wins; resetEdge() brings the wall back
    }

    @Test
    void archiveUnit_clearsItsSpots() {
        // TODO: archived unit has no spots left
    }
}
