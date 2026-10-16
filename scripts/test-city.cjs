// Run with node scripts/test-city.cjs. No browser or dependencies required.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const code = fs.readFileSync(path.join(root, "static/js/city.js"), "utf8");
const svg = fs.readFileSync(path.join(root, "static/images/about-city.svg"), "utf8");
assert(svg.indexOf('class="city-sky"') > 0);
assert(svg.indexOf('class="city-sky"') < svg.indexOf('<!-- Distant city:'), "Sky canvas must paint behind every building");

function scene({ reduced = false, missing = false, noCanvas = false, legacySky = false, seed = 317 } = {}) {
    let rectangles = [];
    let skyRectangles = [];
    const frames = new Map();
    let nextId = 0;
    const listeners = {};
    const media = { matches: reduced, addEventListener: (_, fn) => { listeners.motion = fn; } };
    const lights = type => [...svg.matchAll(new RegExp(`<rect data-city-${type}=""[^>]+>`, "g"))].map(match => {
        const attrs = Object.fromEntries([...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
        return { attrs, original: attrs.fill, getAttribute: key => attrs[key], setAttribute: (key, value) => { attrs[key] = value; } };
    });
    const windows = lights("window");
    const beacons = lights("beacon");
    const benchNodes = [...svg.matchAll(/data-city-bench="" data-x="(\d+)"/g)].map(m => ({ getAttribute: () => m[1] }));
    assert(windows.length > 30 && beacons.length > 20);
    const ctx = {
        fillStyle: "", clearRect: () => { rectangles = []; },
        fillRect: (x, y, w, h) => {
            assert([x, y, w, h].every(Number.isFinite));
            assert(w > 0 && h > 0);
            rectangles.push([x, y, w, h, ctx.fillStyle]);
        },
    };
    let foregrounds = 0;
    let insertedSky = 0;
    const skyCtx = {
        fillStyle: "", clearRect: () => { skyRectangles = []; },
        fillRect: (x, y, w, h) => { skyRectangles.push([x, y, w, h, skyCtx.fillStyle]); },
    };
    const city = {
        querySelector: selector => selector.startsWith('path[fill=') ? { before: () => { insertedSky++; } } : selector === ".city-sky" ? (legacySky ? null : { getContext: () => skyCtx }) : selector === ".city-activity"
            ? { getContext: () => noCanvas ? null : ctx }
            : { cloneNode: () => ({}) },
        querySelectorAll: selector => selector.includes("window") ? windows : selector.includes("bench") ? benchNodes : beacons,
        append: () => { foregrounds++; },
    };
    const document = {
        hidden: false, querySelector: () => missing ? null : city,
        createElementNS: (_, name) => ({ setAttribute() {}, append() {}, ...(name === "canvas" ? { getContext: () => skyCtx } : {}) }),
        addEventListener: (name, fn) => { listeners[name] = fn; },
    };
    let intersection;
    const math = Object.create(Math);
    math.random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const sandbox = {
        Math: math,
        document,
        window: { matchMedia: () => media, addEventListener: (name, fn) => { listeners[name] = fn; } },
        IntersectionObserver: class {
            constructor(fn) { intersection = fn; }
            observe() {} unobserve() {}
        },
        requestAnimationFrame: fn => { frames.set(++nextId, fn); return nextId; },
        cancelAnimationFrame: id => frames.delete(id),
    };
    // Inspect state only in this test VM; no debug API is shipped to the page.
    vm.runInNewContext(code.replace(/\}\)\(\);\s*$/, "globalThis.inspectCity = () => ({people, farPeople, benches, travelers, wishingStar, starPoint}); })();"), sandbox);
    return {
        frames, listeners, media, document, windows, beacons,
        inspect: () => sandbox.inspectCity(),
        get rectangles() { return rectangles; },
        get skyRectangles() { return skyRectangles; },
        get foregrounds() { return foregrounds; },
        get insertedSky() { return insertedSky; },
        visible(value) { intersection([{ isIntersecting: value }]); },
        tick(time) {
            const pending = [...frames.values()];
            frames.clear();
            pending.forEach(fn => fn(time));
            assert(frames.size <= 1, "Must never create competing animation loops");
        },
    };
}

assert.equal(scene({ missing: true }).frames.size, 0);
assert.equal(scene({ noCanvas: true }).foregrounds, 0);
const s = scene();
assert.equal(s.foregrounds, 1);
assert.equal(s.frames.size, 0, "Offscreen scene must not animate");
const initial = s.rectangles.slice();
assert.notDeepEqual(initial, scene({ seed: 829 }).rectangles, "Different visits must produce different starting scenes");
const visits = Array.from({ length: 12 }, (_, seed) => scene({ seed: seed + 1 }).inspect());
for (const kind of ["plane", "airship", "boat", "car"]) {
    const actors = visits.flatMap(v => [...v.travelers].filter(a => a.kind === kind));
    assert(actors.some(a => a.active) && actors.some(a => !a.active), `${kind} appearances must vary at startup`);
}
assert.equal(s.inspect().benches.length, 6);
s.visible(true);
assert.equal(s.frames.size, 1);
for (let t = 0; t <= 30000; t += 40) s.tick(t);
assert.notDeepEqual(s.rectangles, initial, "Actors must move");
assert(s.windows.some(w => w.attrs.fill !== w.original), "Windows must change over time");
const captures = [{ time: 0, rectangles: initial }, { time: 30, rectangles: s.rectangles.slice() }];
s.visible(false);
assert.equal(s.frames.size, 0);
s.visible(true);
s.document.hidden = true;
s.listeners.visibilitychange();
assert.equal(s.frames.size, 0, "Background tabs must stop");
s.document.hidden = false;
s.listeners.visibilitychange();
assert.equal(s.frames.size, 1);
s.media.matches = true;
assert.equal(s.frames.size, 1, "OS motion preference must not pause the city");
s.media.matches = false;
assert.equal(s.frames.size, 1);
s.listeners.pagehide();
assert.equal(s.frames.size, 0);
s.listeners.pageshow();
s.visible(true);
assert.equal(s.frames.size, 1, "Back navigation must resume");
let arrivals = 0, departures = 0, reseated = 0, previousPeople = new Map(), previousTravelers = new Map();
for (let t = 40000; t <= 340000; t += 40) {
    s.tick(t);
    const { people, farPeople, benches, travelers } = s.inspect();
    assert(farPeople.every(p => p.y >= 276 && p.y <= 277));
    assert(people.every(p => p.y >= 291 && p.y <= 294), "Walkers must not enter the road or river");
    for (const bench of benches) {
        const occupants = people.filter(p => p.bench === bench);
        assert(occupants.length <= 1, "Benches cannot be double-booked");
        assert.equal(occupants[0] || null, bench.person, "Reservations must match their walker");
    }
    for (const p of people) {
        if (p.state === "sitting") {
            assert.equal(p.x, p.bench.x + 4, "Seated walkers must align with the bench");
            if (previousPeople.get(p) === "approaching") {
                reseated++;
                if (reseated === 1) captures.push({ time: t / 1000, rectangles: s.rectangles.slice() });
            }
        }
        if (previousPeople.get(p) === "leaving" && p.state === "walking") departures++;
        previousPeople.set(p, p.state);
    }
    for (const a of travelers) {
        if (previousTravelers.get(a) === false && a.active) arrivals++;
        previousTravelers.set(a, a.active);
    }
}
assert(reseated > 0 && departures > 0, "Walkers must approach, sit, release the seat and resume walking");
assert(arrivals > 10, "Random events must keep arriving after the initial scene");
// Follow multiple natural star events, including their trailing fade and gaps.
const sky = scene({ seed: 91 });
sky.visible(true);
let starCount = 0, lastStart = -1, lastEnd = null, sawSkyStar = false;
const directions = new Set();
for (let t = 0; t <= 300000; t += 40) {
    sky.tick(t);
    const { wishingStar: star, starPoint } = sky.inspect();
    if (sky.skyRectangles.length) sawSkyStar = true;
    assert(!sky.rectangles.some(r => r[4] === "#ffffff"), "Star must never paint over the city activity layer");
    if (!star.active) {
        if (lastStart >= 0 && lastEnd === null) lastEnd = t;
        continue;
    }
    if (star.start === lastStart) continue;
    if (lastEnd !== null) assert(t - lastEnd >= 19900, "Stars must have quiet intervals");
    lastStart = star.start;
    lastEnd = null;
    starCount++;
    directions.add(star.direction);
    const start = starPoint(0), rising = starPoint(.1), end = starPoint(1);
    assert(rising.y < start.y && end.y > start.y, "Star must rise then descend into the skyline");
    assert(end.y >= 280, "Star must finish behind the opaque street, never in open sky");
    for (let p = 0; p <= 1; p += .01) {
        const point = starPoint(p);
        assert(point.x >= 2 && point.x <= 958 && point.y >= 2 && point.y <= 285, "Star must not vanish at a canvas edge");
    }
}
assert(starCount >= 4 && directions.size === 2, "Random stars must recur in both directions");
assert(sawSkyStar, "Star must render on the sky canvas");
const legacy = scene({ legacySky: true });
assert.equal(legacy.insertedSky, 1, "Older inline artwork must receive a sky canvas before the buildings");
legacy.visible(true);
let legacyStarVisible = false;
for (let t = 0; t <= 30000; t += 40) {
    legacy.tick(t);
    if (legacy.skyRectangles.length) legacyStarVisible = true;
}
assert(legacyStarVisible, "Updated JavaScript must show stars even with older inline artwork");
assert(new Set(visits.map(v => v.wishingStar.next)).size > 1, "First star timing must vary by visit");
console.log(`Shooting star checks passed: ${starCount} curved passes, both directions, random delays, behind-city layer and endpoints.`);
const reduced = scene({ reduced: true });
const reducedInitial = reduced.rectangles.slice();
reduced.visible(true);
assert.equal(reduced.frames.size, 1, "City must start even when OS animations are disabled");
for (let t = 0; t <= 1000; t += 40) reduced.tick(t);
assert.notDeepEqual(reduced.rectangles, reducedInitial, "Actors must move with reduced motion enabled");
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(captures));
console.log(`City checks passed: varied startup across 12 visits, ${arrivals} later arrivals, ${reseated} bench visits, ${departures} departures, no double occupancy, visibility and page restoration.`);
