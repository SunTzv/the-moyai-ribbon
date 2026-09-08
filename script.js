document.addEventListener("DOMContentLoaded", () => {
    let currentPuzzleType = "mini";
    let puzzleData = null;
    let cols = 5;
    let rows = 5;
    let cellsData = [];
    let userGrid = [];
    let incorrectCells = new Set();
    let revealedCells = new Set();

    let cluesAcross = [];
    let cluesDown = [];
    let allClues = [];
    let cellCluesMap = [];
    let activeIndex = -1;
    let direction = "Across";

    const boardEl = document.getElementById('board');
    const boardWrapperEl = document.getElementById('board-wrapper');
    const activeClueDirEl = document.getElementById('active-clue-direction');
    const activeClueNumEl = document.getElementById('active-clue-num');
    const activeClueTextEl = document.getElementById('active-clue-text');
    const btnPrevClue = document.getElementById('btn-prev-clue');
    const btnNextClue = document.getElementById('btn-next-clue');
    const victoryModal = document.getElementById('victory-modal');
    const btnCloseVictory = document.getElementById('btn-close-victory');

    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPuzzleType = btn.getAttribute('data-type');
            loadPuzzle(currentPuzzleType);
        });
    });

    btnPrevClue.addEventListener('click', () => navigateClue(-1));
    btnNextClue.addEventListener('click', () => navigateClue(1));

    btnCloseVictory.addEventListener('click', () => {
        victoryModal.classList.add('hidden');
    });

    function loadPuzzle(type) {
        fetch(`./todays/${type}.json`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                puzzleData = data;
                const body = data.body[0];

                cols = body.dimensions?.width || body.dimensions?.columnCount || 5;
                rows = body.dimensions?.height || body.dimensions?.rowCount || 5;

                cellsData = body.cells || [];
                userGrid = new Array(cols * rows).fill('');
                incorrectCells.clear();
                revealedCells.clear();

                parseClues(body);

                document.documentElement.style.setProperty('--cols', cols);
                document.documentElement.style.setProperty('--rows', rows);

                if (cols > 10) {
                    boardWrapperEl.style.maxWidth = '560px';
                } else if (cols > 6) {
                    boardWrapperEl.style.maxWidth = '480px';
                } else {
                    boardWrapperEl.style.maxWidth = '380px';
                }

                renderBoard();

                const firstPlayable = cellsData.findIndex(c => c.answer);
                if (firstPlayable !== -1) {
                    selectCell(firstPlayable, "Across");
                }
            })
            .catch(err => {
                console.error("Failed to load puzzle:", err);
            });
    }

    function formatClueText(clue) {
        if (!clue || !clue.text) return '';
        if (typeof clue.text === 'string') return clue.text;
        if (Array.isArray(clue.text)) {
            return clue.text.map(t => t.plain || t.formatted || '').join('');
        }
        return '';
    }

    function parseClues(body) {
        cluesAcross = [];
        cluesDown = [];
        allClues = [];
        cellCluesMap = Array.from({ length: cols * rows }, () => ({ Across: null, Down: null }));

        const rawClues = body.clues || [];

        rawClues.forEach((clue, idx) => {
            const parsedClue = {
                id: idx,
                direction: clue.direction,
                label: clue.label,
                text: formatClueText(clue),
                cells: clue.cells || []
            };

            if (clue.direction === "Across") {
                cluesAcross.push(parsedClue);
            } else {
                cluesDown.push(parsedClue);
            }

            allClues.push(parsedClue);

            parsedClue.cells.forEach(cellIdx => {
                if (cellCluesMap[cellIdx]) {
                    cellCluesMap[cellIdx][clue.direction] = parsedClue;
                }
            });
        });
    }

    function renderBoard() {
        boardEl.innerHTML = '';

        cellsData.forEach((cellData, idx) => {
            const cellEl = document.createElement('div');
            cellEl.classList.add('cell');
            cellEl.dataset.index = idx;

            const isBlack = !cellData.answer;
            if (isBlack) {
                cellEl.classList.add('black');
            } else {
                if (cellData.label) {
                    const labelEl = document.createElement('span');
                    labelEl.classList.add('cell-label');
                    labelEl.innerText = cellData.label;
                    cellEl.appendChild(labelEl);
                }

                const valEl = document.createElement('span');
                valEl.classList.add('cell-value');
                valEl.innerText = userGrid[idx] || '';
                cellEl.appendChild(valEl);

                cellEl.addEventListener('click', () => {
                    if (activeIndex === idx) {
                        const newDir = direction === "Across" ? "Down" : "Across";
                        selectCell(idx, newDir);
                    } else {
                        selectCell(idx, direction);
                    }
                });
            }

            boardEl.appendChild(cellEl);
        });
    }

    function selectCell(idx, preferredDir) {
        if (idx < 0 || idx >= cellsData.length || !cellsData[idx].answer) return;

        const availableClues = cellCluesMap[idx] || {};
        let targetDir = preferredDir;

        if (!availableClues[targetDir]) {
            targetDir = targetDir === "Across" ? "Down" : "Across";
        }

        activeIndex = idx;
        direction = targetDir;

        updateGridHighlights();
        updateActiveClueDisplay();
    }

    function updateGridHighlights() {
        const activeClue = getActiveClue();
        const activeWordCells = activeClue ? activeClue.cells : [];

        const cellEls = boardEl.children;
        for (let i = 0; i < cellEls.length; i++) {
            const el = cellEls[i];
            el.classList.remove('active', 'highlighted', 'incorrect', 'revealed');

            if (i === activeIndex) {
                el.classList.add('active');
            } else if (activeWordCells.includes(i)) {
                el.classList.add('highlighted');
            }

            if (incorrectCells.has(i)) {
                el.classList.add('incorrect');
            }
            if (revealedCells.has(i)) {
                el.classList.add('revealed');
            }
        }
    }

    function getActiveClue() {
        if (activeIndex === -1) return null;
        return cellCluesMap[activeIndex] ? cellCluesMap[activeIndex][direction] : null;
    }

    function updateActiveClueDisplay() {
        const clue = getActiveClue();
        if (!clue) {
            activeClueDirEl.innerText = direction.toUpperCase();
            activeClueNumEl.innerText = "-";
            activeClueTextEl.innerText = "Select a cell";
            return;
        }

        activeClueDirEl.innerText = clue.direction.toUpperCase();
        activeClueNumEl.innerText = clue.label;
        activeClueTextEl.innerText = clue.text;
    }

    function navigateClue(step) {
        const currentClue = getActiveClue();
        if (!currentClue || allClues.length === 0) return;

        let currIdx = allClues.findIndex(c => c.id === currentClue.id);
        if (currIdx === -1) currIdx = 0;

        let nextIdx = (currIdx + step + allClues.length) % allClues.length;
        const targetClue = allClues[nextIdx];

        if (targetClue && targetClue.cells.length > 0) {
            selectCell(targetClue.cells[0], targetClue.direction);
        }
    }

    window.addEventListener('keydown', (e) => {
        if (activeIndex === -1 || victoryModal.classList.contains('hidden') === false) return;

        const key = e.key;

        if (key.length === 1 && key.match(/[a-zA-Z]/)) {
            e.preventDefault();
            const letter = key.toUpperCase();
            userGrid[activeIndex] = letter;
            incorrectCells.delete(activeIndex);
            updateCellDOM(activeIndex);

            advanceToNextCell();
            checkVictory();
        } else if (key === "Backspace") {
            e.preventDefault();
            if (userGrid[activeIndex] !== '') {
                userGrid[activeIndex] = '';
                incorrectCells.delete(activeIndex);
                updateCellDOM(activeIndex);
            } else {
                moveToPreviousCell();
                userGrid[activeIndex] = '';
                incorrectCells.delete(activeIndex);
                updateCellDOM(activeIndex);
            }
            updateGridHighlights();
        } else if (key === "Delete") {
            e.preventDefault();
            userGrid[activeIndex] = '';
            incorrectCells.delete(activeIndex);
            updateCellDOM(activeIndex);
        } else if (key === " ") {
            e.preventDefault();
            const newDir = direction === "Across" ? "Down" : "Across";
            selectCell(activeIndex, newDir);
        } else if (key.startsWith("Arrow")) {
            e.preventDefault();
            handleArrowKey(key);
        } else if (key === "Tab") {
            e.preventDefault();
            navigateClue(e.shiftKey ? -1 : 1);
        }
    });

    function updateCellDOM(idx) {
        const cellEl = boardEl.children[idx];
        if (cellEl) {
            const valEl = cellEl.querySelector('.cell-value');
            if (valEl) valEl.innerText = userGrid[idx] || '';
        }
    }

    function advanceToNextCell() {
        const clue = getActiveClue();
        if (!clue || !clue.cells) return;

        const currentPos = clue.cells.indexOf(activeIndex);
        if (currentPos !== -1 && currentPos < clue.cells.length - 1) {
            selectCell(clue.cells[currentPos + 1], direction);
        } else {
            updateGridHighlights();
        }
    }

    function moveToPreviousCell() {
        const clue = getActiveClue();
        if (!clue || !clue.cells) return;

        const currentPos = clue.cells.indexOf(activeIndex);
        if (currentPos > 0) {
            selectCell(clue.cells[currentPos - 1], direction);
        }
    }

    function handleArrowKey(key) {
        let r = Math.floor(activeIndex / cols);
        let c = activeIndex % cols;

        if (key === "ArrowRight") c++;
        if (key === "ArrowLeft") c--;
        if (key === "ArrowDown") r++;
        if (key === "ArrowUp") r--;

        if (r >= 0 && r < rows && c >= 0 && c < cols) {
            const targetIdx = r * cols + c;
            if (cellsData[targetIdx] && cellsData[targetIdx].answer) {
                selectCell(targetIdx, direction);
            }
        }
    }

    function checkVictory() {
        const isComplete = cellsData.every((cellData, idx) => {
            if (!cellData.answer) return true;
            return userGrid[idx] === cellData.answer;
        });

        if (isComplete) {
            victoryModal.classList.remove('hidden');
        }
    }

    loadPuzzle("mini");
});