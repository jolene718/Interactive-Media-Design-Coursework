// Grid system for the workbench stage
const Grid = (function() {
  const CELL_SIZE = 46;
  const GRID_COLOR = '#D4C9B4';
  const DOT_RADIUS = 2;

  let cols = 0, rows = 0;
  let canvas, ctx;
  let offsetX = 0, offsetY = 0;

  function init() {
    canvas = document.getElementById('gridCanvas');
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    canvas.style.width = container.clientWidth + 'px';
    canvas.style.height = container.clientHeight + 'px';
    ctx.scale(dpr, dpr);

    cols = Math.floor(container.clientWidth / CELL_SIZE);
    rows = Math.floor(container.clientHeight / CELL_SIZE);
    offsetX = (container.clientWidth - cols * CELL_SIZE) / 2;
    offsetY = (container.clientHeight - rows * CELL_SIZE) / 2;

    draw();
  }

  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = GRID_COLOR;
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const x = offsetX + c * CELL_SIZE;
        const y = offsetY + r * CELL_SIZE;
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function snapToGrid(px, py) {
    const c = Math.round((px - offsetX) / CELL_SIZE);
    const r = Math.round((py - offsetY) / CELL_SIZE);
    return {
      col: Math.max(0, Math.min(cols, c)),
      row: Math.max(0, Math.min(rows, r))
    };
  }

  function gridToPixel(col, row) {
    return {
      x: offsetX + col * CELL_SIZE,
      y: offsetY + row * CELL_SIZE
    };
  }

  function getCellSize() { return CELL_SIZE; }
  function getCols() { return cols; }
  function getRows() { return rows; }
  function getOffset() { return { x: offsetX, y: offsetY }; }

  return { init, resize, snapToGrid, gridToPixel, getCellSize, getCols, getRows, getOffset };
})();
