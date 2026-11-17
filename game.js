// ==========================================
// PRE-RENDERED HARDWARE EMOJI TEXTURES
// ==========================================
function generateHardwareEmoji(emoji, size, fontSize) {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.font = `${fontSize}px sans-serif`;
    ctx.globalAlpha = 0.3; // Replicates the faded background look perfectly
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2);
    // Compresses the entire emoji vector into a single locked 8-bit PNG string for 0% render latency!
    return canvas.toDataURL('image/png');
}

const textureStyles = document.createElement('style');
textureStyles.innerHTML = `
.parallax-layer-1 { background-image: url('${generateHardwareEmoji('🐾', 200, 40)}'); background-size: 200px 200px; }
.parallax-layer-2 { background-image: url('${generateHardwareEmoji('✨', 300, 50)}'); background-size: 300px 300px; }
`;
document.head.appendChild(textureStyles);

const GRID_SIZE = 8;
const CELL_SIZE = 64;
const gridElement = document.getElementById('grid');
let board = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));

let score = 0;
let bestScore = localStorage.getItem('pusheenBestScore') || 0;
document.getElementById('best-score').innerText = bestScore;
let currentCombo = 0;

// ==========================================
// AUDIO CONFIGURATION
// ==========================================
const bgAudio = document.getElementById('bg-audio');
let uiMuted = false;
let audioStarted = false;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let synthMuted = false;

function playTone(freq, type, duration, vol = 0.1, slideFreq = null) {
    if (synthMuted) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = type;
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (slideFreq) {
        osc.frequency.exponentialRampToValueAtTime(slideFreq, audioCtx.currentTime + duration);
    }

    gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playBoing() { playTone(200, 'sine', 0.4, 0.15, 350); }
function playPop(sizeFreq) { playTone(sizeFreq, 'sine', 0.15, 0.1); }
function playChime() {
    playTone(880, 'triangle', 0.5, 0.1, 1100);
    setTimeout(() => playTone(1100, 'triangle', 0.6, 0.1, 1320), 100);
    setTimeout(() => playTone(1320, 'triangle', 0.8, 0.1, 1760), 200);
}
function playMeow() { playTone(600, 'sawtooth', 0.3, 0.05, 1200); }
function playGameOver() {
    if (uiMuted) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    playTone(300, 'triangle', 0.4, 0.2, 200);
    setTimeout(() => playTone(200, 'triangle', 0.4, 0.2, 150), 300);
    setTimeout(() => playTone(150, 'sawtooth', 0.8, 0.2, 80), 700);
}

const volSlider = document.getElementById('volume-slider');

// Attempt Autoplay on DOM load 
window.addEventListener('DOMContentLoaded', () => {
    bgAudio.volume = volSlider.value;
    bgAudio.play().then(() => {
        audioStarted = true;
        if (audioCtx.state === 'suspended') audioCtx.resume();
    }).catch(e => console.warn("Browser blocked autoplay. Awaiting strict interaction."));
});

volSlider.addEventListener('input', (e) => {
    e.stopPropagation();
    const val = parseFloat(e.target.value);
    bgAudio.volume = val;
    const btn = document.getElementById('mute-btn');
    if (val > 0 && uiMuted) {
        uiMuted = false;
        btn.classList.remove('muted');
        btn.style.opacity = '1';
        bgAudio.play().catch(console.warn);
    } else if (val === 0) {
        uiMuted = true;
        btn.classList.add('muted');
        btn.style.opacity = '0.5';
        bgAudio.pause();
    }
});

document.getElementById('mute-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    uiMuted = !uiMuted;
    const btn = document.getElementById('mute-btn');
    if (uiMuted) {
        bgAudio.pause();
        btn.classList.add('muted');
        btn.style.opacity = '0.5';
    } else {
        if (volSlider.value == 0) {
            volSlider.value = 0.5;
            bgAudio.volume = 0.5;
        }
        bgAudio.play().then(() => {
            btn.classList.remove('muted');
            btn.style.opacity = '1';
            audioStarted = true;
            if (audioCtx.state === 'suspended') audioCtx.resume();
        }).catch(err => {
            console.warn("Audio err:", err);
            btn.classList.add('error');
            btn.style.opacity = '0.5';
        });
    }
});

window.addEventListener('pointerdown', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (!audioStarted && !uiMuted) {
        bgAudio.volume = volSlider.value;
        bgAudio.play().catch(e => console.warn("Audio block:", e));
        audioStarted = true;
    }
}, { once: true });

// ==========================================
// GAME PLAY MECHANICS
// ==========================================
const COLORS = ['pink', 'mint', 'yellow', 'blue', 'brown'];
const SHAPE_PATTERNS = [
    [[1]], // 1x1
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
    // Cross
    [[0, 1, 0], [1, 1, 1], [0, 1, 0]],
    // Z / S Shapes
    [[1, 1, 0], [0, 1, 1]], [[0, 1, 1], [1, 1, 0]],
    [[1, 0], [1, 1], [0, 1]], [[0, 1], [1, 1], [1, 0]]
];

function initGrid() {
    gridElement.innerHTML = '';
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');
            cell.id = `cell-${r}-${c}`;
            gridElement.appendChild(cell);
        }
    }
}

function updateScore(points, multiplier = 1) {
    score += points;
    const sEl = document.getElementById('score');
    sEl.innerText = score;
    sEl.classList.remove('score-pop', 'score-pop-mega');
    void sEl.offsetWidth;
    sEl.classList.add(multiplier > 1 ? 'score-pop-mega' : 'score-pop');

    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('pusheenBestScore', bestScore);
        document.getElementById('best-score').innerText = bestScore;
    }
}

let activeSlots = []; let dragInProgress = false;
function generateShapes() {
    activeSlots = [0, 1, 2];

    // Choose 3 perfectly distinct random colors (Block Blast Guarantee)!
    let chosenColors = [...COLORS].sort(() => Math.random() - 0.5).slice(0, 3);

    const shapesToPlace = PieceDealer.deal(board, SHAPE_PATTERNS);

    for (let i = 0; i < 3; i++) {
        const slot = document.getElementById(`slot-${i}`);
        slot.innerHTML = '';

        const shapeObj = {
            matrix: shapesToPlace[i],
            color: 'block-' + chosenColors[i] // Distinct assigned visual style!
        };
        const shapeUi = createShapeDOM(shapeObj);
        shapeUi.dataset.slot = i;
        shapeUi.shapeObj = shapeObj;
        slot.appendChild(shapeUi);
        makeDraggable(shapeUi, shapeObj);
    }
    checkGameOver();
}

function createShapeDOM(shapeObj) {
    const container = document.createElement('div');
    container.classList.add('draggable-shape');

    const rows = shapeObj.matrix.length;
    const cols = shapeObj.matrix[0].length;

    container.style.display = 'grid';
    container.style.gridTemplateRows = `repeat(${rows}, 60px)`;
    container.style.gridTemplateColumns = `repeat(${cols}, 60px)`;
    container.style.gap = '4px';
    container.style.position = 'absolute';
    container.style.left = '50%';
    container.style.top = '50%';
    container.style.transformOrigin = 'center center';
    container.style.transform = 'translate(-50%, -50%) scale(0.75)'; // Mathematically guarantees perfect flex slot centering
    container.dataset.color = shapeObj.color;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (shapeObj.matrix[r][c]) {
                const block = document.createElement('div');
                block.classList.add('block', shapeObj.color);
                block.style.gridRow = r + 1;
                block.style.gridColumn = c + 1;
                container.appendChild(block);
            }
        }
    }
    return container;
}

// ------------------------------------------
// PREVIEW LOGIC
// ------------------------------------------
function clearPreview() {
    // Professional 0-DOM-Memory manipulation (No appendChild/remove during paint cycle)
    document.querySelectorAll('.ghost-active').forEach(cell => {
        cell.className = 'grid-cell';
    });
    document.querySelectorAll('.preview-clear').forEach(el => el.classList.remove('preview-clear'));
}

function drawGhost(shapeObj, r, c) {
    const mat = shapeObj.matrix;
    for (let i = 0; i < mat.length; i++) {
        for (let j = 0; j < mat[0].length; j++) {
            if (mat[i][j]) {
                const cell = document.getElementById(`cell-${r + i}-${c + j}`);
                if (cell) {
                    cell.classList.add('ghost-active', shapeObj.color);
                }
            }
        }
    }
}

function checkGhostClears(shapeObj, r, c) {
    let tempBoard = board.map(row => [...row]);
    const mat = shapeObj.matrix;
    for (let i = 0; i < mat.length; i++) {
        for (let j = 0; j < mat[0].length; j++) {
            if (mat[i][j]) tempBoard[r + i][c + j] = 1;
        }
    }

    let toClear = [];
    for (let tr = 0; tr < GRID_SIZE; tr++) {
        if (tempBoard[tr].every(val => val !== null)) toClear.push({ type: 'row', index: tr });
    }
    for (let tc = 0; tc < GRID_SIZE; tc++) {
        let full = true;
        for (let tr = 0; tr < GRID_SIZE; tr++) if (tempBoard[tr][tc] === null) full = false;
        if (full) toClear.push({ type: 'col', index: tc });
    }

    toClear.forEach(cl => {
        if (cl.type === 'row') {
            for (let col = 0; col < GRID_SIZE; col++) {
                const cell = document.getElementById(`cell-${cl.index}-${col}`);
                if (cell) cell.classList.add('preview-clear');
            }
        } else {
            for (let row = 0; row < GRID_SIZE; row++) {
                const cell = document.getElementById(`cell-${row}-${cl.index}`);
                if (cell) cell.classList.add('preview-clear');
            }
        }
    });
}


// ------------------------------------------

function makeDraggable(element, shapeObj) {
    let lastM = { x: 0, y: 0 };

    // Convert strict mouse tracking into the modern Universal Pointer API (Mouse + Touch + Stylus)
    element.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return; // Only block right-clicks on desktops
        
        if (dragInProgress) return;
        dragInProgress = true;
        e.preventDefault(); // Physically lock the browser from trying to scroll/zoom the page when dragging shapes!
        
        const currentSlot = element.parentElement;

        // Math cache to prevent constant DOM layout reflows!
        const w = element.offsetWidth;
        const h = element.offsetHeight;

        element.style.position = 'absolute';
        element.style.left = '0px';
        element.style.top = '0px';
        element.style.willChange = 'transform';
        element.style.pointerEvents = 'none'; // CRITICAL: Disable browser raycasting against moving box!
        document.body.appendChild(element);
        document.body.classList.add('is-dragging'); // Freeze all background physics

        let lastHoverR = -1;
        let lastHoverC = -1;

        const gridRect = document.getElementById('grid').getBoundingClientRect();
        const cellW = gridRect.width / GRID_SIZE;

        // EXPERT MOBILE UX: When dragging on a phone, push the shape 120 pixels UP so the human thumb doesn't blind the screen!
        const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
        const fingerGapY = isTouch ? 120 : 0;

        function calcHover(pageX, pageY) {
            const shapeLeft = pageX - (w / 2);
            const shapeTop = (pageY - fingerGapY) - (h / 2);
            const shapeRight = pageX + (w / 2);
            const shapeBottom = (pageY - fingerGapY) + (h / 2);

            if (shapeRight < gridRect.left || shapeLeft > gridRect.right || shapeBottom < gridRect.top || shapeTop > gridRect.bottom) {
                return null;
            }
            const dx = shapeLeft - gridRect.left + (cellW / 2);
            const dy = shapeTop - gridRect.top + (cellW / 2);
            return { c: Math.floor(dx / cellW), r: Math.floor(dy / cellW) };
        }

        function updateHoverState(pageX, pageY) {
            const pos = calcHover(pageX, pageY);

            if (!pos) {
                if (lastHoverR !== -1) {
                    clearPreview();
                    lastHoverR = -1;
                    lastHoverC = -1;
                }
                return;
            }

            // Only paint preview if actual grid cell slot mathematically changed!
            if (pos.r !== lastHoverR || pos.c !== lastHoverC) {
                clearPreview();
                lastHoverR = pos.r;
                lastHoverC = pos.c;
                if (canPlace(shapeObj, pos.r, pos.c)) {
                    drawGhost(shapeObj, pos.r, pos.c);
                    checkGhostClears(shapeObj, pos.r, pos.c);
                }
            }
        }

        // 1000hz 0-latency physical hardware pointer tracking logic
        let rafId = null;
        let lastX = 0, lastY = 0;
        function onPointerMove(event) { if (event.pointerId !== e.pointerId) return;
            // Apply native coordinates INSTANTLY unthrottled, dropping latency to 0ms
            element.style.transform = `translate3d(${event.pageX - w / 2}px, ${(event.pageY - fingerGapY) - h / 2}px, 0) scale(1)`;

            lastX = event.pageX;
            lastY = event.pageY;

            // Buffer ONLY the layout/collision math into the 60hz VSYNC engine!
            if (!rafId) {
                rafId = requestAnimationFrame(() => {
                    updateHoverState(lastX, lastY);
                    rafId = null;
                });
            }
        }

        // Setup initial position bypass logic
        element.style.transform = `translate3d(${e.pageX - w / 2}px, ${(e.pageY - fingerGapY) - h / 2}px, 0) scale(1)`;
        updateHoverState(e.pageX, e.pageY);

        document.addEventListener('pointermove', onPointerMove);

        function onPointerUp(event) {
            if (event.pointerId !== e.pointerId) return;
            dragInProgress = false;
            window.removeEventListener('pointercancel', onPointerUp);
            if (rafId) cancelAnimationFrame(rafId);
            document.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            element.style.pointerEvents = ''; // Restore browser hit-testing
            document.body.classList.remove('is-dragging'); // Defrost hover states

            clearPreview();

            const pos = calcHover(event.pageX, event.pageY);
            let success = false;
            if (pos && event.type !== 'pointercancel') {
                success = placeShape(shapeObj, pos.r, pos.c);
            }

            if (!success) {
                element.style.position = 'absolute';
                element.style.left = '50%';
                element.style.top = '50%';
                element.style.transform = 'translate(-50%, -50%) scale(0.75)'; // Restore mathematical centering
                currentSlot.appendChild(element);
            } else {
                playBoing();
                element.remove();
                // Mathematically drop this block exactly by its permanent tracker data value
                activeSlots = activeSlots.filter(s => String(s) !== String(element.dataset.slot));
                if (activeSlots.length === 0) generateShapes();
                else checkGameOver();
            }
        }
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
    });
    element.ondragstart = function () { return false; };
}

function canPlace(shapeObj, r, c) {
    const mat = shapeObj.matrix;
    for (let i = 0; i < mat.length; i++) {
        for (let j = 0; j < mat[0].length; j++) {
            if (mat[i][j]) {
                const br = r + i;
                const bc = c + j;
                if (br < 0 || br >= GRID_SIZE || bc < 0 || bc >= GRID_SIZE) return false;
                if (board[br][bc] !== null) return false;
            }
        }
    }
    return true;
}



function placeShape(shapeObj, r, c) {
    if (!canPlace(shapeObj, r, c)) return false;

    let blocksPlaced = 0;
    const mat = shapeObj.matrix;
    for (let i = 0; i < mat.length; i++) {
        for (let j = 0; j < mat[0].length; j++) {
            if (mat[i][j]) {
                board[r + i][c + j] = shapeObj.color;
                const cell = document.getElementById(`cell-${r + i}-${c + j}`);
                cell.className = 'grid-cell block ' + shapeObj.color;

                cell.classList.add('dropped');
                setTimeout(() => cell.classList.remove('dropped'), 500);

                blocksPlaced++;
            }
        }
    }

    // Literal Block Blast piece spawn score (10 base + 10x per single cell)
    let basePoints = 10 + (blocksPlaced * 10); 

    updateScore(basePoints);
    checkLines();
    return true;
}

// ==========================================
// HARDWARE DOM POOLING ENGINE (0% Garbage Collection Latency)
// ==========================================
const objPool = { candy: [], ring: [], particle: [], badge: [], conf: [] };

function getPoolNode(type, baseClass) {
    let el = objPool[type].pop();
    if (!el) {
        el = document.createElement('div');
        document.body.appendChild(el);
    }
    el.className = baseClass; // Reset class
    el.style.animation = 'none'; // Halt physics
    el.style.display = 'block';
    void el.offsetWidth; // Force CSS reflow to securely restart keyframes
    return el;
}

function freePoolNode(el, type) {
    el.style.display = 'none';
    el.style.animation = 'none';
    objPool[type].push(el);
}

function spawnCollectible(r, c) {
    const cell = document.getElementById(`cell-${r}-${c}`);
    if (!cell) return;
    const startRect = cell.getBoundingClientRect();
    const scoreRect = document.querySelector('.score-box span').getBoundingClientRect();

    const collectible = getPoolNode('candy', 'collectible');
    const candies = ['🍬', '🐾', '🍩', '💖'];
    collectible.innerText = candies[Math.floor(Math.random() * candies.length)];

    collectible.style.left = (startRect.left + 10) + 'px';
    collectible.style.top = startRect.top + 'px';
    collectible.style.setProperty('--tx', (scoreRect.left - startRect.left) + 'px');
    collectible.style.setProperty('--ty', (scoreRect.top - startRect.top + 20) + 'px');

    collectible.style.animation = ''; // Jumpstart CSS Sequence
    setTimeout(() => {
        freePoolNode(collectible, 'candy');
        updateScore(5); // Block Blast Authentic Scaling
    }, 1200);
}

function spawnParticles(r, c) {
    const cell = document.getElementById(`cell-${r}-${c}`);
    if (!cell) return;
    const rect = cell.getBoundingClientRect();

    const ring = getPoolNode('ring', 'blast-ring');
    ring.style.left = rect.left + 'px';
    ring.style.top = rect.top + 'px';
    ring.style.animation = '';
    setTimeout(() => freePoolNode(ring, 'ring'), 500);

    const emojis = ['💖', '🌟', '✨'];
    for (let i = 0; i < 3; i++) {
        const particle = getPoolNode('particle', 'particle');
        particle.innerText = emojis[Math.floor(Math.random() * emojis.length)];
        particle.style.left = (rect.left + 15) + 'px';
        particle.style.top = (rect.top + 15) + 'px';
        const angle = Math.random() * Math.PI * 2;
        const velocity = 80 + Math.random() * 80;
        particle.style.setProperty('--dx', Math.cos(angle) * velocity + 'px');
        particle.style.setProperty('--dy', Math.sin(angle) * velocity + 'px');
        
        particle.style.animation = '';
        setTimeout(() => freePoolNode(particle, 'particle'), 700);
    }
}

function showComboBadge(lines) {
    const gridRect = gridElement.getBoundingClientRect();
    const badge = getPoolNode('badge', 'combo-badge');
    badge.innerText = `COMBO X${lines}!`;
    badge.style.left = (gridRect.left + gridRect.width / 2 - 80) + 'px';
    badge.style.top = (gridRect.top + gridRect.height / 2) + 'px';
    
    badge.style.animation = '';
    setTimeout(() => freePoolNode(badge, 'badge'), 2000);

    playChime();
    if (Math.random() > 0.5) setTimeout(() => playMeow(), 400);
}

function spawnEpicConfetti(lines) {
    const colors = ['#ffb6c1', '#add8e6', '#fffacd', '#ffb347', '#98fb98', '#e0b0ff', '#ffffff'];
    const amount = Math.min(30 + lines * 10, 80);
    const winW = window.innerWidth;
    for (let i = 0; i < amount; i++) {
        const conf = getPoolNode('conf', 'confetti');

        const type = Math.random();
        if (type < 0.3) {
            conf.style.width = '10px'; conf.style.height = '10px'; conf.style.borderRadius = '50%';
        } else if (type < 0.6) {
            conf.style.width = '6px'; conf.style.height = '18px'; conf.style.borderRadius = '2px';
        } else {
            conf.style.width = '12px'; conf.style.height = '12px'; conf.style.borderRadius = '2px';
        }

        conf.style.background = colors[Math.floor(Math.random() * colors.length)];

        const startX = (winW / 2) + (Math.random() * 200 - 100);
        const endX = startX + (Math.random() * 800 - 400);
        const rot = Math.random() * 720 + 360;

        conf.style.setProperty('--startX', startX + 'px');
        conf.style.setProperty('--endX', endX + 'px');
        conf.style.setProperty('--rot', rot + 'deg');

        conf.style.animationDuration = (1.5 + Math.random() * 1.5) + 's';
        conf.style.animationDelay = (Math.random() * 0.2) + 's';

        conf.style.animation = '';
        setTimeout(() => freePoolNode(conf, 'conf'), 4000);
    }
}

let pusheenTimeout = null;

function checkLines() {
    let rowsToClear = [];
    let colsToClear = [];

    for (let r = 0; r < GRID_SIZE; r++) {
        let full = true;
        for (let c = 0; c < GRID_SIZE; c++) if (board[r][c] === null) full = false;
        if (full) rowsToClear.push(r);
    }
    for (let c = 0; c < GRID_SIZE; c++) {
        let full = true;
        for (let r = 0; r < GRID_SIZE; r++) if (board[r][c] === null) full = false;
        if (full) colsToClear.push(c);
    }

    const lines = rowsToClear.length + colsToClear.length;

    if (lines > 0) {
        currentCombo++;
        if (currentCombo > 1 || lines > 1) {
            showComboBadge(currentCombo > 1 ? currentCombo : lines);
            spawnEpicConfetti(lines > 1 ? lines : currentCombo);
            document.getElementById('grid').classList.add('shake-it');
            setTimeout(() => document.getElementById('grid').classList.remove('shake-it'), 300);
        } else {
            let toneBase = 400;
            rowsToClear.forEach((r, idx) => setTimeout(() => playPop(toneBase + idx * 50), idx * 100));
            colsToClear.forEach((c, idx) => setTimeout(() => playPop(toneBase + idx * 50 + 200), idx * 100));
        }

        const mascot = document.getElementById('pusheen-mascot');
        mascot.src = "components/pusheen_cheer.gif";
        clearTimeout(pusheenTimeout);
        pusheenTimeout = setTimeout(() => mascot.src = "components/pusheen_idle.gif", 1800);

        let cellsToClear = new Set();
        rowsToClear.forEach(r => { for (let c = 0; c < GRID_SIZE; c++) { cellsToClear.add(`${r},${c}`); } });
        colsToClear.forEach(c => { for (let r = 0; r < GRID_SIZE; r++) { cellsToClear.add(`${r},${c}`); } });

        let collectSpawned = 0;
        // Instantly free mathematical board space to validate Game Over mechanics flawlessly!
        cellsToClear.forEach(coord => {
            const [r, c] = coord.split(',').map(Number);
            board[r][c] = null;

            const cell = document.getElementById(`cell-${r}-${c}`);
            cell.classList.add('clearing');
            spawnParticles(r, c);

            if (Math.random() > 0.6 && collectSpawned < 10) {
                spawnCollectible(r, c);
                collectSpawned++;
            }
        });

        // Prevent player from dragging new pieces onto exploding lines during the 400ms animation!
        const trayEl = document.getElementById('tray');
        trayEl.style.pointerEvents = 'none';

        setTimeout(() => {
            cellsToClear.forEach(coord => {
                const [r, c] = coord.split(',').map(Number);
                // Ensure we only clear the DOM if the block is still legitimately empty!
                if (board[r][c] === null) {
                    document.getElementById(`cell-${r}-${c}`).className = 'grid-cell';
                }
            });
            trayEl.style.pointerEvents = ''; // Unlock Tray
        }, 400);

        let bScore = 0;
        if (lines === 1) bScore = 10;
        else if (lines === 2) bScore = 30;
        else if (lines === 3) bScore = 60;
        else if (lines === 4) bScore = 120;
        else if (lines >= 5) bScore = 200;

        // Block Blast combo equation: Score = Base * ComboLength
        let lineScore = bScore * currentCombo; 

        updateScore(lineScore, currentCombo > 1 ? currentCombo : lines);
    } else {
        currentCombo = 0;
    }
}

function checkGameOver() {
    let canMove = false;
    const slots = document.querySelectorAll('.shape-slot .draggable-shape');
    if (slots.length === 0) return;

    for (let shapeDOM of slots) {
        const shapeObj = shapeDOM.shapeObj;
        if (!shapeObj) continue;
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (canPlace(shapeObj, r, c)) { canMove = true; break; }
            }
            if (canMove) break;
        }
        if (canMove) break;
    }

    if (!canMove && slots.length > 0) {
        playGameOver();
        // Wait gracefully for animations to finish before nuking the screen
        setTimeout(() => {
            document.getElementById('final-score').innerText = score;
            document.getElementById('game-over-overlay').classList.remove('hidden');
        }, 1200);
    }
}

document.getElementById('restart-btn').addEventListener('click', () => {
    board = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    score = 0;
    currentCombo = 0;
    updateScore(0);
    initGrid();
    generateShapes();
    document.getElementById('game-over-overlay').classList.add('hidden');
    document.getElementById('pusheen-mascot').src = "components/pusheen_idle.gif";
});

initGrid(); generateShapes();
