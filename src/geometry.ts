import {Hex} from "./hex";

/** The geometric constructions in this module create a planar x-y coordinate system for a 
 * plane of hexes, parametrized only by a value hexWidth.
 * A number of other values are calculated from hexWidth and are shown below.
 * The hex with (q, r) = (0, 0) has its center at (x, y) = (0, 0).
 * 
 *        hexWidth
 *   >---------------<     v
 *        _.-'-._          | = hexHeight = (2/sqrt(3)) * hexWidth
 * -._.-'         '-._.-'  |  v
 *   |               |     |  | = side length = hexHeight / 2 = (1/sqrt(3)) * hexWidth
 *   |               |  v  |  |
 *   |       *       |  |  |  |
 *   |               |  |  |  | v
 * .-'-._         _.-'- |  |  ^ | between vert sides = hexHeight / 4 = (1/ 2sqrt(3)) * hexWidth
 *        '-._.-'       |  |    |
 *           |          |  ^    ^
 *           |          | = rowSeparation = 3/4 * hexHeight = sqrt(3)/2 * hexWidth
 *   *       |       *  ^
 *           |
 *        _.-'-._
 * -._.-'         '-._.-'
 *   |               |
 */

const ROOT3 = 1.73205;  // sqrt(3)
const IROOT3 = 0.577350; // 1/(sqrt(3))

class Point {
    public static toRect(xy: Point, wh: Point) {
        return new Rectangle(xy.x, xy.y, wh.x, wh.y);
    }

    constructor(public x: number, public y: number) { }

    public add(other: Point): Point {
        return new Point(this.x + other.x, this.y + other.y);
    }
}

class Rectangle {
    constructor(public x: number, public y: number, public w: number, public h: number) {}

    /** Produce a new rectangle displaced by p. */
    public offset(p: Point): Rectangle {
        return new Rectangle(this.x + p.x, this.y + p.y, this.w, this.h);
    }
}

/** Provides an x-y coordinate system for a board of hexagons */
export class HexPlane {

    /** Rounds a "decimal" hex coordinate to an integer one.
     * Implementation from Amit's Hex guide, which converts to cubic coordinates
     * and then projects onto the valid-hex plane.
     * (Fixes rq+rr+rs = 0 by adjusting the one that changed the most.)
     */
    private static roundHex(h: Hex): Hex {
        let rq = Math.round(h.q);
        let rr = Math.round(h.r);
        let rs = Math.round(h.s);

        const dq = Math.abs(rq - h.q);
        const dr = Math.abs(rr - h.q);
        const ds = Math.abs(rs - h.s);

        if (dq > dr && dq > ds) {
            rq = -rr - rs;
        } else if (dr > ds) {
            rr = -rq - rs;
        } else {
            rs = -rq - rr;
        }
        console.assert(rq + rr + rs === 0);
        return new Hex(rq, rr);
    }

    /** Used internally to produce the vertices of a hexagon at the origin, CW from northeast. (+x -y) */
    private static getVertexVectors(hexWidth: number): Point[] {
        const a = hexWidth / 2; // half width
        const b = (IROOT3 / 2) * hexWidth; // quarter height = half side length.
        return [
            new Point(a, -b), // NE
            new Point(a, b), // SE
            new Point(0, 2 * b), // S
            new Point(-a, b), // SW
            new Point(-a, -b), // NW
            new Point(0, -2 * b), // N
        ];
    }
    /** [Point(x, y), Point(w, h) for a Hex of size hexWidth at the origin.] */
    private static getBoundingBox(hexWidth: number): Rectangle {
        const a = hexWidth / 2; // half width
        const b = IROOT3 * hexWidth; // half height = side length.
        return new Rectangle(-a, -b, hexWidth, 2 * b);
    }

    /** Some helpful quantities computed on construction - see ascii diagram. */
    private hexWidth: number; // face-to-face diameter of a hexagon.
    private hexHeight: number; // vertex-to-vertex diameter of a hexagon.
    private rowSeparation: number; // center-to-center y-distance between two rows.
    private vertexVectors: Point[]; // 6 vectors giving relative position of vertices w/ origin at center.
    private bBox: Rectangle; // [upper left, width x height].

    constructor(hexWidth: number) {
        this.hexWidth = hexWidth;
        this.hexHeight = (2 * IROOT3) * hexWidth;
        this.rowSeparation = (ROOT3 / 2) * hexWidth;

        /** Store the 6 vectors from center -> vertices. */
        this.vertexVectors = HexPlane.getVertexVectors(hexWidth);
        this.bBox = HexPlane.getBoundingBox(hexWidth);
    }

    /** Get the Point at the center of a Hex. (q, r) => (x, y). */
    public center(h: Hex): Point {
        return new Point(
            (h.q + h.r / 2) * this.hexWidth,
            h.r * this.rowSeparation
        );
    }
    /** Find a rectangle completely containing a given hex. */
    public boundingBox(h: Hex): Rectangle {
        return this.bBox.offset(this.center(h));
    }
    /**
     * Find the Hex containing a given point.
     * Converts (q, r) to a decimal value by inverting the matrix in center: Hex => Point,
     *  then uses roundHex().
     */
    public hex(p: Point): Hex {
        const y = p.y - this.hexWidth * IROOT3;
        const a = IROOT3 / this.hexWidth;
        const qFrac = a * (ROOT3 * p.x - y);
        const rFrac = a * (2 * y);
        return HexPlane.roundHex(new Hex(qFrac, rFrac));
    }
    /** Find the 6 vertices of a given hex. */
    public vertices(h: Hex): Point[] {
        const p = this.center(h);
        return this.vertexVectors.map( (v) => p.add(v) );
    }

    /** Get a list containing all hexes that intersect the given rectangle.
     * 
     * Note: the current implementation can include a few hexes outside the rectangle:
     * often extra rows on the bottom and top.
     * Hopefully this is close enough - there a lot of corner cases.
     * TODO: make this return some kind of generator.
     * TODO: make this way better, because it's probably slow and grabs too many hexes.
     * TODO: figure out how to not constantly be recalculating this.
     */
    public getVisible(r: Rectangle): Hex[] {
        /** Step one: 
         * We imagine dividing the plane into a grid of small rectangles (i, j),
         * each with their top edge on the line connecting the NE-NW vertices of a hex,
         * their bottom edge at the S vertex of a hex, and their edges along the center of a hex or the edge. 
         * So there are 2 rects per hex, and they each overlap a neighboring hex on the next row.
         * 
         * We do this so that the expression for "slice" of the plane can be written easily in terms of 
         * variables that increase in the same direction as the sides of a rectangle: right and down, rather
         * than right and down-right like q & r. 
         *
         * Doing the geometry, we get (w = hexWidth, h = hexHeight = (2/sqrt(3)) * w):
         *  i = floor( 2 * x / w)
         *  j = floor( (y + h/4) / (3h / 4) ) = (2y / (sqrt(3) w) + 1/3 )
         * To create a range/2d slice, we want to find (i, j) for the top left and bottom right corners
         * of the rectangle.
         */

        const lowerRight = new Point(r.x + r.w, r.y + r.h);

        let iMin = Math.floor( 2 * r.x / this.hexWidth );
        let jMin = Math.floor( (1 / 3) + (2 * r.y * IROOT3) / this.hexWidth );

        let iMax = Math.floor( 2 * lowerRight.x / this.hexWidth );
        let jMax = Math.floor( (1 / 3) + (2 * lowerRight.y * IROOT3) / this.hexWidth );

        /** Step two:
         * We're going to be iterating over every other value of i, since there are two per hex.
         * But there are three cases where this causes us to miss a hex that we want:
         *  1) if only one rectangle of the two in the last hex of a row is included, and we'd skip over it.
         *     Which happens if we started on the R side of a hex, and the last rect is the L side of it's hex.
         *  2) If we started on the L side of a hex and the last rect is on the R side of its hex, we'll miss
         *     a hex beneath that last one - the odd rows should include an extra hex.
         *  3) If the bottom of the big rectangle we're testing overlaps the tips of a row of hexes.
         * 
         * The easy fix is just to increase our range in i to an even number, and to bump the j range by 1.
         * 
         * Note we're storing (i, j) as (x, y) of these points. Awkward!
         */

        iMax = (iMax - iMin % 2 === 0) ? iMax : iMax + 1; // corrects 1) and 2)
        jMax = jMax + 1; // corrects 3)

        /** Step 3:
         * Iterate over these ranges, even values of i only, converting back to (q, r) and creating a list of hexes.
         * The conversion is:
         *  q = ceiling( (i - j) / 2 ),
         *  r = j
         * Since increasing i by 2 increases q by one, as does increasing j by 2, but increasing j by 1 
         * only sets q back if exactly one of i and j are odd (so it's a down-left step, rather than down-right.) 
         */

        let hexes: Hex[] = [];
        for (let i = iMin; i <= iMax; i += 2) {
            for (let j = jMin; j <= jMax; j++ ) {
                hexes.push( new Hex(
                    Math.ceil( ( i - j ) / 2 ),
                    j
                ) );
            }
        }

        return hexes;
    }

}
