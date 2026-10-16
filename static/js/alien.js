(function () {
    const svg_ns = "http://www.w3.org/2000/svg";
    const history_key = "arckmed-alien-history-v3";
    const recent_limit = 40;
    const et_family_chance = 0.16;
    const size = 20;

    function make_rng(seed) {
        let state = seed >>> 0;
        return function () {
            state += 0x6d2b79f5;
            let t = state;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function random_seed() {
        if (window.crypto && window.crypto.getRandomValues) {
            const value = new Uint32Array(1);
            window.crypto.getRandomValues(value);
            return value[0];
        }
        return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    }

    function create_grid() {
        return {
            body: new Set(),
            holes: new Set()
        };
    }

    function key(x, y) {
        return x + "," + y;
    }

    function put(set, x, y) {
        x = Math.round(x);
        y = Math.round(y);
        if (x < 0 || y < 0 || x >= size || y >= size) return;
        set.add(key(x, y));
    }

    function del(set, x, y) {
        set.delete(key(Math.round(x), Math.round(y)));
    }

    function rect(set, x, y, w, h) {
        for (let yy = y; yy < y + h; ++yy) {
            for (let xx = x; xx < x + w; ++xx) put(set, xx, yy);
        }
    }

    function line(set, x0, y0, x1, y1) {
        x0 = Math.round(x0);
        y0 = Math.round(y0);
        x1 = Math.round(x1);
        y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0);
        const sx = x0 < x1 ? 1 : -1;
        const dy = -Math.abs(y1 - y0);
        const sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
            put(set, x0, y0);
            if (x0 === x1 && y0 === y1) break;
            const e2 = err * 2;
            if (e2 >= dy) {
                err += dy;
                x0 += sx;
            }
            if (e2 <= dx) {
                err += dx;
                y0 += sy;
            }
        }
    }

    function choose(rng, values) {
        return values[Math.floor(rng() * values.length)];
    }

    function chance(rng, p) {
        return rng() < p;
    }

    function int(rng, min, max) {
        return min + Math.floor(rng() * (max - min + 1));
    }

    function centered_row(set, y, width, cx) {
        rect(set, Math.round(cx - width / 2), y, width, 1);
    }

    function cut(grid, x, y, w, h) {
        for (let yy = y; yy < y + h; ++yy) {
            for (let xx = x; xx < x + w; ++xx) {
                del(grid.body, xx, yy);
                put(grid.holes, xx, yy);
            }
        }
    }

    function head_round(grid, rng, top, width, height, cx) {
        for (let row = 0; row < height; ++row) {
            const edge = Math.min(row, height - 1 - row);
            const taper = edge === 0 ? 2 : edge === 1 ? 1 : 0;
            centered_row(grid.body, top + row, Math.max(3, width - taper * 2), cx);
        }
    }

    function head_square(grid, rng, top, width, height, cx) {
        rect(grid.body, Math.round(cx - width / 2), top, width, height);
        if (chance(rng, 0.6)) {
            del(grid.body, Math.round(cx - width / 2), top);
            del(grid.body, Math.round(cx + width / 2 - 1), top);
        }
    }

    function head_triangle(grid, rng, top, width, height, cx) {
        for (let row = 0; row < height; ++row) {
            const w = Math.max(2, Math.round(2 + (width - 2) * (row / Math.max(1, height - 1))));
            centered_row(grid.body, top + row, w, cx);
        }
    }

    function head_mushroom(grid, rng, top, width, height, cx) {
        centered_row(grid.body, top, Math.max(4, width - 4), cx);
        centered_row(grid.body, top + 1, Math.max(6, width - 2), cx);
        centered_row(grid.body, top + 2, width, cx);
        centered_row(grid.body, top + 3, width, cx);
        centered_row(grid.body, top + 4, Math.max(4, width - 4), cx);
        for (let row = 5; row < height; ++row) centered_row(grid.body, top + row, Math.max(3, width - 6), cx);
    }

    function add_eyes(grid, rng, top, width, count, cx, style) {
        const y = top + int(rng, 2, 3);
        if (count === 0) return;
        if (count === 1) {
            cut(grid, Math.round(cx), y, style === "large" ? 2 : 1, 1);
            return;
        }
        if (count === 2) {
            const gap = Math.max(2, Math.floor(width / 4));
            const eye_w = style === "large" && width >= 8 ? 2 : 1;
            cut(grid, Math.round(cx - gap), y, eye_w, 1);
            cut(grid, Math.round(cx + gap - (eye_w - 1)), y, eye_w, 1);
            return;
        }
        const start = Math.round(cx - (count - 1));
        for (let i = 0; i < count; ++i) cut(grid, start + i * 2, y, 1, 1);
    }

    function add_horns(grid, rng, head_top, head_width, cx, long_horns) {
        const half = Math.floor(head_width / 2);
        const lx = Math.round(cx - half + 1);
        const rx = Math.round(cx + half - 1);
        const height = long_horns ? int(rng, 3, 4) : int(rng, 1, 2);
        for (let i = 0; i < height; ++i) {
            put(grid.body, lx - Math.min(i, 2), head_top - 1 - i);
            put(grid.body, rx + Math.min(i, 2), head_top - 1 - i);
        }
        if (chance(rng, 0.45)) {
            put(grid.body, lx - Math.min(height, 2) - 1, head_top - height);
            put(grid.body, rx + Math.min(height, 2) + 1, head_top - height);
        }
    }

    function add_antennae(grid, rng, head_top, head_width, cx) {
        const half = Math.floor(head_width / 3);
        const lx = Math.round(cx - half);
        const rx = Math.round(cx + half);
        line(grid.body, lx, head_top, lx - int(rng, 1, 2), Math.max(0, head_top - int(rng, 2, 4)));
        line(grid.body, rx, head_top, rx + int(rng, 1, 2), Math.max(0, head_top - int(rng, 2, 4)));
        put(grid.body, lx - 1, Math.max(0, head_top - 3));
        put(grid.body, rx + 1, Math.max(0, head_top - 3));
    }

    function add_spikes(grid, rng, top, bottom, left_x, right_x) {
        for (let y = top + 1; y < bottom; y += int(rng, 2, 3)) {
            if (chance(rng, 0.7)) put(grid.body, left_x - 1, y);
            if (chance(rng, 0.7)) put(grid.body, right_x + 1, y + int(rng, -1, 1));
        }
    }

    function add_torso(grid, rng, top, height, top_width, bottom_width, cx, hollow) {
        for (let row = 0; row < height; ++row) {
            const t = height <= 1 ? 0 : row / (height - 1);
            const w = Math.max(2, Math.round(top_width + (bottom_width - top_width) * t));
            centered_row(grid.body, top + row, w, cx);
        }
        if (hollow && top_width >= 6 && height >= 4) {
            const y = top + Math.floor(height / 2);
            cut(grid, Math.round(cx), y, 1, 1);
        }
    }

    function add_arms(grid, rng, torso_top, torso_height, torso_width, cx, pairs, style) {
        const left = Math.round(cx - torso_width / 2);
        const right = Math.round(cx + torso_width / 2 - 1);
        for (let i = 0; i < pairs; ++i) {
            const y = torso_top + 1 + Math.min(torso_height - 2, i * 2);
            const reach = style === "long" ? int(rng, 3, 5) : int(rng, 2, 4);
            if (style === "claw") {
                line(grid.body, left, y, left - reach, y + 1);
                put(grid.body, left - reach - 1, y);
                put(grid.body, left - reach - 1, y + 2);
                line(grid.body, right, y, right + reach, y + 1);
                put(grid.body, right + reach + 1, y);
                put(grid.body, right + reach + 1, y + 2);
            } else {
                const dy = int(rng, -1, 2);
                line(grid.body, left, y, left - reach, y + dy);
                line(grid.body, right, y, right + reach, y - dy);
            }
        }
    }

    function add_legs(grid, rng, torso_bottom, torso_width, cx, count, long_legs) {
        if (count <= 0) return;
        if (count === 1) {
            const x = Math.round(cx);
            line(grid.body, x, torso_bottom, x + int(rng, -1, 1), Math.min(size - 2, torso_bottom + (long_legs ? 5 : 3)));
            rect(grid.body, x - 1, Math.min(size - 1, torso_bottom + (long_legs ? 5 : 3)), 3, 1);
            return;
        }
        const spread = Math.max(2, Math.floor(torso_width / 3));
        const leg_len = long_legs ? int(rng, 4, 6) : int(rng, 2, 4);
        if (count === 2) {
            const lx = Math.round(cx - spread);
            const rx = Math.round(cx + spread);
            line(grid.body, lx, torso_bottom, lx - int(rng, 0, 1), Math.min(size - 2, torso_bottom + leg_len));
            line(grid.body, rx, torso_bottom, rx + int(rng, 0, 1), Math.min(size - 2, torso_bottom + leg_len));
            rect(grid.body, lx - 2, Math.min(size - 1, torso_bottom + leg_len), 3, 1);
            rect(grid.body, rx, Math.min(size - 1, torso_bottom + leg_len), 3, 1);
            return;
        }
        for (let i = 0; i < count; ++i) {
            const t = count === 1 ? 0.5 : i / (count - 1);
            const x0 = Math.round(cx - torso_width / 2 + 1 + t * Math.max(1, torso_width - 2));
            const dir = i < count / 2 ? -1 : 1;
            line(grid.body, x0, torso_bottom, x0 + dir * int(rng, 1, 3), Math.min(size - 1, torso_bottom + leg_len));
        }
    }

    function add_tail(grid, rng, torso_bottom, torso_width, cx) {
        const start_x = chance(rng, 0.5) ? Math.round(cx - torso_width / 2) : Math.round(cx + torso_width / 2);
        const dir = start_x < cx ? -1 : 1;
        let x = start_x;
        let y = torso_bottom - 1;
        for (let i = 0; i < int(rng, 4, 7); ++i) {
            put(grid.body, x, y);
            x += dir;
            if (i % 2 === 1) y += chance(rng, 0.6) ? 1 : -1;
        }
        put(grid.body, x, y);
    }

    function add_tentacles(grid, rng, y, cx, count, spread) {
        for (let i = 0; i < count; ++i) {
            const t = count === 1 ? 0.5 : i / (count - 1);
            const x = Math.round(cx - spread / 2 + t * spread);
            const dir = i < count / 2 ? -1 : 1;
            line(grid.body, x, y, x + dir * int(rng, 1, 3), Math.min(size - 1, y + int(rng, 3, 6)));
        }
    }

    function add_ribs(grid, rng, torso_top, torso_height, cx) {
        for (let y = torso_top + 1; y < torso_top + torso_height - 1; y += 2) {
            put(grid.body, cx - 2, y);
            put(grid.body, cx + 2, y);
            put(grid.body, cx - 1, y + 1);
            put(grid.body, cx + 1, y + 1);
        }
    }

    function generate_humanoid(rng, archetype) {
        const grid = create_grid();
        const cx = 10;
        const head_top = int(rng, 1, 3);
        let head_width = int(rng, 6, 10);
        let head_height = int(rng, 4, 6);
        let head_style = choose(rng, ["round", "round", "square", "triangle"]);
        let eyes = choose(rng, [1,2,2,2,3]);
        let eye_style = chance(rng, 0.35) ? "large" : "small";
        let torso_width = int(rng, 4, 8);
        let torso_height = int(rng, 4, 6);
        let arms = 1;
        let legs = 2;
        let long_legs = chance(rng, 0.35);
        let arm_style = "normal";
        let horns = false;
        let antennae = false;
        let tail = false;
        let hollow = false;

        if (archetype === "grey") {
            head_width = int(rng, 9, 12);
            head_height = int(rng, 5, 7);
            head_style = "round";
            torso_width = int(rng, 3, 5);
            torso_height = int(rng, 4, 6);
            long_legs = true;
            eye_style = "large";
        } else if (archetype === "cyclops") {
            eyes = 1;
            head_width = int(rng, 7, 10);
        } else if (archetype === "horned") {
            horns = true;
            head_width = int(rng, 7, 10);
            head_style = choose(rng, ["round","square"]);
        } else if (archetype === "robotic") {
            head_style = "square";
            head_width = int(rng, 6, 9);
            torso_width = int(rng, 5, 8);
            hollow = true;
            antennae = chance(rng, 0.55);
        } else if (archetype === "four-arm") {
            arms = 2;
            torso_width = int(rng, 5, 8);
        } else if (archetype === "tail") {
            tail = true;
            long_legs = true;
        } else if (archetype === "cute") {
            head_width = int(rng, 8, 11);
            head_height = int(rng, 5, 6);
            eye_style = "large";
            torso_width = int(rng, 4, 6);
            torso_height = int(rng, 3, 5);
        } else if (archetype === "ominous") {
            head_width = int(rng, 8, 11);
            head_style = choose(rng, ["triangle","round"]);
            eye_style = "large";
            torso_width = int(rng, 5, 8);
            long_legs = chance(rng, 0.75);
        } else if (archetype === "regal") {
            horns = true;
            antennae = chance(rng, 0.35);
            head_width = int(rng, 7, 9);
            torso_width = int(rng, 6, 8);
        }

        if (head_style === "round") head_round(grid, rng, head_top, head_width, head_height, cx);
        if (head_style === "square") head_square(grid, rng, head_top, head_width, head_height, cx);
        if (head_style === "triangle") head_triangle(grid, rng, head_top, head_width, head_height, cx);

        add_eyes(grid, rng, head_top, head_width, eyes, cx, eye_style);
        if (horns) add_horns(grid, rng, head_top, head_width, cx, archetype === "regal");
        if (antennae) add_antennae(grid, rng, head_top, head_width, cx);

        const neck_y = head_top + head_height;
        const neck_w = int(rng, 1, 3);
        centered_row(grid.body, neck_y, neck_w, cx);
        if (chance(rng, 0.5)) centered_row(grid.body, neck_y + 1, neck_w, cx);

        const torso_top = neck_y + (chance(rng, 0.5) ? 1 : 2);
        const bottom_width = Math.max(3, torso_width + int(rng, -2, 2));
        add_torso(grid, rng, torso_top, torso_height, torso_width, bottom_width, cx, hollow);
        add_arms(grid, rng, torso_top, torso_height, torso_width, cx, arms, arm_style);
        const torso_bottom = Math.min(size - 5, torso_top + torso_height - 1);
        add_legs(grid, rng, torso_bottom, bottom_width, cx, legs, long_legs);
        if (tail) add_tail(grid, rng, torso_bottom, bottom_width, cx);
        if (chance(rng, 0.16)) add_spikes(grid, rng, torso_top, torso_bottom, cx - Math.floor(torso_width / 2), cx + Math.floor(torso_width / 2));
        return grid;
    }

    function generate_insectoid(rng) {
        const grid = create_grid();
        const cx = 10;
        const head_top = int(rng, 2, 3);
        const head_width = int(rng, 5, 8);
        head_round(grid, rng, head_top, head_width, int(rng, 4, 5), cx);
        add_eyes(grid, rng, head_top, head_width, choose(rng, [2,3,4]), cx, "small");
        add_antennae(grid, rng, head_top, head_width, cx);
        const torso_top = head_top + 5;
        const torso_h = int(rng, 5, 7);
        add_torso(grid, rng, torso_top, torso_h, int(rng, 3, 5), int(rng, 2, 4), cx, false);
        add_arms(grid, rng, torso_top, torso_h, 4, cx, choose(rng, [2,3]), "long");
        add_legs(grid, rng, torso_top + torso_h - 1, 4, cx, choose(rng, [2,4]), false);
        if (chance(rng, 0.4)) add_tail(grid, rng, torso_top + torso_h - 1, 4, cx);
        return grid;
    }

    function generate_cephalopod(rng) {
        const grid = create_grid();
        const cx = 10;
        const top = int(rng, 1, 3);
        const width = int(rng, 8, 12);
        const height = int(rng, 6, 8);
        head_round(grid, rng, top, width, height, cx);
        add_eyes(grid, rng, top, width, choose(rng, [2,2,3,4]), cx, chance(rng, 0.5) ? "large" : "small");
        if (chance(rng, 0.35)) add_horns(grid, rng, top, width, cx, false);
        const tentacle_y = top + height - 1;
        add_tentacles(grid, rng, tentacle_y, cx, int(rng, 4, 7), width - 2);
        if (chance(rng, 0.35)) add_arms(grid, rng, top + 3, 3, width - 2, cx, 1, "long");
        return grid;
    }

    function generate_blob(rng) {
        const grid = create_grid();
        const cx = 10;
        const top = int(rng, 2, 4);
        const height = int(rng, 8, 12);
        const max_width = int(rng, 10, 15);
        for (let row = 0; row < height; ++row) {
            const mid = (height - 1) / 2;
            const dist = Math.abs(row - mid) / Math.max(1, mid);
            const width = Math.max(4, Math.round(max_width - dist * int(rng, 3, 6)));
            centered_row(grid.body, top + row, width, cx + (chance(rng, 0.18) ? int(rng, -1, 1) : 0));
        }
        add_eyes(grid, rng, top, max_width, choose(rng, [1,2,2,3,4]), cx, chance(rng, 0.5) ? "large" : "small");
        if (chance(rng, 0.5)) add_arms(grid, rng, top + 4, 4, max_width, cx, 1, chance(rng, 0.3) ? "claw" : "normal");
        add_legs(grid, rng, Math.min(size - 4, top + height - 1), max_width - 4, cx, choose(rng, [0,2,2,4]), false);
        return grid;
    }

    function generate_crab(rng) {
        const grid = create_grid();
        const cx = 10;
        const top = int(rng, 4, 6);
        const body_w = int(rng, 9, 13);
        head_round(grid, rng, top, body_w, int(rng, 4, 6), cx);
        add_eyes(grid, rng, top, body_w, 2, cx, "small");
        add_arms(grid, rng, top + 2, 3, body_w, cx, 1, "claw");
        const bottom = top + 5;
        for (let i = 0; i < int(rng, 3, 5); ++i) {
            const y = bottom + (i % 2);
            line(grid.body, cx - 3, y, cx - 7 - i, y + 2 + i);
            line(grid.body, cx + 3, y, cx + 7 + i, y + 2 + i);
        }
        return grid;
    }

    function generate_mushroom(rng) {
        const grid = create_grid();
        const cx = 10;
        const top = int(rng, 1, 2);
        const width = int(rng, 10, 15);
        head_mushroom(grid, rng, top, width, 6, cx);
        add_eyes(grid, rng, top + 1, width, choose(rng, [2,2,3]), cx, "small");
        const torso_top = top + 6;
        add_torso(grid, rng, torso_top, int(rng, 4, 6), int(rng, 3, 5), int(rng, 3, 6), cx, false);
        add_arms(grid, rng, torso_top, 4, 4, cx, 1, "normal");
        add_legs(grid, rng, torso_top + 4, 4, cx, 2, false);
        return grid;
    }

    function generate_skeletal(rng) {
        const grid = create_grid();
        const cx = 10;
        const head_top = int(rng, 1, 2);
        head_round(grid, rng, head_top, int(rng, 6, 8), 5, cx);
        add_eyes(grid, rng, head_top, 7, 2, cx, "large");
        const torso_top = head_top + 6;
        line(grid.body, cx, torso_top, cx, torso_top + 6);
        add_ribs(grid, rng, torso_top, 6, cx);
        add_arms(grid, rng, torso_top + 1, 4, 5, cx, 1, "long");
        add_legs(grid, rng, torso_top + 6, 3, cx, 2, true);
        return grid;
    }

    function generate_larva(rng) {
        const grid = create_grid();
        const y = int(rng, 8, 11);
        const segments = int(rng, 4, 6);
        let x = int(rng, 2, 4);
        for (let i = 0; i < segments; ++i) {
            const h = i === 0 ? int(rng, 4, 6) : int(rng, 3, 5);
            rect(grid.body, x, y - Math.floor(h / 2), 3, h);
            if (i === 0) {
                cut(grid, x, y - 1, 1, 1);
                cut(grid, x + 2, y - 1, 1, 1);
                if (chance(rng, 0.5)) {
                    line(grid.body, x, y - 2, x - 1, y - 4);
                    line(grid.body, x + 2, y - 2, x + 3, y - 4);
                }
            }
            if (chance(rng, 0.6)) put(grid.body, x + 1, y + Math.floor(h / 2) + 1);
            x += 3;
        }
        if (chance(rng, 0.6)) line(grid.body, x - 1, y, Math.min(size - 1, x + 2), y + int(rng, -2, 2));
        return grid;
    }

    function generate_plant(rng) {
        const grid = create_grid();
        const cx = 10;
        const top = int(rng, 2, 4);
        rect(grid.body, cx - 1, top + 4, 3, 9);
        const crown = int(rng, 3, 6);
        for (let i = 0; i < crown; ++i) {
            const dx = int(rng, -6, 6);
            const dy = int(rng, 0, 4);
            line(grid.body, cx, top + 5, cx + dx, top + dy);
            put(grid.body, cx + dx, top + dy - 1);
        }
        head_round(grid, rng, top + 3, int(rng, 5, 7), 4, cx);
        add_eyes(grid, rng, top + 3, 6, choose(rng, [1,2]), cx, "small");
        add_arms(grid, rng, top + 8, 3, 4, cx, 1, "long");
        add_legs(grid, rng, top + 13, 3, cx, 2, false);
        return grid;
    }


    function add_eye_brow(grid, x0, y0, width) {
        for (let i = 0; i < width; ++i) {
            put(grid.body, x0 + i, y0);
        }
    }

    function generate_et(seed_or_rng, variant_name) {
        const rng = typeof seed_or_rng === "function" ? seed_or_rng : make_rng(seed_or_rng >>> 0);
        const grid = create_grid();
        const cx = 10;

        const head_top = int(rng, 0, 2);
        const head_width = int(rng, 9, 12);
        const head_height = int(rng, 5, 7);
        const jaw_narrow = int(rng, 1, 2);
        const neck_width = int(rng, 2, 3);
        const neck_height = int(rng, 2, 3);
        const torso_top = head_top + head_height + neck_height;
        const torso_height = int(rng, 5, 7);
        const shoulder_width = int(rng, 8, 11);
        const hip_width = max(6, shoulder_width - int(rng, 1, 3));
        const arm_reach = int(rng, 3, 5);
        const leg_len = int(rng, 2, 4);

        function max(a, b) { return a > b ? a : b; }

        for (let row = 0; row < head_height; ++row) {
            const t = head_height <= 1 ? 0 : row / (head_height - 1);
            let width = head_width;
            if (row === 0) width -= 2;
            if (row === head_height - 1) width -= jaw_narrow * 2;
            else if (t > 0.6) width -= jaw_narrow;
            centered_row(grid.body, head_top + row, max(4, width), cx);
        }

        const eye_y = head_top + int(rng, 2, 3);
        const eye_variant = variant_name === 'et-cyclops' ? 'mono' : choose(rng, ['pair', 'pair', 'pair', 'triple', 'mono']);

        if (eye_variant === 'mono') {
            const eye_w = variant_name === 'et-cyclops' ? choose(rng, [3, 4]) : choose(rng, [2, 3]);
            const x = cx - Math.floor(eye_w / 2);
            cut(grid, x, eye_y, eye_w, 1);
            if (variant_name === 'et-cyclops' && chance(rng, 0.8)) {
                add_eye_brow(grid, x - 1, Math.max(head_top + 1, eye_y - 1), eye_w + 2);
            }
            if (variant_name === 'et-cyclops' && chance(rng, 0.45)) {
                put(grid.holes, cx, eye_y);
            }
        } else if (eye_variant === 'triple') {
            cut(grid, cx - 3, eye_y, 1, 1);
            cut(grid, cx, eye_y, 1, 1);
            cut(grid, cx + 3, eye_y, 1, 1);
        } else {
            const eye_w = chance(rng, 0.35) ? 2 : 1;
            cut(grid, cx - 3, eye_y, eye_w, 1);
            cut(grid, cx + 2 - (eye_w - 1), eye_y, eye_w, 1);
            if (chance(rng, 0.22)) {
                add_eye_brow(grid, cx - 4, Math.max(head_top + 1, eye_y - 1), 3);
                add_eye_brow(grid, cx + 1, Math.max(head_top + 1, eye_y - 1), 3);
            }
        }

        if (variant_name === 'et-priestess' || chance(rng, 0.28)) {
            const ornament_y = head_top + 1;
            put(grid.body, cx, ornament_y - 1);
            put(grid.body, cx - 1, ornament_y);
            put(grid.body, cx + 1, ornament_y);
        }
        if (variant_name === 'et-seer' || chance(rng, 0.18)) {
            line(grid.body, cx - 2, head_top, cx - 4, Math.max(0, head_top - 2));
            line(grid.body, cx + 2, head_top, cx + 4, Math.max(0, head_top - 2));
            put(grid.body, cx - 4, Math.max(0, head_top - 2));
            put(grid.body, cx + 4, Math.max(0, head_top - 2));
        }

        for (let row = 0; row < neck_height; ++row) {
            centered_row(grid.body, head_top + head_height + row, neck_width, cx);
        }

        for (let row = 0; row < torso_height; ++row) {
            const t = torso_height <= 1 ? 0 : row / (torso_height - 1);
            const width = Math.round(shoulder_width + (hip_width - shoulder_width) * t);
            centered_row(grid.body, torso_top + row, width, cx);
        }

        const left_shoulder = Math.round(cx - shoulder_width / 2);
        const right_shoulder = Math.round(cx + shoulder_width / 2 - 1);
        const arm_y = torso_top + 1;
        line(grid.body, left_shoulder, arm_y, left_shoulder - arm_reach, arm_y + int(rng, 1, 2));
        line(grid.body, right_shoulder, arm_y, right_shoulder + arm_reach, arm_y + int(rng, 1, 2));
        put(grid.body, left_shoulder - arm_reach - 1, arm_y + 1);
        put(grid.body, right_shoulder + arm_reach + 1, arm_y + 1);
        if (chance(rng, 0.35)) {
            put(grid.body, left_shoulder - arm_reach - 1, arm_y + 2);
            put(grid.body, right_shoulder + arm_reach + 1, arm_y + 2);
        }

        const torso_bottom = torso_top + torso_height - 1;
        const leg_gap = choose(rng, [2, 2, 3]);
        const lx = cx - leg_gap;
        const rx = cx + leg_gap;
        line(grid.body, lx, torso_bottom, lx - int(rng, 0, 1), Math.min(size - 2, torso_bottom + leg_len));
        line(grid.body, rx, torso_bottom, rx + int(rng, 0, 1), Math.min(size - 2, torso_bottom + leg_len));
        rect(grid.body, lx - 1, Math.min(size - 1, torso_bottom + leg_len), 2, 1);
        rect(grid.body, rx, Math.min(size - 1, torso_bottom + leg_len), 2, 1);

        if (chance(rng, 0.45)) {
            line(grid.body, cx, torso_top + 1, cx + choose(rng, [-1, 0, 1]), torso_bottom - 1);
        }
        if (chance(rng, 0.38)) {
            cut(grid, cx, torso_top + 2, 1, 1);
        }
        if (variant_name === 'et-cyclops') {
            cut(grid, cx, torso_top + 2, 1, 1);
            if (chance(rng, 0.65)) {
                cut(grid, cx, torso_top + 4, 1, 1);
            }
        }
        if (variant_name === 'et-priestess' && chance(rng, 0.65)) {
            cut(grid, cx - 1, torso_top + 3, 1, 1);
            cut(grid, cx + 1, torso_top + 3, 1, 1);
        }

        return {
            name: variant_name,
            seed: (typeof seed_or_rng === "function" ? 0 : (seed_or_rng >>> 0)),
            viewBox: "0 0 20 20",
            body: grid.body,
            holes: grid.holes
        };
    }

    function choose_et_sprite(seed) {
        const rng = make_rng(seed);
        const variant = choose(rng, [
            'et-classic', 'et-classic', 'et-classic',
            'et-cyclops', 'et-cyclops',
            'et-seer', 'et-priestess'
        ]);
        return generate_et(seed, variant);
    }

    const archetypes = [
        "grey", "cyclops", "horned", "robotic", "four-arm", "tail", "cute", "ominous", "regal",
        "insectoid", "cephalopod", "blob", "crab", "mushroom", "skeletal", "larva", "plant"
    ];

    function generate_one(seed) {
        const rng = make_rng(seed);
        const archetype = choose(rng, archetypes);
        let grid;
        if (["grey","cyclops","horned","robotic","four-arm","tail","cute","ominous","regal"].includes(archetype)) {
            grid = generate_humanoid(rng, archetype);
        } else if (archetype === "insectoid") grid = generate_insectoid(rng);
        else if (archetype === "cephalopod") grid = generate_cephalopod(rng);
        else if (archetype === "blob") grid = generate_blob(rng);
        else if (archetype === "crab") grid = generate_crab(rng);
        else if (archetype === "mushroom") grid = generate_mushroom(rng);
        else if (archetype === "skeletal") grid = generate_skeletal(rng);
        else if (archetype === "larva") grid = generate_larva(rng);
        else grid = generate_plant(rng);

        if (chance(rng, 0.24)) {
            const body = Array.from(grid.body);
            const mutations = int(rng, 1, 4);
            for (let i = 0; i < mutations && body.length; ++i) {
                const [sx, sy] = choose(rng, body).split(",").map(Number);
                put(grid.body, sx + int(rng, -1, 1), sy + int(rng, -1, 1));
            }
        }

        return {
            name: archetype,
            seed: seed >>> 0,
            viewBox: "0 0 20 20",
            body: grid.body,
            holes: grid.holes
        };
    }

    const female_et = {
        name: "female-et",
        seed: 0,
        viewBox: "0 0 16 15",
        body: new Set([
            "0,0","1,0","2,0","3,0","4,0","5,0","6,0","7,0","8,0","9,0","10,0","11,0","12,0","13,0",
            "0,1","1,1","4,1","5,1","6,1","7,1","8,1","9,1","10,1","11,1","12,1","13,1","14,1","15,1",
            "0,2","1,2","2,2","3,2","4,2","5,2","6,2","7,2","8,2","9,2","10,2","11,2","12,2","13,2","14,2","15,2",
            "0,3","1,3","2,3","3,3","4,3","5,3","6,3","7,3","8,3","9,3","10,3","11,3","12,3","13,3","14,3","15,3",
            "0,4","1,4","2,4","3,4","12,4","13,4","14,4","15,4","12,5","13,5","14,5","15,5",
            "8,6","9,6","10,6","11,6","12,6","13,6","14,6","15,6",
            "6,7","7,7","8,7","9,7","10,7","11,7","12,7","13,7","14,7","15,7",
            "0,8","1,8","2,8","3,8","4,8","5,8","6,8","7,8","8,8","9,8","10,8","11,8","12,8","13,8","14,8","15,8",
            "0,9","1,9","4,9","5,9","6,9","7,9","8,9","9,9","10,9","11,9","12,9","13,9","14,9","15,9",
            "4,10","5,10","6,10","7,10","8,10","9,10","10,10","11,10","12,10","13,10","14,10","15,10",
            "4,11","5,11","6,11","7,11","8,11","9,11","10,11","11,11","12,11","13,11","14,11","15,11",
            "4,12","5,12","8,12","9,12","12,12","13,12","14,12","15,12",
            "2,13","3,13","4,13","5,13","12,13","13,13","14,13","15,13",
            "0,14","1,14","2,14","3,14","4,14","5,14","10,14","11,14","12,14","13,14","14,14","15,14"
        ]),
        holes: new Set()
    };

    function sprite_hash(sprite) {
        if (sprite.name === "female-et") return "female-et";
        return Array.from(sprite.body).sort().join(";") + "|" + Array.from(sprite.holes).sort().join(";");
    }

    function load_history() {
        try {
            const value = JSON.parse(localStorage.getItem(history_key) || "[]");
            return Array.isArray(value) ? value.slice(-recent_limit) : [];
        } catch (_) {
            return [];
        }
    }

    function save_history(history) {
        try {
            localStorage.setItem(history_key, JSON.stringify(history.slice(-recent_limit)));
        } catch (_) {
        }
    }

    function choose_sprite() {
        const history = load_history();

        let chosen = null;
        let hash = "";

        for (let attempt = 0; attempt < 96; ++attempt) {
            const seed = random_seed();
            if (Math.random() < et_family_chance) {
                if (Math.random() < 0.14) {
                    chosen = female_et;
                } else {
                    chosen = choose_et_sprite(seed);
                }
            } else {
                chosen = generate_one(seed);
            }

            hash = sprite_hash(chosen);
            if (!history.includes(hash)) break;
        }

        history.push(hash);
        save_history(history);
        return chosen;
    }

    function draw_rect(svg, x, y, w, h, fill) {
        const node = document.createElementNS(svg_ns, "rect");
        node.setAttribute("x", String(x));
        node.setAttribute("y", String(y));
        node.setAttribute("width", String(w));
        node.setAttribute("height", String(h));
        node.setAttribute("fill", fill === "currentColor" ? "url(#alien-accent-gradient) currentColor" : fill);
        svg.appendChild(node);
    }

    function add_accent_gradient(svg) {
        const defs = document.createElementNS(svg_ns, "defs");
        const gradient = document.createElementNS(svg_ns, "linearGradient");
        const view_box = svg.viewBox.baseVal;
        gradient.setAttribute("id", "alien-accent-gradient");
        gradient.setAttribute("gradientUnits", "userSpaceOnUse");
        gradient.setAttribute("x1", String(view_box.x));
        gradient.setAttribute("x2", String(view_box.x + view_box.width));

        const start = document.createElementNS(svg_ns, "stop");
        start.setAttribute("offset", "0%");
        start.setAttribute("class", "alien-gradient-start");
        const end = document.createElementNS(svg_ns, "stop");
        end.setAttribute("offset", "100%");
        end.setAttribute("class", "alien-gradient-end");
        gradient.append(start, end);
        defs.appendChild(gradient);
        svg.appendChild(defs);
    }

    function render_sprite(svg, sprite) {
        svg.setAttribute("viewBox", sprite.viewBox);
        svg.textContent = "";
        add_accent_gradient(svg);

        const rows = new Map();
        for (const value of sprite.body) {
            const [x, y] = value.split(",").map(Number);
            if (!rows.has(y)) rows.set(y, []);
            rows.get(y).push(x);
        }

        const ys = Array.from(rows.keys()).sort((a, b) => a - b);
        for (const y of ys) {
            const xs = rows.get(y).sort((a, b) => a - b);
            let start = xs[0];
            let previous = xs[0];
            for (let i = 1; i <= xs.length; ++i) {
                const current = xs[i];
                if (current !== previous + 1) {
                    draw_rect(svg, start, y, previous - start + 1, 1, "currentColor");
                    start = current;
                }
                previous = current;
            }
        }

        for (const value of sprite.holes) {
            const [x, y] = value.split(",").map(Number);
            draw_rect(svg, x, y, 1, 1, "var(--bg)");
        }
    }

    function sprite_points(sprite) {
        const points = [];
        for (const value of sprite.body) {
            const [x, y] = value.split(",").map(Number);
            points.push({ x, y });
        }
        return points;
    }

    function render_points(svg, points, view_box) {
        svg.setAttribute("viewBox", view_box || "0 0 20 20");
        svg.textContent = "";
        add_accent_gradient(svg);
        for (const point of points) {
            draw_rect(svg, point.x, point.y, 1, 1, point.fill || "currentColor");
        }
    }

    function step_toward(value, target) {
        if (value < target) return value + 1;
        if (value > target) return value - 1;
        return value;
    }

    function move_points_toward(points, target_x, target_y) {
        let done = true;
        for (const point of points) {
            const next_x = step_toward(point.x, target_x);
            const next_y = step_toward(point.y, target_y);
            if (next_x !== target_x || next_y !== target_y) done = false;
            if (point.x !== target_x || point.y !== target_y) {
                point.x = next_x;
                point.y = next_y;
            }
        }
        return done;
    }

    function move_points_to_targets(points) {
        let done = true;
        for (const point of points) {
            const next_x = step_toward(point.x, point.tx);
            const next_y = step_toward(point.y, point.ty);
            if (next_x !== point.tx || next_y !== point.ty) done = false;
            if (point.x !== point.tx || point.y !== point.ty) {
                point.x = next_x;
                point.y = next_y;
            }
        }
        return done;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function explosion_profile(sprite) {
        const points = sprite_points(sprite);
        let min_x = Infinity;
        let max_x = -Infinity;
        let min_y = Infinity;
        let max_y = -Infinity;

        for (const point of points) {
            min_x = Math.min(min_x, point.x);
            max_x = Math.max(max_x, point.x);
            min_y = Math.min(min_y, point.y);
            max_y = Math.max(max_y, point.y);
        }

        const width = max_x - min_x + 1;
        const height = max_y - min_y + 1;
        const span = Math.max(width, height);
        const pixel_count = points.length;

        return {
            radius: clamp(Math.round(3 + Math.max(0, span - 6) * 0.32 + Math.sqrt(pixel_count) * 0.10), 4, 9),
            fragments: clamp(Math.round(7 + pixel_count / 16 + span / 5), 10, 22)
        };
    }

    function build_explosion_frames(cx, cy, sprite) {
        const profile = explosion_profile(sprite);
        const frames = [];
        const frame_count = 7;
        const seed = ((sprite.seed || 0) ^ (sprite.body.size << 8) ^ 0x45d9f3b) >>> 0;
        const rng = make_rng(seed);
        const directions = [
            [ 1, 0], [-1, 0], [ 0, 1], [ 0,-1],
            [ 1, 1], [-1, 1], [ 1,-1], [-1,-1],
            [ 2, 1], [-2, 1], [ 2,-1], [-2,-1],
            [ 1, 2], [-1, 2], [ 1,-2], [-1,-2]
        ];
        const fragments = [];

        for (let i = 0; i < profile.fragments; ++i) {
            const dir = directions[i < directions.length ? i : Math.floor(rng() * directions.length)];
            fragments.push({
                dx: dir[0],
                dy: dir[1],
                delay: i < 8 ? 0 : Math.floor(rng() * 2),
                speed: 0.82 + rng() * 0.36,
                lifetime: 5 + Math.floor(rng() * 3)
            });
        }

        function add_point(frame, seen, x, y) {
            x = Math.round(x);
            y = Math.round(y);
            if (x < 0 || y < 0 || x >= 20 || y >= 20) return;
            const id = x + "," + y;
            if (seen.has(id)) return;
            seen.add(id);
            frame.push({ x, y, fill: "currentColor" });
        }

        for (let frame_index = 0; frame_index < frame_count; ++frame_index) {
            const frame = [];
            const seen = new Set();

            if (frame_index === 0) {
                for (let y = -1; y <= 1; ++y) {
                    for (let x = -1; x <= 1; ++x) add_point(frame, seen, cx + x, cy + y);
                }
            } else if (frame_index === 1) {
                for (let d = -2; d <= 2; ++d) {
                    add_point(frame, seen, cx + d, cy - 2);
                    add_point(frame, seen, cx + d, cy + 2);
                    add_point(frame, seen, cx - 2, cy + d);
                    add_point(frame, seen, cx + 2, cy + d);
                }
            }

            for (const fragment of fragments) {
                const local_frame = frame_index - fragment.delay;
                if (local_frame < 0 || local_frame >= fragment.lifetime) continue;

                const progress = local_frame / Math.max(1, frame_count - 2);
                const distance = Math.max(1, Math.round(profile.radius * progress * fragment.speed));
                const norm = Math.max(Math.abs(fragment.dx), Math.abs(fragment.dy));
                const x = cx + Math.round(fragment.dx * distance / norm);
                const y = cy + Math.round(fragment.dy * distance / norm);
                add_point(frame, seen, x, y);

                if (frame_index >= 2 && frame_index <= 4 && rng() < 0.24) {
                    add_point(frame, seen, x + (fragment.dy === 0 ? 0 : Math.sign(fragment.dy)), y - (fragment.dx === 0 ? 0 : Math.sign(fragment.dx)));
                }
            }

            frames.push(frame);
        }

        return frames;
    }

    function init() {
        const svg = document.querySelector(".intro-alien");
        if (!svg) return;

        let last_replace = 0;
        let current_sprite = null;
        let is_transitioning = false;
        const hover_cooldown_ms = 1000;
        const center_x = 10;
        const center_y = 10;
        const collapse_step_ms = 42;
        const build_step_ms = 42;
        const explosion_step_ms = 52;

        function commit_sprite(sprite) {
            current_sprite = sprite;
            render_sprite(svg, sprite);
            svg.setAttribute("data-sprite", sprite.name);
            svg.setAttribute("data-seed", String(sprite.seed));
            last_replace = Date.now();
        }

        function replace_sprite_immediately() {
            commit_sprite(choose_sprite());
        }

        function animate_replace() {
            if (is_transitioning) return;
            if (Date.now() - last_replace < hover_cooldown_ms) return;
            if (!current_sprite) {
                replace_sprite_immediately();
                return;
            }

            is_transitioning = true;
            const next_sprite = choose_sprite();
            const collapse_points = sprite_points(current_sprite);
            const explosion_frames = build_explosion_frames(center_x, center_y, current_sprite);
            const build_points = sprite_points(next_sprite).map(function (point) {
                return { x: center_x, y: center_y, tx: point.x, ty: point.y };
            });
            let phase = "collapse";
            let explosion_index = 0;
            let explosion_accumulator = 0;
            let build_accumulator = 0;
            let accumulator = 0;
            let last_timestamp = null;

            function finish() {
                commit_sprite(next_sprite);
                is_transitioning = false;
            }

            function advance_phase(step_ms) {
                if (phase === "collapse") {
                    if (move_points_toward(collapse_points, center_x, center_y)) {
                        phase = "rebuild";
                        explosion_index = 0;
                        explosion_accumulator = 0;
                        build_accumulator = 0;
                    }
                    return;
                }

                if (phase === "rebuild") {
                    explosion_accumulator += step_ms;
                    build_accumulator += step_ms;

                    while (explosion_accumulator >= explosion_step_ms && explosion_index < explosion_frames.length - 1) {
                        explosion_accumulator -= explosion_step_ms;
                        explosion_index += 1;
                    }

                    let build_done = false;
                    while (build_accumulator >= build_step_ms) {
                        build_accumulator -= build_step_ms;
                        build_done = move_points_to_targets(build_points);
                        if (build_done) break;
                    }

                    const explosion_done = explosion_index >= explosion_frames.length - 1 && explosion_accumulator >= explosion_step_ms;
                    if (explosion_done && build_done) {
                        finish();
                    }
                }
            }

            function draw_phase() {
                if (phase === "collapse") {
                    render_points(svg, collapse_points, "0 0 20 20");
                    return;
                }

                if (phase === "rebuild") {
                    const frame = explosion_frames[Math.min(explosion_index, explosion_frames.length - 1)];
                    render_points(svg, build_points.concat(frame), "0 0 20 20");
                }
            }

            function frame(timestamp) {
                if (!is_transitioning) return;
                if (last_timestamp === null) last_timestamp = timestamp;
                accumulator += timestamp - last_timestamp;
                last_timestamp = timestamp;

                while (true) {
                    const phase_step_ms = phase === "collapse" ? collapse_step_ms : Math.min(build_step_ms, explosion_step_ms);
                    if (accumulator < phase_step_ms || !is_transitioning) break;
                    accumulator -= phase_step_ms;
                    advance_phase(phase_step_ms);
                }

                if (!is_transitioning) return;
                draw_phase();
                window.requestAnimationFrame(frame);
            }

            draw_phase();
            window.requestAnimationFrame(frame);
        }

        replace_sprite_immediately();
        svg.addEventListener("mouseenter", animate_replace);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
