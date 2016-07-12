import {Hex} from "./hex";

/** For HexPlane, which combines a HexCollection with a spatial coordinate system:
 *     hexWidth is the width between vertical edges.
 *     hexHeight is the distance between vertices.
 * 
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
 *           |          | = center vertical separation = 3/4 * hexHeight = sqrt(3)/2 * hexWidth
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
}

/** Provides an x-y coordinate system for a board of hexagons */
export class HexPlane {

    /**
     * Rounds a "decimal" hex coordinate to an integer one.
     * Implementation from Amit's Hex guide, which converts to cubic coordinates
     * and then projects onto the valid-hex plane.
     * (Fixes rq+rr+rs = 0 by adjusting the one that changed the most.)
     */
    public static roundHex(h: Hex): Hex {
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

    /** Point(x, y)] for the 6 vertices of a hexagon at the origin, CW from northeast. (+x -y) */
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
    private static getBoundingBoxVectors(hexWidth: number): Point[] {
        const a = hexWidth / 2; // half width
        const b = IROOT3 * hexWidth; // half height = side length.
        return [
            new Point(-a,  -b),
            new Point(hexWidth, 2 * b),
        ];
    }

    private hexWidth: number;
    /** Some helpful quantities calculated hexWidth on construction. */
    private hexHeight: number;
    private rowSeparation: number;
    private vertexVectors: Point[];
    private boundingBoxVectors: Point[];

    constructor(hexWidth: number) {
        this.hexWidth = hexWidth;
        this.hexHeight = (2 * IROOT3) * hexWidth;
        this.rowSeparation = (ROOT3 / 2) * hexWidth;

        /** Store the 6 vectors from center -> vertices. */
        this.vertexVectors = HexPlane.getVertexVectors(hexWidth);
        this.boundingBoxVectors = HexPlane.getBoundingBoxVectors(hexWidth);
    }

    /** Get the Point at the center of a Hex. (q, r) => (x, y). */
    public center(h: Hex): Point {
        return new Point(
            (h.q + h.r / 2) * this.hexWidth,
            h.r * this.rowSeparation
        );
    }
    public boundingBox(h: Hex): Rectangle {
        return Point.toRect(
            this.boundingBoxVectors[0],
            this.boundingBoxVectors[1]
        );
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

    public vertices(h: Hex): Point[] {
        const p = this.center(h);
        return this.vertexVectors.map( (v) => p.add(v) );
    }

}
