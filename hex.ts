
/**
 * Basic collections for Hexes: a HexArray and a HexMap, each a HexCollection of something that 
 * extends Tile. (Later: import Tile.)
 * The coordinates of a Hex are (q, r), which canonically run east and southeast on a hex grid
 * with straight sides running north-south.
 * For HexBoard, which combines a HexCollection with a spatial coordinate system:
 *     hexSize is the width between vertical edges.
 *     hexHeight is the distance between vertices.
 *            
 *         .-'-.          ^ hexHeight = (2/sqrt(3)) * hexSize
 *    _--'       '--_     |
 *   |               |    | ^ size length = hexHeight / 2 = (1/sqrt(3)) * hexSize
 *   |<------------->|    | |
 *   |    hexSize    | ^  | |
 *   |               | |  | v
 *   '-.           .-' |  |   ^ = hexHeight / 4 = (1/ 2sqrt(3)) * hexSize
 *       '--_ _--'     |  v   v
 *           |         |
 *           |         v center vertical separation = 1.5 * hexHeight = (sqrt(3)/4) * hexSize
 *           |
 *           |
 *         .-'-. 
 *    _--'       '--_
 *   |               |
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

    constructor(public q: number, public r: number) { }

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
abstract class HexCollection<T extends Tile> {
    // should be T | undefined but vsc complains about Array<T | undefined>. tsc doesn't though??
    // (on TS 2.0 with --strictNullChecks you can't take a T to undefined, right?)
    public abstract get(h: Hex): T;
    public abstract get(h: Hex[]): T[];
    public abstract set(h: Hex, t: T): void;
    /** Could chance to 'n?: DirType' if we use that. */
    public neighbors(h: Hex, only?: number): T | T[] {
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

export class HexArray<T extends Tile> extends HexCollection<T> {
    public qMax: number;
    public rMax: number;
    private grid: Array<Array<T>>;

    constructor(qMax: number, rMax: number, fill?: T) {
        super();
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

}


const ROOT3 = 1.73205;  // sqrt(3)

/** Hashmap-style {hex: tile} store. Relies on Hex's toString() for (q, r) <=> key bijection. */
export class HexMap<T extends Tile> extends HexCollection<T> {
    private store: {[index: string]: Tile};

    constructor() {
        super();
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
}

export class HexBoard<T extends Tile> {
    public collection: HexCollection<T>;
    public hexSize: number;
    public hexHeight: number;

    constructor(hexCollection, hexSize) {
        this.collection = hexCollection;
        this.hexSize = hexSize; // width between flat sides
        this.hexHeight = (1 / ROOT3) * hexSize;
    }
}

