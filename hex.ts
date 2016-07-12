
/**
 * Basic collections for Hexes: a HexArray and a HexMap, each a HexCollection of something that 
 * extends Tile. (Later: import Tile.)
 * The coordinates of a Hex are (q, r), which canonically run east and southeast on a hex grid
 * with straight sides running north-south.
 * 
 */

export class Hex {
    public static Units: Hex[] = [
        new Hex(1, 0), // E
        new Hex(0, 1), // SE
        new Hex(-1, 1), // SW
        new Hex(-1, 0), // W
        new Hex(-0, -1), // NW
        new Hex(1, -1), // NE
    ];

    public static add(first: Hex, second: Hex) {
        return new Hex(first.q + second.q, first.r + second.r);
    }

    constructor(public q: number, public r: number) {}

    /** The third, redundant axial hex coordinate. q + r + s = 0. */
    get s(): number {
        return -1 * this.q - this.r;
    }

    public add(other: Hex): Hex {
        return new Hex(this.q + other.q, this.r + other.r);
    }

    public neighbors(i?: number): Hex | Hex[] {
        if (i === undefined) {
            return Hex.Units.map(unit => this.add(unit));
        } else {
            return this.add(Hex.Units[i]);
        }
    }

    /** Custom .toString to use as object key. parseInt first? */
    public toString(): string {
        return `(${this.q}, ${this.r})`;
    }
}

/** Enumerated direction names.
 *  Dir => unit vector: Hex.Units[Dir.E]
 *  string => Dir: Dir["E"]
 *  string => unit vector: Hex.Units[Dir["E"]]
 *  Dir => string: Dir[Dir.E] (typescript enum value => name style.)
 * 
 *  (Note: TS doesn't let enum values be objects, nor does it allow enums as member/static class variables.
 *   Meaning, this is a workaround. It's marginally less verbose than a dict because it gives two-way mapping.)  
 * 
 */
export enum Dir {
    E = 0,
    SE = 1,
    SW = 2,
    W = 3,
    NW = 4,
    NE = 5
}

/**
 * Could do:
 *     type DirType = Dir | number | "E" | "SE" | "SW" | "W" | "NW" | "NE"
 * to be more descriptive in other signatures.
 */

/** Base class for Tile objects that store information in a hexMap. */
export class Tile {}

/** Common interface for array/hashmap implementations of a hex map. */
interface IHexCollection<T extends Tile> {
    // should be T | undefined but vsc complains about Array<T | undefined>. tsc doesn't though??
    // (on TS 2.0 with --strictNullChecks you can't take a T to undefined, right?)
    get(h: Hex): T;
    get(h: Hex[]): T[];
    set(h: Hex, t: T): void;
    /** Could chance to 'n?: DirType' if we use that. */
    neighbors(h: Hex): T[];
    neighbors(h: Hex, only: number): T;
}

export class HexArray<T extends Tile> implements IHexCollection<T> {
    public qMax: number;
    public rMax: number;
    private grid: Array<Array<T>>;

    constructor(qMax: number, rMax: number, fill?: T) {
        this.qMax = qMax;
        this.rMax = rMax;
        if (fill === undefined) {
            this.grid = new Array<T>(qMax).map(() => new Array<T>(rMax));
        } else {
            this.grid = new Array<T>(qMax).map(
                () => new Array<T>(rMax).map(
                    () => fill
                )
            );
        }
    }

    /** Get the tile at hex h, or get the tiles at Hex[] h.
     *  (Two signatures are inferred from the IHexMap interface)
     *  Out-of-bounds coordinates return undefined.
     */
    public get(h) {
        if (h instanceof Hex) {
            return this.grid[h.q][h.r];
        } else {
            return h.map((each) => {
                /** Need to check here so we don't try to do 'undefined[each.r]' */
                if (0 <= each.q && each.q < this.qMax) {
                    return this.grid[each.q][each.r];
                } else {
                    return undefined;
                }
            });
        }
    }

    public set(h, t) {
        this.grid[h.q][h.r] = t;
    }

    public neighbors(h, only?) {
        if (only === undefined) {
            return this.get(
                // type hint: neighbors() is a Hex[] with no argument.
                <Hex[]> h.neighbors()
            );
        } else {
            return this.get( <Hex> h.neighbors(only));
        }
    }

}

/** Hashmap-style {hex: tile} store. Relies on Hex's toString() for (q, r) <=> key bijection. */
export class HexMap<T extends Tile> implements IHexCollection<T> {
    private store: {[index: string]: Tile};

    constructor() {
        this.store = {};
    }

    public get(h) {
        if (h instanceof Hex) {
            return this.store[h];
        } else {
            return h.map((each) => {
                return this.store[h];
            });
        }
    }

    public set(h, t) {
        this.store[h] = t;
    }

    public neighbors(h, only?) {
        if (only === undefined) {
            return this.get(
                // type hint: neighbors() is a Hex[] with no argument.
                <Hex[]> h.neighbors()
            );
        } else {
            return this.get( <Hex> h.neighbors(only));
        }
    }
}

/**
 * For HexBoard, which combines a HexCollection with a spatial coordinate system:
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
    constructor(public x: number, public y: number) { }

    public add(other: Point): Point {
        return new Point(this.x + other.x, this.y + other.y);
    }
}

/** Object that provides an x-y coordinate system for a HexCollection */
export class HexBoard<T extends Tile> {

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

    public hexes: IHexCollection<T>;
    public hexWidth: number;
    public hexHeight: number;
    public rowSeparation: number;
    public vertexVectors: Point[];

    constructor(hexCollection: IHexCollection<T>, hexWidth: number) {
        this.hexes = hexCollection;
        this.hexWidth = hexWidth;
        this.hexHeight = (2 * IROOT3) * hexWidth;
        this.rowSeparation = (ROOT3 / 2) * hexWidth;

        /** Store the 6 vectors from center -> vertices. */
        const a = this.hexWidth / 2; // half width
        const b = this.hexHeight / 4; // quarter height = half side length.
        this.vertexVectors = [
            new Point(a, -b),
            new Point(a, b),
            new Point(0, 2 * b),
            new Point(-a, b),
            new Point(-a, -b),
            new Point(0, -2 * b),
        ];
    }

    /** Get the Point at the center of a Hex. (q, r) => (x, y). */
    public center(h: Hex): Point {
        return new Point(
            h.q * this.hexWidth,
            h.r * this.rowSeparation
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
        return HexBoard.roundHex(new Hex(qFrac, rFrac));
    }

    public vertices(h: Hex): Point[] {
        const p = this.center(h);
        return this.vertexVectors.map( (v) => p.add(v) );
    }
}
