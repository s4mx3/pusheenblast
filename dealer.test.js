const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const dealer = require('./dealer');
const source = fs.readFileSync('game.js', 'utf8');
const patterns = vm.runInNewContext(source.slice(source.indexOf('const SHAPE_PATTERNS ='), source.indexOf('function initGrid()')) + '; SHAPE_PATTERNS');
let seed = 17;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
function solve(board, pieces, index = 0) {
    if (index === pieces.length) return true;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        if (dealer.fits(board, pieces[index], r, c) && solve(dealer.place(board, pieces[index], r, c).board, pieces, index + 1)) return true;
    }
    return false;
}
for (let i = 0; i < 120; i++) {
    const density = (i % 10) / 10;
    const board = Array.from({length:8}, () => Array.from({length:8}, () => random() < density ? 1 : null));
    // Normalize completed lines, as the live game does before dealing.
    const normalized = dealer.place(board, [[0]], 0, 0).board;
    const before = JSON.stringify(normalized);
    const pieces = dealer.deal(normalized, patterns, random);
    assert.equal(pieces.length, 3);
    const sizes = pieces.map(piece => piece.flat().reduce((a, b) => a + b, 0));
    assert.ok(sizes[0] <= 3, 'Every tray starts with a small piece');
    assert.ok(sizes.filter(size => size >= 5).length <= 1, 'At most one large piece per tray');
    assert.ok(solve(normalized, pieces), 'Tray must have a legal sequence');
    assert.equal(JSON.stringify(normalized), before);
}
const cross = Array.from({length:8}, (_, r) => Array.from({length:8}, (_, c) => (r === 0 || c === 0) && (r || c) ? 1 : null));
const outcome = dealer.place(cross, [[1]], 0, 0);
assert.equal(outcome.lines, 2);
assert.ok(outcome.board.flat().every(v => v === null));
// Keep variety on open boards, and verify meaningful help on a nearly full row.
const empty = Array.from({length:8}, () => Array(8).fill(null));
const nearClear = empty.map(row => row.slice());
nearClear[0].fill(1, 0, 6);
let helpfulTrays = 0;
let largeCount = 0;
const seen = new Set();
for (let i = 0; i < 200; i++) {
    const openTray = dealer.deal(empty, patterns, random);
    for (const piece of openTray) {
        seen.add(JSON.stringify(piece));
        if (piece.flat().reduce((a, b) => a + b, 0) >= 5) largeCount++;
    }
    const tray = dealer.deal(nearClear, patterns, random);
    const helpful = tray.some(piece => {
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            if (dealer.fits(nearClear, piece, r, c) && dealer.place(nearClear, piece, r, c).lines > 0) return true;
        }
        return false;
    });
    if (helpful) helpfulTrays++;
}
assert.ok(seen.size >= 20, 'Open boards retain varied shapes');
assert.ok(largeCount >= 15, 'Larger challenges still appear');
assert.ok(helpfulTrays >= 100, 'Most trays offer a clear for the two-cell row gap');
console.log(`Passed: 120 solvable trays, size limits, immutability, crossing clears; ${seen.size} shapes, ${largeCount} large pieces, ${helpfulTrays}/200 helpful trays.`);
