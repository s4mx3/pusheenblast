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
        for (let slot = 0; slot < 3; slot++) {
            const pressure = simulated.flat().filter(v => v !== null).length / (board.length ** 2);
            const candidates = [];
            for (const matrix of patterns) {
                const size = matrix.flat().reduce((a, b) => a + b, 0);
                const moves = [];
                for (let r = 0; r <= board.length - matrix.length; r++) {
                    for (let c = 0; c <= board.length - matrix[0].length; c++) {
                        if (fits(simulated, matrix, r, c)) {
                            const outcome = place(simulated, matrix, r, c);
                            moves.push({ ...outcome, weight: 1 + outcome.lines * (3 + pressure * 8) });
                        }
                    }
                }
                if (moves.length) candidates.push({ matrix, moves,
                    weight: (1 + Math.min(moves.length, 12) / 12) /
                        (1 + size * pressure * 2) *
                        (result.includes(matrix) ? 0.3 : 1) *
                        (size === 1 && pressure < 0.5 ? 0.25 : 1) });
            }
            if (!candidates.length) return result;
            const pick = items => {
                let value = random() * items.reduce((sum, item) => sum + item.weight, 0);
                return items.find(item => (value -= item.weight) < 0) || items[items.length - 1];
            };
            const chosen = pick(candidates);
            result.push(chosen.matrix);
            simulated = pick(chosen.moves).board;
        }
        return result;
    }
    return { fits, place, deal };
})();
if (typeof module !== 'undefined') module.exports = PieceDealer;
