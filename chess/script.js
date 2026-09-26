$(document).ready(function() {
    let board = null;
    let game = new Chess();
    let allPuzzles = [];
    
    let currentPuzzleIndex = 0;
    let currentPuzzle = null;
    let currentMoveIndex = 0;
    let isAutoPlaying = false;
    
    const ui = {
        puzzleInfo: $('#puzzle-info'),
        rating: $('#puzzle-rating'),
        statusMsg: $('#status-msg'),
        btnHint: $('#btn-hint'),
        btnSolution: $('#btn-solution'),
        btnPrev: $('#btn-prev-puzzle'),
        btnNext: $('#btn-next-puzzle')
    };

    // Load Puzzles
    fetch(`./todays/chess.json?v=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
            // Flatten and sort by rating
            allPuzzles = [...data.easy, ...data.mid, ...data.hard];
            allPuzzles.sort((a, b) => a.rating - b.rating);
            
            initBoard();
            loadPuzzleIndex(0);
        })
        .catch(err => {
            console.error("Failed to load puzzles", err);
            ui.statusMsg.text("Failed to load today's puzzles.").addClass('status-wrong');
        });

    function initBoard() {
        if (board) return;
        let config = {
            draggable: true,
            position: 'start',
            onDragStart: onDragStart,
            onDrop: onDrop,
            onSnapEnd: onSnapEnd,
            pieceTheme: function(piece) {
                let pieceType = piece.charAt(1);
                return `https://chessboardjs.com/img/chesspieces/wikipedia/w${pieceType}.png`;
            }
        };
        board = Chessboard('board', config);
    }

    function loadPuzzleIndex(index) {
        if (index < 0 || index >= allPuzzles.length) return;
        
        currentPuzzleIndex = index;
        if (typeof clearArrows === 'function') clearArrows();
        $('.square-55d63').removeClass('highlight-hint');
        isAutoPlaying = false;
        
        currentPuzzle = allPuzzles[currentPuzzleIndex];
        currentMoveIndex = 0;
        
        // Puzzle FEN is the position *before* the opponent's blunder
        // The first move in the moves array is the opponent's move
        game.load(currentPuzzle.fen);
        
        ui.rating.text(`ELO ${currentPuzzle.rating}`);
        ui.statusMsg.removeClass('status-correct status-wrong').text('');
        ui.btnHint.prop('disabled', false);
        ui.btnSolution.prop('disabled', false);

        board.position(game.fen(), false);
        
        // Wait 500ms then make opponent's move
        setTimeout(() => {
            makeNextMove(); // Opponent move
            board.position(game.fen());
            let turnColor = game.turn() === 'w' ? 'WHITE' : 'BLACK';
            if (turnColor === 'BLACK') board.orientation('black');
            else board.orientation('white');
        }, 500);
    }

    function makeNextMove() {
        if (currentMoveIndex >= currentPuzzle.moves.length) return false;
        
        let moveUci = currentPuzzle.moves[currentMoveIndex];
        let from = moveUci.substring(0, 2);
        let to = moveUci.substring(2, 4);
        let promotion = moveUci.length === 5 ? moveUci[4] : undefined;
        
        game.move({ from: from, to: to, promotion: promotion });
        currentMoveIndex++;
        return true;
    }

    function onDragStart(source, piece, position, orientation) {
        if (isAutoPlaying) return false;
        if (game.game_over()) return false;
        if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
            (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
            return false;
        }
        if (currentMoveIndex >= currentPuzzle.moves.length) return false;
    }

    function onDrop(source, target) {
        $('.square-55d63').removeClass('highlight-hint');
        let expectedMoveUci = currentPuzzle.moves[currentMoveIndex];
        let isPromotion = false;
        
        // basic check for promotion
        let piece = game.get(source);
        if (piece && piece.type === 'p' && (target[1] === '8' || target[1] === '1')) {
            isPromotion = true;
        }

        let moveObj = {
            from: source,
            to: target,
            promotion: isPromotion ? 'q' : undefined // default to queen
        };

        // Validate legality
        let testGame = new Chess(game.fen());
        let moveResult = testGame.move(moveObj);
        
        if (moveResult === null) return 'snapback'; // Illegal move

        let actualMoveUci = source + target + (isPromotion ? 'q' : '');
        
        if (actualMoveUci === expectedMoveUci) {
            game.move(moveObj);
            currentMoveIndex++;
            ui.statusMsg.text("CORRECT!").removeClass('status-wrong').addClass('status-correct');
            
            if (currentMoveIndex >= currentPuzzle.moves.length) {
                puzzleCompleted(true);
            } else {
                // Opponent replies
                setTimeout(() => {
                    makeNextMove();
                    board.position(game.fen());
                }, 400);
            }
        } else {
            // Wrong move
            ui.statusMsg.text("WRONG MOVE!").removeClass('status-correct').addClass('status-wrong');
            return 'snapback';
        }
    }

    function onSnapEnd() {
        board.position(game.fen());
    }

    function puzzleCompleted(success) {
        if (success) {
            ui.statusMsg.text("PUZZLE SOLVED!").removeClass('status-wrong').addClass('status-correct');
        }
        ui.btnHint.prop('disabled', true);
        ui.btnSolution.prop('disabled', true);
    }

    // Event Listeners
    ui.btnPrev.click(() => loadPuzzleIndex(currentPuzzleIndex - 1));
    ui.btnNext.click(() => loadPuzzleIndex(currentPuzzleIndex + 1));

    ui.btnHint.click(() => {
        if (currentMoveIndex < currentPuzzle.moves.length && !isAutoPlaying) {
            let moveUci = currentPuzzle.moves[currentMoveIndex];
            let fromSquare = moveUci.substring(0, 2);
            $('.square-' + fromSquare).addClass('highlight-hint');
            
            ui.statusMsg.text("HINT USED.").removeClass('status-correct').addClass('status-wrong');
            ui.btnHint.prop('disabled', true);
        }
    });

    ui.btnSolution.click(() => {
        if (isAutoPlaying || currentMoveIndex >= currentPuzzle.moves.length) return;
        isAutoPlaying = true;
        
        ui.statusMsg.text("SOLUTION SHOWN.").removeClass('status-correct').addClass('status-wrong');
        ui.btnHint.prop('disabled', true);
        ui.btnSolution.prop('disabled', true);
        
        function playNextSolutionMove() {
            if (currentMoveIndex < currentPuzzle.moves.length) {
                makeNextMove();
                board.position(game.fen());
                setTimeout(playNextSolutionMove, 1000);
            } else {
                puzzleCompleted(false);
                isAutoPlaying = false;
            }
        }
        playNextSolutionMove();
    });

    ui.btnNext.click(() => {
        loadNextPuzzle();
    });

    // --- Arrow Drawing & Context Menu Logic ---
    document.addEventListener('contextmenu', function(e) {
        if (e.target.closest('#board-container')) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);

    let arrowStartSq = null;
    let arrowLines = [];

    const svgNS = "http://www.w3.org/2000/svg";
    let defs = document.createElementNS(svgNS, 'defs');
    let marker = document.createElementNS(svgNS, 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '3');
    marker.setAttribute('markerHeight', '3');
    marker.setAttribute('refX', '2');
    marker.setAttribute('refY', '1.5');
    marker.setAttribute('orient', 'auto');
    let path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M 0 0 L 3 1.5 L 0 3 z');
    path.setAttribute('fill', 'rgba(236, 72, 153, 0.8)');
    marker.appendChild(path);
    defs.appendChild(marker);
    document.getElementById('arrow-overlay').appendChild(defs);

    function getSquareFromCoords(e) {
        let rect = document.getElementById('board').getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        let squareSize = rect.width / 8;
        let col = Math.floor(x / squareSize);
        let row = Math.floor(y / squareSize);
        if (col < 0 || col > 7 || row < 0 || row > 7) return null;
        let files = ['a','b','c','d','e','f','g','h'];
        if (board.orientation() === 'black') {
            files.reverse();
            row = 7 - row;
        }
        let rank = 8 - row;
        return files[col] + rank;
    }

    function getSquareCenter(sq) {
        let files = ['a','b','c','d','e','f','g','h'];
        let col = files.indexOf(sq[0]);
        let row = 8 - parseInt(sq[1]);
        if (board.orientation() === 'black') {
            col = 7 - col;
            row = 7 - row;
        }
        let squareSize = document.getElementById('board').getBoundingClientRect().width / 8;
        return {
            x: (col + 0.5) * squareSize,
            y: (row + 0.5) * squareSize
        };
    }

    function drawArrow(start, end) {
        let p1 = getSquareCenter(start);
        let p2 = getSquareCenter(end);
        let line = document.createElementNS(svgNS, 'line');
        
        // Shorten line slightly so arrow head ends near the center of the target square
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        let length = Math.sqrt(dx*dx + dy*dy);
        let p2x = p2.x - (dx / length) * 15;
        let p2y = p2.y - (dy / length) * 15;

        line.setAttribute('x1', p1.x);
        line.setAttribute('y1', p1.y);
        line.setAttribute('x2', p2x);
        line.setAttribute('y2', p2y);
        line.setAttribute('stroke', 'rgba(236, 72, 153, 0.8)');
        line.setAttribute('stroke-width', '10');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('marker-end', 'url(#arrowhead)');
        
        document.getElementById('arrow-overlay').appendChild(line);
        arrowLines.push(line);
    }

    function clearArrows() {
        arrowLines.forEach(l => l.remove());
        arrowLines = [];
    }

    document.addEventListener('mousedown', function(e) {
        let boardContainer = e.target.closest('#board-container');
        if (!boardContainer) return;
        
        if (e.button === 2) {
            e.preventDefault();
            e.stopPropagation();
            arrowStartSq = getSquareFromCoords(e);
        } else if (e.button === 0) {
            clearArrows();
        }
    }, true);

    document.addEventListener('mouseup', function(e) {
        let boardContainer = e.target.closest('#board-container');
        if (!boardContainer) return;
        
        if (e.button === 2) {
            e.preventDefault();
            e.stopPropagation();
            if (arrowStartSq) {
                let endSq = getSquareFromCoords(e);
                if (endSq && arrowStartSq !== endSq) {
                    drawArrow(arrowStartSq, endSq);
                }
                arrowStartSq = null;
            }
        }
    }, true);

    // Clear arrows on resize
    $(window).resize(clearArrows);
});
