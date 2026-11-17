// Keyboard and mouse input. Held keys are read every step; one-shot presses
// (enter car, punch, shoot, pause, mute, mission) are queued as bit flags and
// taken once by the loop, so a press between frames is never lost or double-counted.
export const ACTION_ENTER = 1;
export const ACTION_PUNCH = 2;
export const ACTION_SHOOT = 4;
export const ACTION_PAUSE = 8;
export const ACTION_MUTE = 16;
export const ACTION_MISSION = 32;
export const ACTION_CONFIRM = 64;

const PAUSE_KEYS = new Set(['KeyP', 'Escape']);
const CONFIRM_KEYS = new Set(['Space', 'Enter']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDX = 0;
  let mouseDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyE' && !event.repeat) actions |= ACTION_ENTER;
    else if (event.code === 'KeyF' && !event.repeat) actions |= ACTION_PUNCH;
    else if (event.code === 'KeyM' && !event.repeat) actions |= ACTION_MUTE;
    else if (event.code === 'KeyQ' && !event.repeat) actions |= ACTION_MISSION;
    else if (PAUSE_KEYS.has(event.code) && !event.repeat) actions |= ACTION_PAUSE;
    else if (CONFIRM_KEYS.has(event.code) && !event.repeat) actions |= ACTION_CONFIRM;
    keys.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    if (event.button === 0) actions |= ACTION_SHOOT;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    mouseDX += event.clientX - lastX;
    mouseDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  const endDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  return {
    held(code) { return keys.has(code); },
    forward() { return (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0); },
    strafe() { return (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0); },
    running() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    handbrake() { return keys.has('Space'); },
    takeMouseDelta() {
      const d = { x: mouseDX, y: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return d;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
