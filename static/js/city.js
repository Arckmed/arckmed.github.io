/* Decorative city life. All positions use the SVG's 960 x 320 pixel grid. */
(() => {
    "use strict";
    const city = document.querySelector(".about-city");
    if (!city) return;
    const canvas = city.querySelector(".city-activity");
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    // Inside the SVG, after the sky and before every building: the artwork
    // itself occludes celestial events, including roofs, antennas and signs.
    let skyCanvas = city.querySelector(".city-sky");
    if (!skyCanvas) {
        // Hugo can update static JS without rebuilding the SVG embedded in the
        // page. These distant-building fills also anchor the layer in older art.
        const skyline = city.querySelector('path[fill="#303341"], path[fill="#333747"], path[fill="#303b47"]');
        if (skyline) {
            const skyLayer = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
            for (const [key, value] of Object.entries({ x: 0, y: 0, width: 960, height: 320, "pointer-events": "none" })) {
                skyLayer.setAttribute(key, value);
            }
            skyCanvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
            skyCanvas.setAttribute("class", "city-sky");
            skyCanvas.setAttribute("width", "960");
            skyCanvas.setAttribute("height", "320");
            skyLayer.append(skyCanvas);
            skyline.before(skyLayer);
        }
    }
    const skyCtx = skyCanvas?.getContext("2d");

    // Reuse the artwork's lamps and trees above the moving sprites, so walkers
    // pass behind them without duplicating their positions in JavaScript.
    const foreground = city.querySelector("[data-city-foreground]");
    if (foreground) {
        const layer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        layer.setAttribute("viewBox", "0 0 960 320");
        layer.setAttribute("width", "960");
        layer.setAttribute("height", "320");
        layer.setAttribute("class", "city-foreground");
        layer.setAttribute("shape-rendering", "crispEdges");
        layer.append(foreground.cloneNode(true));
        city.append(layer);
    }

    // Sample at creation and event boundaries, never in the drawing routines.
    const random = Math.random;
    const between = (min, max) => min + random() * (max - min);
    const choose = values => values[Math.floor(random() * values.length)];
    const pixel = (x, y, w, h, color, context = ctx) => {
        context.fillStyle = color;
        context.fillRect(Math.round(x), Math.round(y), w, h);
    };
    const coats = ["#c78f8f", "#91b4b8", "#b2a4cd", "#d0b47d", "#879bb4"];
    function makePerson(y) {
        return { x: between(0, 960), y, homeY: y, speed: between(2.5, 5.5) * choose([-1, 1]),
            phase: between(0, 30), coat: choose(coats), state: "walking", bench: null,
            nextDecision: between(1, 12), until: 0 };
    }
    const people = Array.from({ length: Math.floor(between(22, 35)) }, () => makePerson(choose([291, 292, 293])));
    const farPeople = Array.from({ length: Math.floor(between(14, 25)) }, () => makePerson(choose([276, 277])));
    const benches = Array.from(city.querySelectorAll("[data-city-bench]"), el => ({
        x: Number(el.getAttribute("data-x")), person: null,
    }));

    function travel(kind, y, chance) {
        return { kind, y, x: between(0, 960), active: random() < chance,
            direction: choose([-1, 1]), speed: between(5, 9), next: between(4, 35),
            phase: between(0, 20), width: choose([16, 25]) };
    }
    // Shared speed within each lane prevents overtaking through another car.
    const laneSpeeds = [between(23, 32), between(20, 29)];
    const laneOffsets = [between(0, 100), between(0, 100)];
    const cars = Array.from({ length: 12 }, (_, i) => ({
        ...travel("car", 0, .8), x: Math.floor(i / 2) * 160 + laneOffsets[i % 2] + between(-18, 18),
        lane: i % 2, direction: i % 2 ? -1 : 1, speed: laneSpeeds[i % 2],
        color: choose(coats), bus: random() < .15,
    }));
    const boats = [305, 310, 315].map(y => travel("boat", y, .7));
    const planes = [29, 58].map(y => ({ ...travel("plane", y, .45), speed: between(15, 23) }));
    const windows = Array.from(city.querySelectorAll("[data-city-window]"), el => ({
        el, original: el.getAttribute("fill"), next: 2 + random() * 24,
        on: random() > .25,
    }));
    const beacons = Array.from(city.querySelectorAll("[data-city-beacon]"), el => ({
        el, original: el.getAttribute("fill"), phase: random() * 5,
        period: 3 + random() * 3, on: true,
    }));

    function pedestrian(p, time) {
        if (p.state === "waiting") return;
        const x = p.x;
        if (p.state === "sitting") {
            pixel(x, 287, 2, 2, "#d2b6a3");
            pixel(x, 289, 2, 3, p.coat);
            pixel(x, 292, 4, 1, "#252a3a");
            pixel(x + 3, 293, 1, 2, "#252a3a");
            pixel(x - 1, 291, 1, 1, "#d2b6a3");
            return;
        }
        const moving = ["walking", "approaching", "leaving"].includes(p.state);
        const step = moving && Math.floor(time * 5 + p.phase) % 2 ? 1 : 0;
        pixel(x, p.y - 6, 2, 2, "#d2b6a3");
        pixel(x, p.y - 4, 2, 3, p.coat);
        pixel(x - step, p.y - 1, 1, 2, "#191f2b");
        pixel(x + 1 + step, p.y - 1, 1, 2, "#191f2b");
        pixel(x - 1, p.y - 3 + step, 1, 2, p.coat);
    }

    function car(c, time) {
        if (!c.active) return;
        const { direction, x } = c;
        const y = c.lane ? 287 : 282;
        const w = c.bus ? 19 : 10;
        pixel(x, y - 1, w, 3, c.color);
        pixel(x + 2, y - 3, w - 4, 2, c.color);
        for (let i = 3; i < w - 2; i += 4) pixel(x + i, y - 2, 3, 1, "#b5ccd1");
        pixel(x + 1, y + 2, 2, 1, "#131925");
        pixel(x + w - 3, y + 2, 2, 1, "#131925");
        pixel(x + (direction > 0 ? w - 1 : 0), y, 1, 1, "#f1d4ab");
        pixel(x + (direction > 0 ? 0 : w - 1), y, 1, 1, "#d27b88");
        pixel(x + (direction > 0 ? w + 1 : -4), y + 1, 3, 1, "#645a56");
    }

    function boat(b, time) {
        if (!b.active) return;
        const { direction, x, y, width } = b;
        const bob = Math.floor(time / 2 + b.phase) % 2;
        // Wake trails the stern; broken cabin-light reflections sit below it.
        for (let i = 0; i < 4; i++) {
            const tail = direction > 0 ? x - 5 - i * 5 : x + width + 2 + i * 5;
            pixel(tail, y + (i % 2), 3, 1, i < 2 ? "#8393a7" : "#46556b");
        }
        pixel(x + 2, y + 3, width - 5, 1, "#596076");
        pixel(x + 5 + Math.floor(time * 2) % 3, y + 4, 4, 1, "#a1908d");
        pixel(x, y - 1 + bob, width, 2, "#a391a5");
        pixel(x + 2, y + 1 + bob, width - 4, 1, "#51455f");
        pixel(x + 4, y - 5 + bob, width - 8, 4, "#667b8d");
        for (let i = 5; i < width - 4; i += 4) pixel(x + i, y - 4 + bob, 2, 1, "#e0c6a5");
        pixel(x + 7, y - 7 + bob, 1, 2, "#a7a5b5");
        pixel(x + (direction > 0 ? width - 1 : 0), y - 2 + bob, 1, 1, "#dac7a6");
    }

    function aircraft(plane, time) {
        if (!plane.active) return;
        const { direction, x, y } = plane;
        // Flight corridors stay above the tallest roof, never crossing facades.
        pixel(x, y, 12, 1, "#aaa7bc");
        pixel(x + 5, y - 3, 2, 7, "#858da5");
        pixel(x + (direction > 0 ? 1 : 9), y - 2, 2, 4, "#7b7993");
        pixel(x + (direction > 0 ? 11 : 0), y, 2, 1, "#d0c6cc");
        if ((time + plane.phase) % 2 < .25) pixel(x + 5, y + 3, 1, 1, "#de8a99");
    }

    // Five-by-seven lettering stays crisp and independent of installed fonts.
    const bannerFont = {
        A: [14, 17, 17, 31, 17, 17, 17], C: [15, 16, 16, 16, 16, 16, 15],
        D: [30, 17, 17, 17, 17, 17, 30], E: [31, 16, 16, 30, 16, 16, 31],
        G: [15, 16, 16, 23, 17, 17, 15], I: [31, 4, 4, 4, 4, 4, 31],
        K: [17, 18, 20, 24, 20, 18, 17], M: [17, 27, 21, 21, 17, 17, 17],
        N: [17, 25, 21, 19, 17, 17, 17], R: [30, 17, 17, 30, 20, 18, 17],
        S: [15, 16, 16, 14, 1, 1, 30], V: [17, 17, 17, 17, 17, 10, 4],
        " ": [0, 0, 0, 0, 0, 0, 0],
    };
    const messages = ["ARCKMED", "REVERSE ENGINEERING"];
    const airships = [8, 39].map(y => ({ ...travel("airship", y, .4), text: choose(messages) }));

    const wishingStar = { active: false, next: between(6, 24) };
    function starPoint(progress) {
        const s = wishingStar;
        return {
            x: s.x + s.direction * s.distance * progress,
            y: (1 - progress) ** 2 * s.y + 2 * (1 - progress) * progress * s.controlY + progress ** 2 * s.endY,
        };
    }

    function updateStar(time) {
        const s = wishingStar;
        if (s.active) {
            if (time > s.start + s.duration + .4) {
                s.active = false;
                s.next = time + between(20, 65);
            }
        } else if (time >= s.next) {
            Object.assign(s, {
                active: true, start: time, duration: between(2.8, 3.8),
                direction: choose([-1, 1]), distance: between(240, 430),
                y: between(30, 42), endY: 285, controlY: between(-40, -20),
            });
            s.x = s.direction > 0 ? between(20, 480) : between(480, 940);
        }
    }

    function drawStar(time) {
        if (!skyCtx) return;
        skyCtx.clearRect(0, 0, 960, 320);
        const s = wishingStar;
        if (!s.active) return;
        const elapsed = time - s.start;
        // Follow the arc into the opaque city; both head and tail pass behind it.
        const colors = ["#514655", "#786479", "#af8eaa", "#e0bdce"];
        for (let i = 24; i >= 1; i--) {
            const progress = (elapsed - i * .016) / s.duration;
            if (progress < 0 || progress > 1) continue;
            const p = starPoint(progress);
            pixel(p.x, p.y, 2, 1, colors[Math.floor((24 - i) / 6)], skyCtx);
        }
        if (elapsed <= s.duration) {
            const p = starPoint(elapsed / s.duration);
            pixel(p.x - 1, p.y, 3, 1, "#fff0cd", skyCtx);
            pixel(p.x, p.y - 1, 1, 3, "#fff0cd", skyCtx);
            pixel(p.x, p.y, 1, 1, "#ffffff", skyCtx);
        }
    }

    function airship(ship, time) {
        if (!ship.active) return;
        const { x } = ship;
        const phase = time + ship.phase;
        const y = ship.y + Math.round(Math.sin(phase * .45));
        const width = ship.text.length * 6 + 8;
        const bannerX = ship.direction > 0 ? x - width - 12 : x + 48;
        // The whole ship and its trailing flag leave the screen before wrapping.
        if (Math.max(x + 36, bannerX + width) < 0 || Math.min(x, bannerX) > 960) return;
        const wave = col => Math.round(Math.sin(col / 12 - time * 2) * 1);
        const bannerY = y + 3;
        for (let col = 0; col < width; col++) {
            const yy = bannerY + wave(col);
            pixel(bannerX + col, yy, 1, 11, "#9e819f");
            pixel(bannerX + col, yy + 1, 1, 9, "#343449");
        }
        for (let i = 0; i < ship.text.length; i++) {
            const glyph = bannerFont[ship.text[i]];
            for (let row = 0; row < 7; row++) {
                for (let col = 0; col < 5; col++) {
                    if (glyph[row] & (1 << (4 - col))) {
                        const dx = 4 + i * 6 + col;
                        pixel(bannerX + dx, bannerY + 2 + row + wave(dx), 1, 1, "#e0c7d2");
                    }
                }
            }
        }
        const attachment = ship.direction > 0 ? width - 1 : 0;
        const stringY = bannerY + 5 + wave(attachment);
        pixel(ship.direction > 0 ? x - 12 : x + 36, stringY, 12, 1, "#78748c");
        // Stepped envelope, shaded belly, tail fins and a suspended gondola.
        const tailX = ship.direction > 0 ? x : x + 30;
        pixel(tailX, y + 1, 6, 13, "#706882");
        pixel(x + 6, y + 1, 24, 13, "#a89aae");
        pixel(x + 2, y + 4, 32, 7, "#a89aae");
        pixel(x, y + 6, 36, 3, "#a89aae");
        pixel(x + 8, y + 2, 18, 2, "#d3c1cd");
        pixel(x + 5, y + 10, 27, 2, "#807890");
        pixel(x + 10, y + 12, 17, 2, "#6c6981");
        pixel(x + 13, y + 14, 1, 2, "#aaa0ae");
        pixel(x + 23, y + 14, 1, 2, "#aaa0ae");
        pixel(x + 12, y + 16, 14, 3, "#665f79");
        pixel(x + 14, y + 16, 3, 1, "#dfc3ac");
        pixel(x + 20, y + 16, 3, 1, "#dfc3ac");
        if (phase % 3 < .4) pixel(x + 17, y + 19, 1, 1, "#de8a99");
    }

    const approach = (value, target, step) => value + Math.sign(target - value) * Math.min(Math.abs(target - value), step);

    function sit(p, bench, time) {
        bench.person = p;
        p.bench = bench;
        p.x = bench.x + 4;
        p.y = 294;
        p.state = "sitting";
        p.until = time + between(10, 35);
    }

    function updatePerson(p, dt, time, canSit) {
        if (p.state === "sitting") {
            if (time >= p.until) p.state = "leaving";
            return;
        }
        if (p.state === "leaving") {
            p.y = approach(p.y, p.homeY, dt * 2);
            if (p.y === p.homeY) {
                p.bench.person = null;
                p.bench = null;
                p.state = "walking";
                p.nextDecision = time + between(20, 50);
            }
            return;
        }
        if (p.state === "approaching") {
            p.x = approach(p.x, p.bench.x + 4, dt * Math.abs(p.speed));
            p.y = approach(p.y, 294, dt);
            if (p.x === p.bench.x + 4 && p.y === 294) sit(p, p.bench, time);
            return;
        }
        if (p.state === "paused" || p.state === "waiting") {
            if (time >= p.until) p.state = "walking";
            return;
        }
        p.x += p.speed * dt;
        if (p.x < -20 || p.x > 980) {
            p.x = p.speed > 0 ? -20 : 980;
            p.state = "waiting";
            p.until = time + between(1, 15);
            p.coat = choose(coats);
            return;
        }
        if (time < p.nextDecision) return;
        p.nextDecision = time + between(4, 12);
        const nearby = canSit ? benches.filter(b => !b.person && (b.x + 4 - p.x) * Math.sign(p.speed) >= 0 && Math.abs(b.x + 4 - p.x) < 45) : [];
        if (nearby.length && random() < .6) {
            p.bench = choose(nearby);
            p.bench.person = p; // Reserve on approach, preventing double occupancy.
            p.state = "approaching";
        } else if (random() < .16) {
            p.state = "paused";
            p.until = time + between(2, 7);
        }
    }

    const travelers = [...cars, ...boats, ...planes, ...airships];
    function updateTravel(actor, dt, time) {
        const margin = actor.kind === "airship" ? 180 : 40;
        if (actor.active) {
            actor.x += actor.direction * actor.speed * dt;
            if (actor.x < -margin || actor.x > 960 + margin) {
                actor.active = false;
                const delay = actor.kind === "car" ? [2, 12] : actor.kind === "airship" ? [25, 100] : [8, 50];
                actor.next = time + between(...delay);
            }
            return;
        }
        if (time < actor.next) return;
        if (actor.kind === "car") {
            const entry = actor.direction > 0 ? -margin : 960 + margin;
            if (cars.some(c => c !== actor && c.active && c.lane === actor.lane && Math.abs(c.x - entry) < 65)) {
                actor.next = time + 1;
                return;
            }
            actor.color = choose(coats);
            actor.bus = random() < .15;
        } else {
            actor.direction = choose([-1, 1]);
            actor.speed = actor.kind === "plane" ? between(15, 23) : between(5, 9);
            actor.width = choose([16, 25]);
            if (actor.kind === "airship") actor.text = choose(messages);
        }
        actor.x = actor.direction > 0 ? -margin : 960 + margin;
        actor.active = true;
    }

    // Some visits are already underway when the page opens.
    for (const bench of benches) {
        if (random() < .35) sit(choose(people.filter(p => !p.bench)), bench, -between(0, 5));
    }
    for (const w of windows) w.el.setAttribute("fill", w.on ? w.original : "#293647");

    function update(dt, time) {
        farPeople.forEach(p => updatePerson(p, dt, time, false));
        people.forEach(p => updatePerson(p, dt, time, true));
        travelers.forEach(actor => updateTravel(actor, dt, time));
        updateStar(time);
    }

    function draw(time) {
        ctx.clearRect(0, 0, 960, 320);
        drawStar(time);
        planes.forEach(plane => aircraft(plane, time));
        airships.forEach(ship => airship(ship, time));
        // Sidewalk pedestrians are behind traffic; waterfront walkers are in front.
        farPeople.sort((a, b) => a.y - b.y).forEach(p => pedestrian(p, time));
        cars.filter(c => !c.lane).forEach(c => car(c, time));
        cars.filter(c => c.lane).forEach(c => car(c, time));
        people.sort((a, b) => a.y - b.y).forEach(p => pedestrian(p, time));
        boats.forEach(b => boat(b, time));
    }

    function updateLights(time) {
        for (const w of windows) {
            if (time < w.next) continue;
            w.on = !w.on;
            w.el.setAttribute("fill", w.on ? w.original : "#293647");
            w.next = time + 8 + random() * 35;
        }
        for (const b of beacons) {
            const on = (time + b.phase) % b.period < .45;
            if (on === b.on) continue;
            b.on = on;
            b.el.setAttribute("fill", on ? b.original : "#81566e");
        }
    }

    let visible = false;
    let frame = null;
    let previous = null;
    let time = 0;
    function tick(now) {
        frame = null;
        if (previous === null) previous = now;
        const elapsed = (now - previous) / 1000;
        if (elapsed >= 1 / 30) {
            const dt = Math.min(elapsed, .1);
            time += dt;
            previous = now;
            update(dt, time);
            draw(time);
            updateLights(time);
        }
        frame = requestAnimationFrame(tick);
    }
    function sync() {
        const running = visible && !document.hidden;
        if (!running) {
            if (frame !== null) cancelAnimationFrame(frame);
            frame = null;
            previous = null;
        } else if (frame === null) {
            frame = requestAnimationFrame(tick);
        }
    }
    draw(0);
    const observer = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        sync();
    });
    observer.observe(city);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pagehide", () => { visible = false; sync(); });
    window.addEventListener("pageshow", () => {
        // Re-observe after back/forward cache restoration.
        observer.unobserve(city);
        observer.observe(city);
    });
})();
