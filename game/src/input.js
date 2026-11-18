// Solmar Bay — keyboard and mouse input. Tracks held keys, edge-triggered
// presses, and the mouse position in both screen and world coordinates.
export function createInput(canvas) {
  const input = {
    keys: {},
    pressed: {},
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mouseClicked: false,
    // World-space mouse position, filled in every frame by main.js.
    worldX: 0,
    worldY: 0,
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.keys[e.code] = true;
    input.pressed[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    input.keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    input.keys = {};
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    input.mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.mouseClicked = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return input;
}

// True while the key is held down.
export function keyDown(input, code) {
  return !!input.keys[code];
}

// True only on the frame the key went down. Cleared at the end of each frame.
export function keyPressed(input, code) {
  return !!input.pressed[code];
}

export function clearPressed(input) {
  input.pressed = {};
  input.mouseClicked = false;
}

// Movement vector from WASD / arrows, normalised.
export function moveVector(input) {
  let x = 0;
  let y = 0;
  if (keyDown(input, 'KeyA') || keyDown(input, 'ArrowLeft')) x -= 1;
  if (keyDown(input, 'KeyD') || keyDown(input, 'ArrowRight')) x += 1;
  if (keyDown(input, 'KeyW') || keyDown(input, 'ArrowUp')) y -= 1;
  if (keyDown(input, 'KeyS') || keyDown(input, 'ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    const inv = 1 / Math.SQRT2;
    x *= inv;
    y *= inv;
  }
  return { x, y };
}
