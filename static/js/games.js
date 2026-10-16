(() => {
    const header = document.querySelector("#site-header-inner");
    const title = document.querySelector("#site-name");
    const canvas = document.querySelector("#snake-canvas");

    if (!header || !title || !canvas || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        return;
    }

    const ctx = canvas.getContext("2d");
    const pressed = new Set();
    let load_timer = 0;
    let hover_timer = 0;
    let load_index = 0;
    let loading = false;
    let letters = [];
    let active = false;
    let raf = 0;
    let last_time = 0;
    let game = null;
    let last_game = -1;
    let width = 1;
    let height = 1;

    canvas.tabIndex = 0;

    function css(name, fallback) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    }

    function accent_gradient(g) {
        const gradient = g.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, css("--accent", "#c78f8f"));
        gradient.addColorStop(1, css("--accent-gradient-end", "#927da8"));
        return gradient;
    }

    function font(size, weight = 400) {
        const family = getComputedStyle(document.body).fontFamily;
        return `${weight} ${size}px ${family}`;
    }

    function resize_canvas() {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        width = Math.max(1, rect.width);
        height = Math.max(1, rect.height);
        canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas.height = Math.max(1, Math.floor(height * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
    }

    function clear() {
        ctx.clearRect(0, 0, width, height);
    }

    function random_int(max) {
        return Math.floor(Math.random() * max);
    }

    function read_hi_score(name) {
        try {
            const value = Number.parseInt(localStorage.getItem(`arckmed-hi-${name}`) || "0", 10);
            return Number.isFinite(value) && value > 0 ? value : 0;
        } catch {
            return 0;
        }
    }

    function save_hi_score(name, value) {
        try {
            localStorage.setItem(`arckmed-hi-${name}`, String(value));
        } catch {
            // hi-scores remain session-only when storage is unavailable.
        }
    }

    function raise_hi_score(name, score, hi_score) {
        if (score <= hi_score) return hi_score;
        save_hi_score(name, score);
        return score;
    }

    function prepare_title() {
        const text = title.textContent;
        title.textContent = "";
        letters = [...text].map(ch => {
            const span = document.createElement("span");
            span.className = "snake-letter";
            span.textContent = ch;
            title.appendChild(span);
            return span;
        });
    }

    function reset_loader() {
        window.clearTimeout(hover_timer);
        hover_timer = 0;
        window.clearInterval(load_timer);
        load_timer = 0;
        load_index = 0;
        loading = false;
        for (const letter of letters) letter.classList.remove("snake-loaded");
    }

    function start_loader() {
        if (active || loading || hover_timer) return;

        hover_timer = window.setTimeout(() => {
            hover_timer = 0;
            loading = true;
            load_index = 0;

            function load_next() {
                if (load_index >= letters.length) {
                    window.clearInterval(load_timer);
                    load_timer = 0;
                    loading = false;
                    open_game();
                    return;
                }

                letters[load_index].classList.add("snake-loaded");
                load_index += 1;
            }

            load_next();
            load_timer = window.setInterval(load_next, 125);
        }, 800);
    }

    function choose_game() {
        const factories = [make_snake, make_pong, make_breakout, make_bit_kill];
        let index = random_int(factories.length);
        if (factories.length > 1 && index === last_game) {
            index = (index + 1 + random_int(factories.length - 1)) % factories.length;
        }
        last_game = index;
        return factories[index]();
    }

    function open_game() {
        if (active) return;
        active = true;
        header.classList.add("snake-active");
        requestAnimationFrame(() => {
            resize_canvas();
            game = choose_game();
            game.init(width, height);
            canvas.focus();
            last_time = performance.now();
            raf = requestAnimationFrame(frame);
        });
    }

    function close_game() {
        if (!active) return;
        active = false;
        cancelAnimationFrame(raf);
        raf = 0;
        pressed.clear();
        if (game && game.destroy) game.destroy();
        game = null;
        header.classList.remove("snake-active");
        clear();
        reset_loader();
    }

    function frame(now) {
        if (!active || !game) return;
        const dt = Math.min(0.05, Math.max(0, (now - last_time) / 1000));
        last_time = now;
        game.update(dt);
        clear();
        game.draw(ctx);
        raf = requestAnimationFrame(frame);
    }

    function make_snake() {
        const cell = 10;
        const start_tick = 0.095;
        const min_tick = 0.045;
        const tick_drop = 0.004;
        let tick = start_tick;
        let acc = 0;
        let cols = 0;
        let rows = 0;
        let snake = [];
        let food = { x: 0, y: 0 };
        let dir = { x: 1, y: 0 };
        let next = { x: 1, y: 0 };
        let score = 0;
        let hi_score = read_hi_score("snake");

        function place_food() {
            do {
                food.x = random_int(cols);
                food.y = random_int(rows);
            } while (snake.some(p => p.x === food.x && p.y === food.y));
        }

        function reset() {
            cols = Math.max(8, Math.floor(width / cell));
            rows = Math.max(6, Math.floor(height / cell));
            const x = Math.floor(cols / 3);
            const y = Math.floor(rows / 2);
            snake = [{ x, y }, { x: x - 1, y }, { x: x - 2, y }];
            dir = { x: 1, y: 0 };
            next = { x: 1, y: 0 };
            acc = 0;
            tick = start_tick;
            score = 0;
            place_food();
        }

        function step() {
            dir = next;
            const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
            const hit_wall = head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows;
            const hit_self = snake.some(p => p.x === head.x && p.y === head.y);
            if (hit_wall || hit_self) {
                reset();
                return;
            }
            snake.unshift(head);
            if (head.x === food.x && head.y === food.y) {
                score += 1;
                tick = Math.max(min_tick, tick - tick_drop);
                hi_score = raise_hi_score("snake", score, hi_score);
                place_food();
            } else {
                snake.pop();
            }
        }

        return {
            init() {
                reset();
            },
            update(dt) {
                acc += dt;
                while (acc >= tick) {
                    acc -= tick;
                    step();
                }
            },
            draw(g) {
                g.fillStyle = css("--text", "#e3e3e3");
                g.fillRect(food.x * cell + 2, food.y * cell + 2, cell - 4, cell - 4);
                g.fillStyle = accent_gradient(g);
                for (const p of snake) {
                    g.fillRect(p.x * cell + 1, p.y * cell + 1, cell - 2, cell - 2);
                }
                g.font = font(11);
                g.textAlign = "right";
                g.fillStyle = css("--muted", "#a0a0a0");
                g.fillText(`score ${String(score).padStart(4, "0")}  hi ${String(hi_score).padStart(4, "0")}`, width - 10, 14);
            },
            key(key) {
                const keys = {
                    ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, W: { x: 0, y: -1 },
                    ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, S: { x: 0, y: 1 },
                    ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, A: { x: -1, y: 0 },
                    ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }, D: { x: 1, y: 0 }
                };
                const wanted = keys[key];
                if (!wanted) return false;
                if (wanted.x !== -dir.x || wanted.y !== -dir.y) next = wanted;
                return true;
            }
        };
    }

    function make_pong() {
        let left_y = 0;
        let right_y = 0;
        let ball_x = 0;
        let ball_y = 0;
        let vx = 0;
        let vy = 0;
        let left_score = 0;
        let right_score = 0;
        let rally_time = 0;
        let trail = [];
        let hi_score = read_hi_score("pong");
        const paddle_h = 52;
        const paddle_w = 6;
        const ball_s = 6;
        const base_speed = 305;
        const max_speed = 1800;
        const accel_per_second = 32;

        function serve(direction) {
            ball_x = width / 2;
            ball_y = height / 2;
            rally_time = 0;
            trail = [];
            const angle = (Math.random() * 0.8 - 0.4);
            vx = Math.cos(angle) * base_speed * direction;
            vy = Math.sin(angle) * base_speed;
        }

        function cap_ball_speed() {
            const current_speed = Math.hypot(vx, vy);
            if (current_speed <= max_speed || current_speed <= 0) return;
            const scale = max_speed / current_speed;
            vx *= scale;
            vy *= scale;
        }

        function gently_accelerate(dt) {
            const current_speed = Math.hypot(vx, vy);
            if (current_speed <= 0 || current_speed >= max_speed) return;
            const next_speed = Math.min(max_speed, current_speed + accel_per_second * dt);
            const scale = next_speed / current_speed;
            vx *= scale;
            vy *= scale;
        }

        function remember_ball() {
            trail.unshift({ x: ball_x + ball_s / 2, y: ball_y + ball_s / 2 });
            if (trail.length > 36) trail.length = 36;
        }

        function draw_trail(g, accent, muted) {
            const speed = Math.hypot(vx, vy);
            const ratio = Math.min(1, speed / max_speed);
            if (ratio < 0.8 || trail.length < 2) return;

            const intensity = (ratio - 0.8) / 0.2;
            const count = Math.min(trail.length, 5 + Math.round(intensity * 31));
            const side_x = speed > 0 ? -vy / speed : 0;
            const side_y = speed > 0 ? vx / speed : 0;

            for (let i = count - 1; i >= 1; i--) {
                const point = trail[i];
                const age = 1 - i / count;
                const size = 1 + Math.floor(age * (1 + intensity * 2));
                g.globalAlpha = 0.10 + age * (0.25 + intensity * 0.35);
                g.fillStyle = age > 0.72 ? accent : muted;
                g.fillRect(Math.round(point.x - size / 2), Math.round(point.y - size / 2), size, size);

                if (intensity > 0.35 && i % 3 === 0) {
                    const spread = 2 + Math.round(intensity * 7);
                    const side = i % 2 === 0 ? 1 : -1;
                    const spark_x = point.x + side_x * spread * side;
                    const spark_y = point.y + side_y * spread * side;
                    const spark_size = intensity > 0.75 && i % 6 === 0 ? 2 : 1;
                    g.globalAlpha *= 0.75;
                    g.fillStyle = accent;
                    g.fillRect(Math.round(spark_x), Math.round(spark_y), spark_size, spark_size);
                }
            }
            g.globalAlpha = 1;
        }

        return {
            init() {
                left_y = (height - paddle_h) / 2;
                right_y = left_y;
                left_score = 0;
                right_score = 0;
                serve(Math.random() < 0.5 ? -1 : 1);
            },
            update(dt) {
                rally_time += dt;
                gently_accelerate(dt);
                const move = 255 * dt;
                if (pressed.has("ArrowUp") || pressed.has("w") || pressed.has("W")) left_y -= move;
                if (pressed.has("ArrowDown") || pressed.has("s") || pressed.has("S")) left_y += move;
                left_y = Math.max(0, Math.min(height - paddle_h, left_y));

                let target = (height - paddle_h) / 2;
                if (vx > 0) {
                    const right_x = width - 14 - paddle_w;
                    const time_to_paddle = Math.max(0, (right_x - ball_x) / vx);
                    const travel_h = Math.max(1, height - ball_s);
                    let projected_y = ball_y + vy * time_to_paddle;
                    const period = travel_h * 2;
                    projected_y = ((projected_y % period) + period) % period;
                    if (projected_y > travel_h) projected_y = period - projected_y;
                    target = projected_y + ball_s / 2 - paddle_h / 2;
                }
                const ai_step = 245 * dt;
                if (right_y < target) right_y = Math.min(target, right_y + ai_step);
                if (right_y > target) right_y = Math.max(target, right_y - ai_step);
                right_y = Math.max(0, Math.min(height - paddle_h, right_y));

                const prev_ball_x = ball_x;
                const prev_ball_y = ball_y;
                ball_x += vx * dt;
                ball_y += vy * dt;
                remember_ball();

                if (ball_y <= 0) {
                    ball_y = 0;
                    vy = Math.abs(vy);
                }
                if (ball_y + ball_s >= height) {
                    ball_y = height - ball_s;
                    vy = -Math.abs(vy);
                }

                const left_x = 14;
                const right_x = width - 14 - paddle_w;
                const left_plane = left_x + paddle_w;
                const right_plane = right_x;

                if (vx < 0 && prev_ball_x >= left_plane && ball_x <= left_plane) {
                    const distance = prev_ball_x - ball_x;
                    const t = distance > 0 ? (prev_ball_x - left_plane) / distance : 0;
                    const hit_y = prev_ball_y + (ball_y - prev_ball_y) * Math.max(0, Math.min(1, t));
                    if (hit_y + ball_s >= left_y && hit_y <= left_y + paddle_h) {
                        ball_x = left_plane;
                        ball_y = hit_y;
                        vx = Math.abs(vx);
                        vy += ((hit_y + ball_s / 2) - (left_y + paddle_h / 2)) * 3.3;
                        cap_ball_speed();
                    }
                }
                if (vx > 0 && prev_ball_x + ball_s <= right_plane && ball_x + ball_s >= right_plane) {
                    const prev_right = prev_ball_x + ball_s;
                    const current_right = ball_x + ball_s;
                    const distance = current_right - prev_right;
                    const t = distance > 0 ? (right_plane - prev_right) / distance : 0;
                    const hit_y = prev_ball_y + (ball_y - prev_ball_y) * Math.max(0, Math.min(1, t));
                    if (hit_y + ball_s >= right_y && hit_y <= right_y + paddle_h) {
                        ball_x = right_plane - ball_s;
                        ball_y = hit_y;
                        vx = -Math.abs(vx);
                        vy += ((hit_y + ball_s / 2) - (right_y + paddle_h / 2)) * 3.3;
                        cap_ball_speed();
                    }
                }

                if (ball_x + ball_s < 0) {
                    right_score += 1;
                    serve(1);
                } else if (ball_x > width) {
                    left_score += 1;
                    hi_score = raise_hi_score("pong", left_score, hi_score);
                    serve(-1);
                }
            },
            draw(g) {
                const text = css("--text", "#e3e3e3");
                const accent = accent_gradient(g);
                const muted = css("--muted", "#a0a0a0");
                draw_trail(g, accent, muted);
                g.fillStyle = accent;
                g.fillRect(14, left_y, paddle_w, paddle_h);
                g.fillStyle = muted;
                g.fillRect(width - 14 - paddle_w, right_y, paddle_w, paddle_h);
                g.fillStyle = text;
                g.fillRect(ball_x, ball_y, ball_s, ball_s);
                g.font = font(12);
                g.textAlign = "center";
                g.fillStyle = muted;
                g.fillText(`${left_score} : ${right_score}`, width / 2, 18);
                g.textAlign = "right";
                g.fillText(`hi ${String(hi_score).padStart(4, "0")}`, width - 10, 14);
            },
            key(key) {
                return ["ArrowUp", "ArrowDown", "w", "W", "s", "S"].includes(key);
            }
        };
    }

    function make_breakout() {
        const gap = 4;
        const margin = 18;
        const brick_h = 13;
        const paddle_w = 76;
        const paddle_h = 7;
        const ball_s = 6;
        const level_profiles = [
            { rows: 3, cols: 10, missing: 0.04, extra: 1, tough: 0.04, base_speed: 250, speed_cap: 430, accel: 8 },
            { rows: 4, cols: 10, missing: 0.06, extra: 2, tough: 0.06, base_speed: 275, speed_cap: 500, accel: 9 },
            { rows: 4, cols: 11, missing: 0.08, extra: 3, tough: 0.09, base_speed: 300, speed_cap: 570, accel: 10 },
            { rows: 5, cols: 10, missing: 0.10, extra: 3, tough: 0.12, base_speed: 325, speed_cap: 640, accel: 11 },
            { rows: 5, cols: 11, missing: 0.12, extra: 4, tough: 0.16, base_speed: 350, speed_cap: 710, accel: 12 }
        ];

        let bricks = [];
        let layer_colors = [];
        let paddle_x = 0;
        let ball_x = 0;
        let ball_y = 0;
        let vx = 0;
        let vy = 0;
        let score = 0;
        let hi_score = read_hi_score("breakout");
        let level = 1;
        let field_serial = 0;

        function profile() {
            return level_profiles[level - 1];
        }

        function random_layer_colors(count) {
            const base = Math.floor(Math.random() * 360);
            const colors = [];
            for (let i = 0; i < count; ++i) {
                colors.push(`hsl(${(base + i * 71) % 360} 48% 56%)`);
            }
            return colors;
        }

        function ball_speed() {
            return Math.hypot(vx, vy);
        }

        function normalize_ball_speed(target_speed) {
            const speed = ball_speed();
            if (speed <= 0.001) return;
            const scale = target_speed / speed;
            vx *= scale;
            vy *= scale;
        }

        function accelerate_ball(multiplier = 1) {
            const p = profile();
            const speed = ball_speed();
            const next = Math.min(p.speed_cap, speed + p.accel * multiplier);
            normalize_ball_speed(next);
        }

        function reset_ball() {
            const p = profile();
            paddle_x = Math.max(0, Math.min(width - paddle_w, paddle_x || (width - paddle_w) / 2));
            ball_x = width / 2 - ball_s / 2;
            ball_y = height - 45;

            const horizontal = p.base_speed * (0.54 + Math.random() * 0.08);
            vx = (Math.random() < 0.5 ? -1 : 1) * horizontal;
            vy = -Math.sqrt(Math.max(1, p.base_speed * p.base_speed - vx * vx));
        }

        function shuffled_columns(cols) {
            const values = Array.from({ length: cols }, (_, i) => i);
            for (let i = values.length - 1; i > 0; --i) {
                const j = Math.floor(Math.random() * (i + 1));
                [values[i], values[j]] = [values[j], values[i]];
            }
            return values;
        }

        function build_level() {
            const p = profile();
            bricks = [];
            field_serial += 1;
            const has_extra_row = p.extra > 0;
            const row_offset = has_extra_row ? 1 : 0;
            const visual_rows = p.rows + row_offset;
            layer_colors = random_layer_colors(visual_rows);

            for (let y = 0; y < p.rows; ++y) {
                const base_hp = Math.min(3, p.rows - y);
                for (let x = 0; x < p.cols; ++x) {
                    const edge = x === 0 || x === p.cols - 1;
                    const protected_cell = (x + y + field_serial) % 7 === 0;
                    const missing = !edge && !protected_cell && Math.random() < p.missing;
                    if (missing) continue;

                    let max_hp = base_hp;
                    if (Math.random() < p.tough) max_hp = Math.min(4, max_hp + 1);

                    bricks.push({
                        x,
                        y: y + row_offset,
                        hp: max_hp,
                        max_hp,
                        alive: true,
                        color_index: Math.min(visual_rows - 1, y + row_offset)
                    });
                }
            }

            if (has_extra_row) {
                const candidates = shuffled_columns(p.cols);
                const count = Math.min(p.extra, candidates.length);
                for (let i = 0; i < count; ++i) {
                    const x = candidates[i];
                    const max_hp = Math.random() < 0.35 + p.tough ? 3 : 2;
                    bricks.push({ x, y: 0, hp: max_hp, max_hp, alive: true, color_index: 0 });
                }
            }
        }

        function brick_width() {
            const p = profile();
            return (width - margin * 2 - gap * (p.cols - 1)) / p.cols;
        }

        function brick_rect(brick) {
            const bw = brick_width();
            return {
                x: margin + brick.x * (bw + gap),
                y: 18 + brick.y * (brick_h + gap),
                w: bw,
                h: brick_h
            };
        }

        function damage_brick(brick) {
            brick.hp -= 1;
            accelerate_ball(1);
            if (brick.hp <= 0) {
                brick.alive = false;
                score += 1;
                hi_score = raise_hi_score("breakout", score, hi_score);
            }
        }

        function bounce_from_brick(brick, previous_x, previous_y) {
            const r = brick_rect(brick);
            const previous_right = previous_x + ball_s;
            const previous_bottom = previous_y + ball_s;

            if (previous_bottom <= r.y && vy > 0) {
                ball_y = r.y - ball_s;
                vy = -Math.abs(vy);
            } else if (previous_y >= r.y + r.h && vy < 0) {
                ball_y = r.y + r.h;
                vy = Math.abs(vy);
            } else if (previous_right <= r.x && vx > 0) {
                ball_x = r.x - ball_s;
                vx = -Math.abs(vx);
            } else if (previous_x >= r.x + r.w && vx < 0) {
                ball_x = r.x + r.w;
                vx = Math.abs(vx);
            } else {
                vy = -vy;
            }
        }

        function overlaps_brick(brick) {
            const r = brick_rect(brick);
            return ball_x + ball_s >= r.x && ball_x <= r.x + r.w && ball_y + ball_s >= r.y && ball_y <= r.y + r.h;
        }

        function advance_ball(dt) {
            const distance = Math.max(Math.abs(vx), Math.abs(vy)) * dt;
            const steps = Math.max(1, Math.min(10, Math.ceil(distance / Math.max(2, ball_s * 0.55))));
            const step_dt = dt / steps;

            for (let step = 0; step < steps; ++step) {
                const previous_x = ball_x;
                const previous_y = ball_y;
                ball_x += vx * step_dt;
                ball_y += vy * step_dt;

                if (ball_x <= 0) {
                    ball_x = 0;
                    vx = Math.abs(vx);
                } else if (ball_x + ball_s >= width) {
                    ball_x = width - ball_s;
                    vx = -Math.abs(vx);
                }

                if (ball_y <= 0) {
                    ball_y = 0;
                    vy = Math.abs(vy);
                }

                const paddle_y = height - 18;
                if (vy > 0 && ball_y + ball_s >= paddle_y && previous_y + ball_s <= paddle_y + Math.max(3, Math.abs(vy * step_dt)) && ball_x + ball_s >= paddle_x && ball_x <= paddle_x + paddle_w) {
                    ball_y = paddle_y - ball_s;
                    const speed_before = ball_speed();
                    const offset = ((ball_x + ball_s / 2) - (paddle_x + paddle_w / 2)) / (paddle_w / 2);
                    vx += offset * 95;
                    vy = -Math.max(90, Math.abs(vy));
                    normalize_ball_speed(speed_before);
                    accelerate_ball(0.6);
                }

                for (const brick of bricks) {
                    if (!brick.alive || !overlaps_brick(brick)) continue;
                    damage_brick(brick);
                    bounce_from_brick(brick, previous_x, previous_y);
                    break;
                }

                if (ball_y > height) return false;
            }
            return true;
        }

        function lose_ball() {
            score = 0;
            reset_ball();
        }

        function complete_level() {
            level = level >= level_profiles.length ? 1 : level + 1;
            build_level();
            reset_ball();
        }

        return {
            init() {
                score = 0;
                level = 1;
                paddle_x = (width - paddle_w) / 2;
                build_level();
                reset_ball();
            },
            update(dt) {
                const paddle_speed = 310 + (level - 1) * 12;
                const move = paddle_speed * dt;
                if (pressed.has("ArrowLeft") || pressed.has("a") || pressed.has("A")) paddle_x -= move;
                if (pressed.has("ArrowRight") || pressed.has("d") || pressed.has("D")) paddle_x += move;
                paddle_x = Math.max(0, Math.min(width - paddle_w, paddle_x));

                if (!advance_ball(dt)) {
                    lose_ball();
                    return;
                }

                if (bricks.every(brick => !brick.alive)) complete_level();
            },
            draw(g) {
                const accent = accent_gradient(g);
                const text = css("--text", "#e3e3e3");
                const border = css("--border", "#444444");
                const muted = css("--muted", "#a0a0a0");

                for (const brick of bricks) {
                    if (!brick.alive) continue;
                    const r = brick_rect(brick);
                    const health = brick.hp / brick.max_hp;
                    const alpha = 0.24 + health * 0.68;

                    g.save();
                    g.globalAlpha = alpha;
                    g.fillStyle = layer_colors[brick.color_index % layer_colors.length];
                    g.fillRect(Math.round(r.x), Math.round(r.y), Math.max(1, Math.floor(r.w - 1)), r.h);
                    g.globalAlpha = Math.min(1, alpha + 0.12);
                    g.strokeStyle = border;
                    g.lineWidth = 1;
                    g.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, Math.max(1, r.w - 1), r.h);
                    g.restore();
                }

                g.fillStyle = accent;
                g.fillRect(paddle_x, height - 18, paddle_w, paddle_h);
                g.fillStyle = text;
                g.fillRect(ball_x, ball_y, ball_s, ball_s);

                g.font = font(11);
                g.textAlign = "left";
                g.fillStyle = muted;
                g.fillText(`level ${level}/${level_profiles.length}`, 10, 13);
                g.textAlign = "right";
                g.fillText(`score ${String(score).padStart(4, "0")}  hi ${String(hi_score).padStart(4, "0")}`, width - 10, 13);
            },
            key(key) {
                return ["ArrowLeft", "ArrowRight", "a", "A", "d", "D"].includes(key);
            }
        };
    }

    function make_bit_kill() {
        const key_map = { a: 0, s: 1, d: 2, f: 3, h: 4, j: 5, k: 6, l: 7 };
        const key_labels = ["A", "S", "D", "F", "H", "J", "K", "L"];
        let bits = new Array(8).fill(0);
        let cursor = 0;
        let cursor_visible = false;
        let drops = [];
        let bursts = [];
        let score = 0;
        let hi_score = read_hi_score("bit-kill");
        let lives = 3;
        let elapsed = 0;
        let spawn_acc = 0;
        let game_over_time = 0;

        function value() {
            let out = 0;
            for (const bit of bits) out = (out << 1) | bit;
            return out;
        }

        function reset_round(reset_score = true) {
            bits = new Array(8).fill(0);
            cursor = 0;
            cursor_visible = false;
            drops = [];
            bursts = [];
            lives = 3;
            elapsed = 0;
            spawn_acc = 0;
            game_over_time = 0;
            if (reset_score) score = 0;
        }

        function max_drops() {
            return elapsed < 15 ? 1 : 2;
        }

        function spawn_interval() {
            return Math.max(2.4, 5.0 - Math.max(0, elapsed - 10) * 0.028);
        }

        function spawn() {
            const current = value();
            let v = random_int(256);
            let tries = 0;
            while ((v === current || drops.some(d => d.value === v)) && tries < 32) {
                v = random_int(256);
                tries += 1;
            }
            drops.push({
                value: v,
                x: 20 + Math.random() * Math.max(1, width - 78),
                y: -8,
                speed: 19 + Math.random() * 9 + Math.min(18, elapsed * 0.065)
            });
        }

        function add_burst(x, y) {
            const particles = [];
            const dirs = [
                [-1, 0], [1, 0], [0, -1], [0, 1],
                [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]
            ];
            for (const [dx, dy] of dirs) {
                particles.push({ dx, dy });
            }
            bursts.push({ x, y, life: 0.24, particles });
        }

        function check_match() {
            const target = value();
            let index = -1;
            let best_y = -Infinity;
            for (let i = 0; i < drops.length; i++) {
                if (drops[i].value === target && drops[i].y > best_y) {
                    best_y = drops[i].y;
                    index = i;
                }
            }
            if (index < 0) return;
            const hit = drops[index];
            drops.splice(index, 1);
            add_burst(hit.x + 16, hit.y);
            score += 1;
            hi_score = raise_hi_score("bit-kill", score, hi_score);
            bits = new Array(8).fill(0);
        }

        function flip(index) {
            if (game_over_time > 0) return;
            bits[index] ^= 1;
            check_match();
        }

        return {
            init() {
                reset_round(true);
            },
            update(dt) {
                if (game_over_time > 0) {
                    game_over_time -= dt;
                    for (const burst of bursts) burst.life -= dt;
                    bursts = bursts.filter(b => b.life > 0);
                    if (game_over_time <= 0) reset_round(true);
                    return;
                }

                elapsed += dt;
                spawn_acc += dt;
                const interval = spawn_interval();
                if (spawn_acc >= interval && drops.length < max_drops()) {
                    spawn_acc -= interval;
                    spawn();
                }

                const bits_y = height - 52;
                const ground_y = bits_y - 34;
                for (const drop of drops) drop.y += drop.speed * dt;

                const missed = drops.filter(drop => drop.y >= ground_y);
                if (missed.length) {
                    drops = drops.filter(drop => drop.y < ground_y);
                    lives = Math.max(0, lives - missed.length);
                    if (lives <= 0) game_over_time = 0.85;
                }

                for (const burst of bursts) burst.life -= dt;
                bursts = bursts.filter(b => b.life > 0);
            },
            draw(g) {
                const accent = accent_gradient(g);
                const text = css("--text", "#e3e3e3");
                const muted = css("--muted", "#a0a0a0");
                const border = css("--border", "#444444");
                const cell_w = 32;
                const cell_h = 28;
                const gap = 6;
                const total_w = cell_w * 8 + gap * 7;
                const start_x = Math.max(16, (width - total_w) / 2 - 22);
                const bits_y = height - 58;
                const keys_y = height - 20;

                g.font = font(13);
                g.textBaseline = "middle";
                g.textAlign = "left";
                for (const drop of drops) {
                    const label = `0x${drop.value.toString(16).toUpperCase().padStart(2, "0")}`;
                    g.fillStyle = text;
                    g.fillText(label, drop.x, drop.y);
                }

                g.font = font(16, 500);
                g.textAlign = "center";
                for (let i = 0; i < 8; i++) {
                    const x = start_x + i * (cell_w + gap);
                    const selected = cursor_visible && i === cursor;
                    g.strokeStyle = selected ? accent : border;
                    g.lineWidth = 1;
                    g.strokeRect(Math.round(x) + 0.5, Math.round(bits_y - cell_h / 2) + 0.5, cell_w, cell_h);
                    g.fillStyle = selected ? accent : text;
                    g.fillText(String(bits[i]), x + cell_w / 2, bits_y + 1);
                }

                g.font = font(9);
                for (let i = 0; i < 8; i++) {
                    const x = start_x + i * (cell_w + gap) + cell_w / 2;
                    g.fillStyle = muted;
                    g.fillText(key_labels[i], x, keys_y);
                }

                if (cursor_visible) {
                    const x = start_x + cursor * (cell_w + gap) + cell_w / 2;
                    g.fillStyle = accent;
                    g.font = font(10);
                    g.fillText("^", x, bits_y - cell_h / 2 - 10);
                }

                g.textAlign = "left";
                g.fillStyle = muted;
                g.font = font(10);
                g.fillText("←↑↓→", start_x + total_w + 18, bits_y);

                g.font = font(11);
                g.fillStyle = muted;
                g.textAlign = "left";
                g.fillText(`lives ${lives}`, 10, 14);
                g.textAlign = "right";
                g.fillText(`score ${String(score).padStart(4, "0")}`, width - 10, 14);
                g.fillText(`hi ${String(hi_score).padStart(4, "0")}`, width - 10, 29);

                for (const burst of bursts) {
                    const t = 1 - Math.max(0, burst.life) / 0.24;
                    const distance = 4 + t * 13;
                    g.globalAlpha = Math.max(0, burst.life / 0.24);
                    g.fillStyle = accent;
                    for (const particle of burst.particles) {
                        const x = burst.x + particle.dx * distance;
                        const y = burst.y + particle.dy * distance;
                        g.fillRect(Math.round(x), Math.round(y), 2, 2);
                    }
                    g.globalAlpha = 1;
                }

                if (game_over_time > 0) {
                    g.textAlign = "center";
                    g.fillStyle = accent;
                    g.font = font(12, 500);
                    g.fillText("0 lives", width / 2, height / 2);
                }
            },
            key(key, repeat) {
                const lower = key.toLowerCase();
                if (Object.prototype.hasOwnProperty.call(key_map, lower)) {
                    if (!repeat) flip(key_map[lower]);
                    cursor_visible = false;
                    return true;
                }

                if (key === "ArrowLeft") {
                    cursor_visible = true;
                    cursor = (cursor + 7) % 8;
                    return true;
                }
                if (key === "ArrowRight") {
                    cursor_visible = true;
                    cursor = (cursor + 1) % 8;
                    return true;
                }
                if (key === "ArrowUp" || key === "ArrowDown") {
                    cursor_visible = true;
                    if (!repeat) flip(cursor);
                    return true;
                }
                return false;
            }
        };
    }

    prepare_title();

    title.addEventListener("mouseenter", start_loader);
    title.addEventListener("mouseleave", () => {
        if (!active) reset_loader();
    });

    window.addEventListener("keydown", event => {
        if (!active || !game) return;
        if (event.code === "Space" || event.key === " ") {
            event.preventDefault();
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            close_game();
            return;
        }

        pressed.add(event.key);
        if (game.key && game.key(event.key, event.repeat)) event.preventDefault();
    });

    window.addEventListener("keyup", event => {
        pressed.delete(event.key);
    });

    window.addEventListener("blur", () => pressed.clear());

    window.addEventListener("resize", () => {
        if (!active || !game) return;
        resize_canvas();
        game.init(width, height);
    });
})();
