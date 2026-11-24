const SHAPE_PATTERNS = [
    [[1]], [[1, 1, 1], [0, 1, 0]], [[0, 1, 0], [1, 1, 1]], [[1, 0], [1, 0], [1, 1]], [[1, 1], [0, 1], [0, 1]],
    [[1, 1], [1, 1]], // 2x2 Square
    [[1, 1, 1], [1, 1, 1], [1, 1, 1]], // 3x3 Square
    [[1, 1]], [[1], [1]], // 2x1
    [[1, 1, 1]], [[1], [1], [1]], // 3x1
    [[1, 1, 1, 1]], [[1], [1], [1], [1]], // 4x1
    [[1, 1, 1, 1, 1]], [[1], [1], [1], [1], [1]], // 5x1
    // 2x2 L-Shapes
    [[1, 1], [1, 0]], [[1, 1], [0, 1]], [[1, 0], [1, 1]], [[0, 1], [1, 1]],
    // 3x3 L-Shapes
    [[1, 1, 1], [1, 0, 0], [1, 0, 0]], [[1, 1, 1], [0, 0, 1], [0, 0, 1]],
    [[1, 0, 0], [1, 0, 0], [1, 1, 1]], [[0, 0, 1], [0, 0, 1], [1, 1, 1]],
    // T-Shapes
    [[1, 1, 1], [0, 1, 0], [0, 1, 0]], [[0, 1, 0], [0, 1, 0], [1, 1, 1]],
    [[1, 0, 0], [1, 1, 1], [1, 0, 0]], [[0, 0, 1], [1, 1, 1], [0, 0, 1]],
    // Rectangles and the remaining orientations of the four-block T, L, and J.
    [[1, 1, 1], [1, 1, 1]], [[1, 1], [1, 1], [1, 1]],
    [[1, 0], [1, 1], [1, 0]], [[0, 1], [1, 1], [0, 1]],
    [[0, 1], [0, 1], [1, 1]], [[1, 1], [1, 0], [1, 0]],
    [[1, 1, 1], [1, 0, 0]], [[1, 1, 1], [0, 0, 1]],
    [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]],
    // Cross
    [[0, 1, 0], [1, 1, 1], [0, 1, 0]],
    // Z / S Shapes
    [[1, 1, 0], [0, 1, 1]], [[0, 1, 1], [1, 1, 0]],
    [[1, 0], [1, 1], [0, 1]], [[0, 1], [1, 1], [1, 0]]
];


function initGrid() {
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const cell = document.createElement('div');
            cell.dataset.r = r;
            cell.dataset.c = c;
            grid.append(cell);
        }
    }
}

const SIZE = 8;
const colors = ['pink', 'yellow', 'mint', 'blue', 'brown', 'orange', 'purple', 'red', 'black'];
const grid = document.getElementById('grid');
const tray = document.getElementById('tray');
const mascot = document.getElementById('mascot');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const dialog = document.getElementById('dialog');
const audio = document.getElementById('bg-audio');
const saveKey = 'pusheenNightGame.v1';
let drag = null;
let hover = null;
let moodTimer;
let state, soundContext;
const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
function write(key, value) { try { localStorage.setItem(key, value); } catch { /* Play continues in memory. */ } }
let best = Number(read('pusheenBestScore')) || 0;
const soundButton = document.getElementById('sound-btn');
const soundPanel = document.getElementById('audio-panel');
const volumeValue = document.getElementById('volume-value');
const volume = document.getElementById('volume');
const savedVolume = read('pusheenVolume');
audio.volume = savedVolume === null ? .45 : Math.max(0, Math.min(1, Number(savedVolume) || 0));
if (read('pusheenMuted') === 'true') {
    audio.volume = 0;
    write('pusheenVolume', 0);
    write('pusheenMuted', false);
}
volume.value = Math.round(audio.volume * 100);

function setAudioUI() {
    soundButton.querySelector('use').setAttribute('href', !audio.volume ? '#quiet' : '#sound');
    volumeValue.value = volume.value + '%';
    volume.style.setProperty('--level', volumeValue.value);
}
function startAudio() {
    if (!audio.volume) return;
    if (audio.paused) audio.play().catch(() => {});
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (AudioEngine && !soundContext) soundContext = new AudioEngine();
    if (soundContext?.state === 'suspended') soundContext.resume().catch(() => {});
}
function playNotes(notes, spacing, duration, level) {
    if (!soundContext || !audio.volume) return;
    notes.forEach((hz, index) => {
        const start = soundContext.currentTime + index * spacing;
        const osc = soundContext.createOscillator();
        const gain = soundContext.createGain();
        osc.frequency.value = hz;
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(.0002, level * audio.volume), start + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
        osc.connect(gain).connect(soundContext.destination);
        osc.start(start);
        osc.stop(start + duration + .01);
    });
}
function chime(lines) {
    if (!lines) return playNotes([262], 0, .12, .08);
    const tier = Math.max(lines, state.combo);
    const notes = tier === 1 ? [523, 659, 784] : [523, 659, 784, 988, 1047];
    const pitch = Math.pow(2, Math.min(4, tier - 1) / 12);
    playNotes(notes.map(hz => hz * pitch), .075, .23, .075);
}
function togglePanel(open) {
    soundPanel.hidden = !open;
    soundButton.setAttribute('aria-expanded', String(open));
}
soundButton.onclick = () => togglePanel(soundPanel.hidden);
document.addEventListener('click', event => {
    if (!soundButton.contains(event.target) && !soundPanel.contains(event.target)) togglePanel(false);
});
volume.oninput = () => {
    audio.volume = Number(volume.value) / 100;
    write('pusheenVolume', audio.volume);
    if (audio.volume) startAudio(); else audio.pause();
    setAudioUI();
};
setAudioUI();

function scatterStars(container, count, seed, bright) {
    function random() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (let i = 0; i < count; i++) {
        const star = document.createElement('i');
        const dot = i % 5 !== 0;
        star.className = dot ? 'sky-star sky-dot' : 'sky-star';
        star.style.left = random() * 100 + '%';
        star.style.top = random() * 100 + '%';
        const size = dot ? random() * 2 + 1 : random() * 7 + 6;
        star.style.width = star.style.height = star.style.fontSize = size + 'px';
        star.style.opacity = (bright ? .55 : .19) + random() * .36;
        if (!dot) { star.textContent = '✦'; star.style.color = i % 2 ? '#f8dea0' : '#ceb8ee'; }
        container.append(star);
    }
}
// Rasterize each emoji once and tile it across its own drifting layer.
for (const [selector, emoji, size] of [['.paw-trail', '🐾', 182], ['.sparkle-trail', '✨', 243]]) {
    const tile = document.createElement('canvas');
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    tile.width = tile.height = Math.round(size * scale);
    const ctx = tile.getContext('2d');
    ctx.scale(tile.width / size, tile.height / size);
    ctx.globalAlpha = selector === '.paw-trail' ? .37 : .66;
    ctx.font = '32px "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2);
    if (selector === '.paw-trail') {
        ctx.globalCompositeOperation = 'source-in';
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#e2c8f3';
        ctx.fillRect(0, 0, size, size);
    }
    const layer = document.querySelector(selector);
    layer.style.setProperty('--repeat', size + 'px');
    layer.style.backgroundImage = 'url(' + tile.toDataURL() + ')';
}
scatterStars(document.querySelector('.scene-stars'), 40, 913, true);

function starter() {
    const openings = [
        ['........','........','........','........','.kk.....','.k....b.','aa...bbb','aacc.ddd'],
        ['........','........','........','........','..a....k','..aa..kk','bb..c...','bb.cc.dd'],
        ['........','........','........','........','......aa','k...dd.a','kk.bbd..','cc.bb...']
    ];
    const ink = colors.filter(color => color !== 'black');
    const palette = { k: 'black' };
    for (const mark of 'abcd') palette[mark] = ink.splice(Math.floor(Math.random() * ink.length), 1)[0];
    const opening = openings[Math.floor(Math.random() * openings.length)];
    let board = opening.map(row => Array.from(row, mark => palette[mark] || null));
    const turns = Math.floor(Math.random() * 4);
    for (let i = 0; i < turns; i++) {
        board = board[0].map((_, c) => board.map(row => row[c]).reverse());
    }
    return { board, pieces: dealPieces(board, 0), score: 0, combo: 0 };
}
function restore() {
    try {
        const saved = JSON.parse(read(saveKey));
        // Reuse boards saved with the night theme's earlier color names.
        const previousColors = { lilac: 'brown', peach: 'brown', rose: 'pink', gold: 'yellow' };
        const migrateColor = color => Object.hasOwn(previousColors, color) ? previousColors[color] : color;
        if (Array.isArray(saved?.board) && Array.isArray(saved.pieces)) {
            saved.board = saved.board.map(row => row.map(migrateColor));
            for (const piece of saved.pieces) if (piece) piece.color = migrateColor(piece.color);
        }
        if (!Array.isArray(saved?.board) || saved.board.length !== SIZE ||
            !saved.board.every(row => Array.isArray(row) && row.length === SIZE && row.every(v => v === null || colors.includes(v))) ||
            !Array.isArray(saved.pieces) || saved.pieces.length !== 3 || !saved.pieces.some(Boolean) ||
            !saved.pieces.every(p => p === null || (colors.includes(p.color) &&
                SHAPE_PATTERNS.some(matrix => JSON.stringify(matrix) === JSON.stringify(p.matrix)))) ||
            !Number.isSafeInteger(saved.score) || saved.score < 0 || !Number.isSafeInteger(saved.combo) || saved.combo < 0) return starter();
        return saved;
    } catch { return starter(); }
}
function dealPieces(board, score) {
    const palette = colors.slice();
    return PieceDealer.deal(board, SHAPE_PATTERNS, Math.random, score).map(matrix => {
        const color = palette.splice(Math.floor(Math.random() * palette.length), 1)[0];
        return { matrix, color };
    });
}
function shapeElement(piece) {
    const shape = document.createElement('div');
    shape.className = 'shape';
    shape.style.setProperty('--rows', piece.matrix.length);
    shape.style.setProperty('--cols', piece.matrix[0].length);
    piece.matrix.forEach((row, i) => row.forEach((v, j) => {
        if (!v) return;
        const tile = document.createElement('span');
        tile.className = 'tile ' + piece.color;
        tile.style.gridArea = (i + 1) + ' / ' + (j + 1);
        shape.append(tile);
    }));
    return shape;
}
function cellAt(r, c) { return grid.children[r * SIZE + c]; }
function render(freshTray = false) {
    state.board.forEach((row, r) => row.forEach((color, c) => {
        const cell = cellAt(r, c);
        cell.className = 'grid-cell' + (color ? ' tile ' + color : '');
        cell.setAttribute('aria-label', 'Row ' + (r+1) + ', column ' + (c+1) + ', ' + (color || 'empty'));
    }));
    tray.replaceChildren();
    state.pieces.forEach((piece, index) => {
        const slot = document.createElement('div');
        slot.className = 'slot';
        if (freshTray) {
            slot.classList.add('fresh');
            slot.style.setProperty('--slot', index);
        }
        slot.dataset.slot = index;
        slot.classList.toggle('used', !piece);
        slot.draggable = false;
        if (piece) {
            const shape = shapeElement(piece);

            slot.append(shape);
            const rows = piece.matrix.map(row => row.map(v => v ? 'filled' : 'empty').join(', ')).join('. Next row: ');
            slot.setAttribute('aria-label', piece.color + ' piece. ' + rows);
        } else slot.setAttribute('aria-label', 'Used piece slot');
        tray.append(slot);
    });
    document.getElementById('score').textContent = state.score.toLocaleString();
    document.getElementById('best-score').textContent = best.toLocaleString();
}
function clearPreview() {
    if (!hover) return;
    grid.querySelectorAll('.preview').forEach(cell => cell.classList.remove('preview', hover.color));
    grid.querySelectorAll('.line-preview').forEach(cell => cell.classList.remove('line-preview'));
    hover = null;
}
function occupiedCells(piece, r, c) {
    const cells = [];
    piece.matrix.forEach((row, i) => row.forEach((v, j) => { if (v) cells.push([r+i, c+j]); }));
    return cells;
}
function completed(board) {
    const rows = [], cols = [];
    for (let i = 0; i < SIZE; i++) {
        if (board[i].every(Boolean)) rows.push(i);
        if (board.every(row => row[i])) cols.push(i);
    }
    return { rows, cols };
}
function preview(piece, r, c) {
    if (hover?.r === r && hover.c === c && hover.color === piece?.color) return;
    clearPreview();
    if (!piece || !PieceDealer.fits(state.board, piece.matrix, r, c)) return;
    hover = { r, c, color: piece.color };
    const simulated = state.board.map(row => row.slice());
    for (const [i, j] of occupiedCells(piece,r,c)) {
        cellAt(i,j).classList.add('preview', piece.color);
        simulated[i][j] = piece.color;
    }
    const { rows, cols } = completed(simulated);
    for (let i = 0; i < SIZE; i++) {
        rows.forEach(row => cellAt(row,i).classList.add('line-preview'));
        cols.forEach(col => cellAt(i,col).classList.add('line-preview'));
    }
}
function hasMove() {
    return state.pieces.some(piece => piece && state.board.some((row, r) =>
        row.some((_, c) => PieceDealer.fits(state.board, piece.matrix, r, c))));
}
function setMascot(mood) {
    if (mascot.dataset.mood === mood) return;
    mascot.dataset.mood = mood;
    mascot.src = 'components/pusheen_' + mood + '.gif';
}
function reactToClear(combo) {
    clearTimeout(moodTimer);
    setMascot(combo ? 'combo' : 'cheer');
    moodTimer = setTimeout(() => setMascot('idle'), combo ? 2400 : 1800);
}

const comboBanner = document.getElementById('combo-banner');
const confetti = document.getElementById('confetti');
let celebrationTimer;
let confettiFrame = 0;
const effects = document.getElementById('clear-effects');

function clearCelebration() {
    clearTimeout(celebrationTimer);
    comboBanner.replaceChildren();
    cancelAnimationFrame(confettiFrame);
    confetti.hidden = true;
}

const paperColors = ['#ff5797', '#ffd54c', '#9866ef', '#47ccbb', '#56a5f0', '#ff844d'];
function throwConfetti(rows, cols, combo) {
    cancelAnimationFrame(confettiFrame);
    const ctx = confetti.getContext('2d');
    if (!ctx) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    // Small, fast-moving particles only need a modest backing resolution.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(1600000 / (width * height)));
    const canvasWidth = Math.round(width * dpr), canvasHeight = Math.round(height * dpr);
    if (confetti.width !== canvasWidth) confetti.width = canvasWidth;
    if (confetti.height !== canvasHeight) confetti.height = canvasHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    confetti.hidden = false;
    const boardRect = grid.getBoundingClientRect();
    const particles = [];
    const tier = Math.max(rows.length + cols.length, state.combo);
    const count = combo ? Math.min(104, 64 + 8 * tier) : 30;
    const speed = Math.min(width, 800);
    for (let i = 0; i < count; i++) {
        // Small clears shower the completed line. Combos launch two wider fans.
        const alongRow = rows.length && (!cols.length || i % 2 === 0);
        const x = alongRow ? Math.random() : (cols[i % cols.length] + .5) / SIZE;
        const y = alongRow ? (rows[i % rows.length] + .5) / SIZE : Math.random();
        const side = i % 2 === 0 ? 1 : -1;
        particles.push({
            x: combo ? width * (side > 0 ? .15 : .85) : boardRect.left + x * boardRect.width,
            y: combo ? height * (.62 + Math.random() * .12) : boardRect.top + y * boardRect.height,
            vx: combo ? side * speed * (.1 + Math.random() * .47) : (Math.random() - .5) * 235,
            vy: -(combo ? height * .75 : 190) * (.55 + Math.random() * .6),
            spin: (Math.random() - .5) * 10, angle: Math.random() * Math.PI, star: i % 4 === 0,
            size: (combo ? 6 : 4) + Math.random() * 6, color: paperColors[i % paperColors.length]
        });
    }
    const duration = reduceMotion.matches ? .65 : combo ? 1.8 : 1.05;
    const star = new Path2D('M0 -1 L.23 -.27 1 0 .23 .27 0 1 -.23 .27 -1 0 -.23 -.27 Z');
    const start = performance.now();
    function draw(now) {
        const elapsed = Math.max(0, (now - start) / 1000);
        ctx.clearRect(0, 0, width, height);
        if (elapsed >= duration) { confetti.hidden = true; return; }
        // Retain a visible, stationary burst when motion is reduced.
        const t = reduceMotion.matches ? .24 : elapsed;
        ctx.globalAlpha = Math.min(1, (duration - elapsed) / .28);
        for (const paper of particles) {
            ctx.save();
            ctx.translate(paper.x + paper.vx * t, paper.y + paper.vy * t + (combo ? height * .42 : 185) * t * t);
            ctx.rotate(paper.angle + paper.spin * t);
            ctx.fillStyle = paper.color;
            if (paper.star) {
                ctx.scale(paper.size, paper.size);
                ctx.fill(star);
            } else {
                ctx.fillRect(-paper.size / 2, -paper.size / 3, paper.size, paper.size * .68);
            }
            ctx.restore();
        }
        confettiFrame = requestAnimationFrame(draw);
    }
    draw(start);
}
function celebrateCombo(lines) {
    clearTimeout(celebrationTimer);
    const label = document.createElement('strong');
    label.textContent = state.combo > 1 ? 'Combo ×' + state.combo : lines + '-line combo!';
    comboBanner.replaceChildren(label);
    celebrationTimer = setTimeout(() => comboBanner.replaceChildren(), 1700);
}

function rewardPlacement(cells, points, lines) {
    const center = cells.reduce(([r, c], [i, j]) => [r + i + .5, c + j + .5], [0, 0]);
    const badge = document.createElement('div');
    badge.className = lines ? 'move-reward clear' : 'move-reward';
    badge.style.top = Math.max(9, center[0] / cells.length / SIZE * 100) + '%';
    badge.style.left = (center[1] / cells.length / SIZE * 100) + '%';
    const amount = document.createElement('b');
    amount.textContent = '+' + points.toLocaleString();
    badge.append(amount);
    effects.append(badge);
    setTimeout(() => badge.remove(), 850);
    if (!reduceMotion.matches) {
        document.getElementById('score').animate([
            { transform: 'scale(1)' },
            { transform: lines ? 'scale(1.25)' : 'scale(1.10)', offset: .27 },
            { transform: 'scale(1)' }
        ], { duration: lines ? 460 : 240, easing: 'ease-out' });
    }
}

function animateMove(cells, cleared, rows, cols, combo) {
    if (!reduceMotion.matches) {
        for (const [r, c] of cells) {
            if (state.board[r][c]) cellAt(r, c).classList.add('landed');
        }
    }
    if (!cleared.length) return;

    // This overlay has the board's tracks but survives subsequent board renders.
    // It never participates in hit testing or placement calculations.
    const group = document.createElement('div');
    group.className = 'clear-wave';
    for (const [r, c, color] of cleared) {
        const flash = document.createElement('span');
        flash.className = 'cleared-tile ' + color;
        flash.style.gridArea = (r + 1) + ' / ' + (c + 1);
        const wave = Math.min(rows.includes(r) ? c : SIZE, cols.includes(c) ? r : SIZE);
        flash.style.animationDelay = wave * 38 + 'ms';
        group.append(flash);
    }
    for (const r of rows) addBeam(group, (r + 1) + ' / 1 / span 1 / -1', 'across');
    for (const c of cols) addBeam(group, '1 / ' + (c + 1) + ' / -1 / span 1', 'down');
    effects.append(group);
    setTimeout(() => group.remove(), reduceMotion.matches ? 550 : 1050);
    throwConfetti(rows, cols, combo);
    if (combo) celebrateCombo(rows.length + cols.length);
}

function addBeam(group, area, direction) {
    const beam = document.createElement('span');
    beam.className = 'clear-beam ' + direction;
    beam.style.gridArea = area;
    group.append(beam);
}
function place(slotIndex, r, c) {
    const piece = state.pieces[slotIndex];
    if (!piece || !PieceDealer.fits(state.board, piece.matrix, r, c)) return;
    const cells = occupiedCells(piece,r,c);
    for (const [i,j] of cells) state.board[i][j] = piece.color;
    const {rows, cols} = completed(state.board);
    const lines = rows.length + cols.length;
    const cleared = [];
    state.board.forEach((row,i) => row.forEach((color,j) => {
        if (rows.includes(i) || cols.includes(j)) { cleared.push([i,j,color]); row[j] = null; }
    }));
    state.combo = lines ? state.combo + 1 : 0;
    const bonus = [0, 10, 30, 60, 120, 200][Math.min(lines, 5)] * state.combo;
    const points = 10 + cells.length * 10 + bonus + cleared.length * 5;
    state.score += points;
    if (state.score > best) { best = state.score; write('pusheenBestScore', best); }
    state.pieces[slotIndex] = null;
    const freshTray = !state.pieces.some(Boolean);
    if (freshTray) state.pieces = dealPieces(state.board, state.score);
    write(saveKey, JSON.stringify(state));
    render(freshTray);
    const combo = lines > 1 || state.combo > 1;
    animateMove(cells, cleared, rows, cols, combo);
    rewardPlacement(cells, points, lines);
    if (lines) reactToClear(combo);
    chime(lines);
    if (!hasMove()) setTimeout(showGameOver, lines ? (combo ? 1700 : 950) : 0);
}
tray.addEventListener('dragstart', event => event.preventDefault());
tray.addEventListener('pointerdown', event => {
    const slot = event.target.closest('.slot:not(.used)');
    if (!slot || event.button !== 0 || !event.isPrimary) return;
    cancelDrag();
    event.preventDefault();
    const index = Number(slot.dataset.slot);
    drag = { id: event.pointerId, type: event.pointerType, index, slot,
        startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
        glintX: event.clientX, glintY: event.clientY, glintTime: 0, geometry: null,
        frame: 0, image: null };
    // The tray persists when its slots are redealt. Window listeners also cover
    // movement outside the tray when pointer capture is unavailable.
    try { tray.setPointerCapture(event.pointerId); } catch { /* Window still tracks this gesture. */ }
    startAudio();
});

function measureDrag(piece) {
    const rect = grid.getBoundingClientRect();
    const style = getComputedStyle(grid);
    const inset = grid.clientLeft + parseFloat(style.paddingLeft);
    const gap = parseFloat(style.columnGap);
    const unit = (rect.width - 2 * inset - (SIZE - 1) * gap) / SIZE;
    const step = unit + gap;
    drag.image.style.setProperty('--unit', unit + 'px');
    drag.image.style.gap = gap + 'px';
    return { left: rect.left + inset, top: rect.top + inset, step, unit,
        width: step * (piece.matrix[0].length - 1) + unit,
        height: step * (piece.matrix.length - 1) + unit };
}

function paintDrag(now) {
    drag.frame = 0;
    const piece = state.pieces[drag.index];
    if (!drag.image) {
        if (Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < 4) return;
        drag.image = shapeElement(piece);
        drag.image.classList.add('drag-piece');
        document.body.append(drag.image);
        document.body.classList.add('dragging');
        drag.slot.classList.add('dragging-source');
        playNotes([392, 494], .035, .09, .035);
    }
    const g = drag.geometry ??= measureDrag(piece);
    const left = drag.x - g.width / 2;
    const top = drag.y - g.height / 2 - (drag.type === 'mouse' ? 0 : g.unit * .85);
    drag.image.style.transform = 'translate3d(' + left + 'px,' + top + 'px,0)';
    const r = Math.round((top - g.top) / g.step);
    const c = Math.round((left - g.left) / g.step);
    if (drag.row !== r || drag.col !== c) {
        preview(piece, r, c);
        drag.row = r;
        drag.col = c;
    }
    if (!reduceMotion.matches && now - drag.glintTime > 75 &&
        Math.hypot(drag.x - drag.glintX, drag.y - drag.glintY) > 24) {
        const glint = document.createElement('i');
        glint.className = 'drag-glint';
        glint.setAttribute('aria-hidden', 'true');
        glint.style.left = (left + g.width * .25) + 'px';
        glint.style.top = (top + g.height * .85) + 'px';
        document.body.append(glint);
        setTimeout(() => glint.remove(), 350);
        drag.glintX = drag.x; drag.glintY = drag.y; drag.glintTime = now;
    }
}

// Only the latest pointer sample needs painting on each display frame.
function queueDrag(event) {
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.frame) drag.frame = requestAnimationFrame(paintDrag);
}
function refreshGeometry() {
    if (!drag) return;
    drag.geometry = null;
    if (!drag.frame) drag.frame = requestAnimationFrame(paintDrag);
}
window.addEventListener('resize', refreshGeometry);
window.addEventListener('scroll', refreshGeometry, true);

function returnToTray() {
    if (!drag.image || reduceMotion.matches) return;
    const image = drag.image;
    const slot = drag.slot.querySelector('.shape').getBoundingClientRect();
    const g = drag.geometry;
    const x = slot.left + (slot.width - g.width) / 2;
    const y = slot.top + (slot.height - g.height) / 2;
    image.classList.replace('drag-piece', 'returning-piece');
    const animation = image.animate([
        { transform: image.style.transform, opacity: .9 },
        { transform: 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + slot.width / g.width + ')', opacity: .15 }
    ], { duration: 190, easing: 'ease-out', fill: 'forwards' });
    animation.onfinish = () => image.remove();
    drag.image = null;
}
function cancelDrag() {
    if (!drag) return;
    const current = drag;
    drag = null;
    cancelAnimationFrame(current.frame);
    clearPreview();
    current.image?.remove();
    current.slot.classList.remove('dragging-source');
    document.body.classList.remove('dragging');
    if (tray.hasPointerCapture(current.id)) tray.releasePointerCapture(current.id);
}
window.addEventListener('pointermove', event => {
    if (drag?.id === event.pointerId && event.pointerType === 'mouse' && !(event.buttons & 1)) cancelDrag();
    else if (drag?.id === event.pointerId) queueDrag(event);
});
window.addEventListener('pointerup', event => {
    if (event.pointerId !== drag?.id) return;
    cancelAnimationFrame(drag.frame);
    drag.x = event.clientX;
    drag.y = event.clientY;
    paintDrag(performance.now());
    const target = hover;
    if (!target) returnToTray();
    const index = drag.index;
    cancelDrag();
    if (target) place(index, target.r, target.c);
});
function cancelPointer(event) {
    if (event.pointerId === drag?.id) cancelDrag();
}
window.addEventListener('pointercancel', cancelPointer);
tray.addEventListener('lostpointercapture', event => {
    if (!tray.hasPointerCapture(event.pointerId)) cancelPointer(event);
});
window.addEventListener('blur', cancelDrag);
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelDrag(); });

function newGame() {
    cancelDrag();
    state = starter();
    write(saveKey, JSON.stringify(state));
    render();
    clearTimeout(moodTimer);
    setMascot('idle');
}
function showGameOver() {
    togglePanel(false);
    cancelDrag();
    clearCelebration();
    document.getElementById('final-score').textContent = state.score.toLocaleString();
    document.getElementById('final-best').textContent = best.toLocaleString();
    dialog.showModal();
}
dialog.addEventListener('cancel', event => event.preventDefault());
document.getElementById('replay').onclick = () => {
    dialog.close();
    newGame();
    soundButton.focus();
};
document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || dialog.open) return;
    if (!soundPanel.hidden) { togglePanel(false); soundButton.focus(); }
    cancelDrag();
});
initGrid();
state = restore();
render();
if (!hasMove()) showGameOver();

