
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

/** Could do:
 *      type DirType = Dir | number | "E" | "SE" | "SW" | "W" | "NW" | "NE"
 *  to be more descriptive in other signatures.
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

export class HexGrid<T extends Tile> extends HexCollection<T> {
    public qMax: number;
    public rMax: number;
    private grid: Array<Array<T>>;

    constructor(qMax: number, rMax: number) {
        super();
        this.qMax = qMax;
        this.rMax = rMax;
        this.grid = new Array<T>(qMax).map(() => new Array<T>(rMax));
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

