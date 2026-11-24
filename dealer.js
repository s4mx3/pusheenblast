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
    function pickWeighted(items, random) {
        let ticket = random() * items.reduce((sum, item) => sum + item.weight, 0);
        return items.find(item => (ticket -= item.weight) < 0) || items[items.length - 1];
    }

    function deal(board, patterns, random = Math.random, score = 0) {
        // Introduce heavier trays gradually during the first few thousand points.
        const progress = Math.min(1, Math.max(0, score / 2400));
        const largeLimit = progress > .35 && random() < progress * .65 ? 2 : 1;
        const sizeWeights = {
            1: .2, 2: 1.7 - progress, 3: 1.5 - .6 * progress,
            4: .82 + .3 * progress, 5: .34 + .43 * progress,
            6: .40 + .36 * progress, 9: .18 + .24 * progress
        };
        const shapes = patterns.map(matrix => {
            const rows = matrix.map(row => row.reduce((sum, v) => sum + v, 0));
            const cols = matrix[0].map((_, j) => matrix.reduce((sum, row) => sum + row[j], 0));
            return {matrix, rows, cols, size: rows.reduce((sum, n) => sum + n, 0)};
        });
        let simulated = board;
        const tray = [];
        let largePieces = 0;
        while (tray.length < 3) {
            const rowGaps = simulated.map(row => row.filter(v => v === null).length);
            const colGaps = simulated[0].map((_, j) => simulated.filter(row => row[j] === null).length);
            const candidates = [];
            for (const shape of shapes) {
                const {matrix, rows, cols, size} = shape;
                if (size >= 5 && largePieces >= largeLimit) continue;
                const moves = [];
                let canClear = false;
                for (let r = 0; r <= board.length - rows.length; r++) {
                    for (let c = 0; c <= board.length - cols.length; c++) {
                        if (!fits(simulated, matrix, r, c)) continue;
                        let lines = 0;
                        for (let i = 0; i < rows.length; i++) {
                            if (rows[i] && rows[i] === rowGaps[r+i]) lines++;
                        }
                        for (let j = 0; j < cols.length; j++) {
                            if (cols[j] && cols[j] === colGaps[c+j]) lines++;
                        }
                        if (lines) canClear = true;
                        moves.push({r, c, weight: 1 + lines * 2});
                    }
                }
                if (!moves.length) continue;
                const variety = tray.includes(matrix) ? .18 : 1;
                const clearWeight = canClear ? 1.8 - .65 * progress : 1;
                const weight = (sizeWeights[size] ?? .4) * variety * clearWeight;
                candidates.push({shape, moves, weight});
            }
            if (!candidates.length) break;
            const {shape, moves} = pickWeighted(candidates, random);
            const move = pickWeighted(moves, random);
            simulated = place(simulated, shape.matrix, move.r, move.c).board;
            tray.push(shape.matrix);
            if (shape.size >= 5) largePieces++;
        }
        // The simulated order is one solution. Let the player discover it.
        for (let i = tray.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [tray[i], tray[j]] = [tray[j], tray[i]];
        }
        return tray;
    }
    return { fits, place, deal };
})();
if (typeof module !== 'undefined') module.exports = PieceDealer;
