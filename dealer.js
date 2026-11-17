const PieceDealer = (() => {
    function fits(board, matrix, r, c) {
        return matrix.every((row, i) => row.every((v, j) => !v ||
            (r + i >= 0 && r + i < board.length && c + j >= 0 &&
             c + j < board.length && board[r + i][c + j] === null)));
    }
    function place(board, matrix, r, c) {
        const next = board.map(row => row.slice());
        matrix.forEach((row, i) => row.forEach((v, j) => { if (v) next[r+i][c+j] = 1; }));
        const rows = next.map(row => row.every(v => v !== null));
        const cols = next[0].map((_, j) => next.every(row => row[j] !== null));
        next.forEach((row, i) => row.forEach((_, j) => { if (rows[i] || cols[j]) next[i][j] = null; }));
        return { board: next, lines: rows.filter(Boolean).length + cols.filter(Boolean).length };
    }
    function deal(board, patterns, random = Math.random) {
        let simulated = board;
        const result = [];
        let largePieces = 0;
        for (let slot = 0; slot < 3; slot++) {
            const pressure = simulated.flat().filter(v => v !== null).length / (board.length ** 2);
            const candidates = [];
            for (const matrix of patterns) {
                const size = matrix.flat().reduce((a, b) => a + b, 0);
                // A small starter provides breathing room; one larger piece keeps
                // the tray interesting without stacking several difficult shapes.
                if (slot === 0 && size > 3) continue;
                if (size >= 5 && largePieces >= 1) continue;
                if (size >= 9 && pressure > 0.35) continue;
                const moves = [];
                let immediateFits = 0;
                for (let r = 0; r <= board.length - matrix.length; r++) {
                    for (let c = 0; c <= board.length - matrix[0].length; c++) {
                        if (fits(board, matrix, r, c)) immediateFits++;
                        if (fits(simulated, matrix, r, c)) {
                            const outcome = place(simulated, matrix, r, c);
                            moves.push({ ...outcome, weight: 1 + outcome.lines * (3 + pressure * 8) });
                        }
                    }
                }
                if (moves.length) {
                    const canClear = moves.some(move => move.lines > 0);
                    // Weight the piece itself for clearing potential, rather than
                    // only favoring a clearing move after choosing the piece.
                    const sizeWeight = size <= 3 ? 2.8 : size === 4 ? 1.4 : size < 9 ? 0.65 : 0.2;
                    candidates.push({ matrix, moves, size,
                        weight: sizeWeight * (1 + Math.min(moves.length, 16) / 8) /
                            (1 + Math.max(0, size - 3) * pressure * 3) *
                            (canClear ? 2 + pressure * 10 : 1) *
                            (immediateFits > 0 ? 1 : 0.2) *
                            (result.includes(matrix) ? 0.4 : 1) *
                            (size === 1 && pressure < 0.5 ? 0.35 : 1) });
                }
            }
            if (!candidates.length) return result;
            const pick = items => {
                let value = random() * items.reduce((sum, item) => sum + item.weight, 0);
                return items.find(item => (value -= item.weight) < 0) || items[items.length - 1];
            };
            const chosen = pick(candidates);
            result.push(chosen.matrix);
            if (chosen.size >= 5) largePieces++;
            simulated = pick(chosen.moves).board;
        }
        return result;
    }
    return { fits, place, deal };
})();
if (typeof module !== 'undefined') module.exports = PieceDealer;
