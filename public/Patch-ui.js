const SIZE = 6;
const STORAGE_PREFIX = "patch-pattern:";
const MAX_STATE = 3; // 0..3

export function initPatchUI() {
  const grid = document.getElementById("patch-grid");
  const patchDay = document.getElementById("patch-day");
  const statusText = document.getElementById("status-text");
  const patchState = document.getElementById("patch-state");
  const btnRandom = document.getElementById("btn-random");
  const btnClear = document.getElementById("btn-clear");
  const historyStrip = document.getElementById("history-strip");

  if (!grid || !patchDay || !statusText || !patchState || !btnRandom || !btnClear || !historyStrip) {
    return;
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const STORAGE_KEY = STORAGE_PREFIX + todayKey;

  const now = new Date();
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
  patchDay.textContent = formatter.format(now);

  let matrix = createEmptyMatrix();

  function createEmptyMatrix() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function loadMatrixForDay(dateKey) {
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + dateKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length !== SIZE) return null;
      return parsed.map((row) => {
        if (!Array.isArray(row) || row.length !== SIZE) {
          return Array(SIZE).fill(0);
        }
        return row.map((v) => {
          const num = Number(v);
          return Number.isFinite(num) ? Math.max(0, Math.min(MAX_STATE, num)) : 0;
        });
      });
    } catch (err) {
      console.error("Failed to load patch matrix for", dateKey, err);
      return null;
    }
  }

  function loadToday() {
    const loaded = loadMatrixForDay(todayKey);
    if (loaded) {
      matrix = loaded;
      patchState.textContent = "Saved for today";
    } else {
      matrix = createEmptyMatrix();
      patchState.textContent = "Unsaved live patch";
    }
  }

  function saveToday() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(matrix));
      patchState.textContent = "Saved for today";
    } catch (err) {
      console.error("Failed to save patch matrix", err);
    }
  }

  function renderGrid() {
    grid.innerHTML = "";
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);

        const inner = document.createElement("div");
        inner.className = "cell-inner";
        cell.appendChild(inner);

        cell.addEventListener("click", () => {
          cycleCell(r, c);
        });

        grid.appendChild(cell);
      }
    }
    updateGridCells();
  }

  function cycleCell(row, col) {
    matrix[row][col] = (matrix[row][col] + 1) % (MAX_STATE + 1);
    updateCell(row, col);
    updateStatus();
    patchState.textContent = "Unsaved live patch";
  }

  function updateCell(row, col) {
    const value = matrix[row][col];
    const cell = grid.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    if (!cell) return;
    const inner = cell.firstElementChild;
    cell.classList.remove("state-0", "state-1", "state-2", "state-3");
    cell.classList.add("state-" + value);
    if (inner) {
      inner.textContent = "";
    }
  }

  function updateGridCells() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        updateCell(r, c);
      }
    }
    updateStatus();
  }

  function countStitched() {
    let total = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (matrix[r][c] !== 0) total++;
      }
    }
    return total;
  }

  function updateStatus() {
    const total = countStitched();
    statusText.textContent = `${total} stitched cells`;
  }

  function randomize() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const roll = Math.random();
        if (roll < 0.45) {
          matrix[r][c] = 0;
        } else if (roll < 0.7) {
          matrix[r][c] = 1;
        } else if (roll < 0.9) {
          matrix[r][c] = 2;
        } else {
          matrix[r][c] = 3;
        }
      }
    }
    updateGridCells();
    patchState.textContent = "Unsaved live patch";
  }

  function clearPatch() {
    matrix = createEmptyMatrix();
    updateGridCells();
    patchState.textContent = "Unsaved live patch";
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error("Failed to clear patch", err);
    }
  }

  function buildHistory() {
    historyStrip.innerHTML = "";
    const maxDaysBack = 10;
    const todayDate = new Date(todayKey);
    let count = 0;

    for (let offset = 1; offset <= maxDaysBack && count < 5; offset++) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - offset);
      const key = d.toISOString().slice(0, 10);
      const m = loadMatrixForDay(key);
      if (!m) continue;
      const tile = document.createElement("div");
      tile.className = "history-tile";

      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const hc = document.createElement("div");
          hc.className = "history-cell";
          const v = m[r][c];
          if (v === 1) hc.classList.add("s1");
          if (v === 2) hc.classList.add("s2");
          if (v === 3) hc.classList.add("s3");
          tile.appendChild(hc);
        }
      }

      tile.title = key;
      historyStrip.appendChild(tile);
      count++;
    }

    if (!historyStrip.children.length) {
      const span = document.createElement("span");
      span.className = "history-label";
      span.textContent = "No previous patches yet.";
      historyStrip.appendChild(span);
    }
  }

  btnRandom.addEventListener("click", () => {
    randomize();
  });

  btnClear.addEventListener("click", () => {
    clearPatch();
  });

  const saveHandler = () => {
    if (countStitched() > 0) {
      saveToday();
    }
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      saveHandler();
    }
  });
  window.addEventListener("beforeunload", saveHandler);

  loadToday();
  renderGrid();
  buildHistory();
}
