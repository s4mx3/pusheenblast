const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const dealer = require('./dealer');
const source = fs.readFileSync('game.js', 'utf8');
const patterns = vm.runInNewContext(source.slice(source.indexOf('const SHAPE_PATTERNS ='), source.indexOf('function initGrid()')) + '; SHAPE_PATTERNS');
let seed = 17;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
function solve(board, pieces) {
    if (!pieces.length) return true;
    for (const [index, matrix] of pieces.entries()) {
        const remaining = pieces.filter((_, i) => i !== index);
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            if (dealer.fits(board, matrix, r, c) && solve(dealer.place(board, matrix, r, c).board, remaining)) return true;
        }
    }
    return false;
}
for (let i = 0; i < 120; i++) {
    const density = (i % 10) / 10;
    const board = Array.from({length:8}, () => Array.from({length:8}, () => random() < density ? 1 : null));
    // Normalize completed lines, as the live game does before dealing.
    const normalized = dealer.place(board, [[0]], 0, 0).board;
    const before = JSON.stringify(normalized);
    const pieces = dealer.deal(normalized, patterns, random, i * 30);
    assert.equal(pieces.length, 3);
    const sizes = pieces.map(piece => piece.flat().reduce((a, b) => a + b, 0));
    assert.ok(sizes.filter(size => size >= 5).length <= 2, 'Keep room for a smaller piece');
    assert.ok(solve(normalized, pieces), 'Tray must have a legal sequence');
    assert.equal(JSON.stringify(normalized), before);
}
const cross = Array.from({length:8}, (_, r) => Array.from({length:8}, (_, c) => (r === 0 || c === 0) && (r || c) ? 1 : null));
const outcome = dealer.place(cross, [[1]], 0, 0);
assert.equal(outcome.lines, 2);
assert.ok(outcome.board.flat().every(v => v === null));
// Check the mix as well as individual trays so rescue-piece bias cannot creep back in.
const empty = Array.from({length:8}, () => Array(8).fill(null));
function sample(score) {
    const seen = new Set();
    let totalBlocks = 0, twoLarge = 0, varied = 0;
    for (let i = 0; i < 300; i++) {
        const tray = dealer.deal(empty, patterns, random, score);
        const sizes = tray.map(m => m.flat().reduce((a, b) => a+b, 0));
        const names = tray.map(m => JSON.stringify(m));
        names.forEach(name => seen.add(name));
        totalBlocks += sizes.reduce((a,b) => a+b, 0);
        if (sizes.filter(n => n >= 5).length === 2) twoLarge++;
        if (new Set(names).size === 3) varied++;
    }
    return { seen, totalBlocks, twoLarge, varied };
}
const early = sample(0);
const late = sample(3000);
assert.equal(early.twoLarge, 0, 'Opening trays cap bulky pieces at one');
assert.ok(late.twoLarge >= 12, 'Later trays sometimes pair two bulky pieces');
assert.ok(late.totalBlocks > early.totalBlocks + 100, 'Trays grow more demanding over a run');
assert.ok(late.seen.size >= 35 && late.varied > 260, 'Offer a broad mix with few duplicate shapes');
console.log('Passed 120 solvable trays, board immutability, crossing clears and difficulty progression.');
console.log('Mean blocks per tray:', (early.totalBlocks/300).toFixed(2), 'early,', (late.totalBlocks/300).toFixed(2), 'late.');
