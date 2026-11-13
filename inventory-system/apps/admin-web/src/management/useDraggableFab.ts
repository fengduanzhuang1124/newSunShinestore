import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

// A floating button the user can drag out of the way of the text beneath it. The position is remembered on this
// device only; a press without movement still counts as a click.
const STORAGE_KEY = 'sunshine_guide_fab_position';
const DRAG_THRESHOLD = 5;
const EDGE = 8;

type Point = { x: number; y: number };

export function useDraggableFab(onClick: () => void) {
  const position = ref<Point | null>(null);
  const dragging = ref(false);
  let start: (Point & { left: number; top: number; id: number; width: number; height: number }) | null = null;
  let moved = false;

  const clamp = (point: Point, width: number, height: number): Point => ({
    x: Math.min(Math.max(EDGE, point.x), Math.max(EDGE, window.innerWidth - width - EDGE)),
    y: Math.min(Math.max(EDGE, point.y), Math.max(EDGE, window.innerHeight - height - EDGE)),
  });

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    start = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, id: event.pointerId, width: rect.width, height: rect.height };
    moved = false;
    // Capture at once so a quick drag that leaves the button still moves it.
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }
  function onPointerMove(event: PointerEvent) {
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!moved) { moved = true; dragging.value = true; }
    position.value = clamp({ x: start.left + dx, y: start.top + dy }, start.width, start.height);
  }
  function onPointerUp(event: PointerEvent) {
    if (!start || event.pointerId !== start.id) return;
    start = null;
    dragging.value = false;
    if (moved && position.value) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(position.value)); } catch { /* per-device convenience only */ }
    }
  }
  // The click that ends a drag must not toggle the panel.
  function onButtonClick() {
    if (moved) { moved = false; return; }
    onClick();
  }
  function keepOnScreen() {
    if (position.value) position.value = clamp(position.value, 74, 74);
  }

  onMounted(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Point | null;
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) position.value = clamp(saved, 74, 74);
    } catch { /* ignore unreadable storage */ }
    window.addEventListener('resize', keepOnScreen);
  });
  onBeforeUnmount(() => window.removeEventListener('resize', keepOnScreen));

  const style = computed(() => position.value
    ? { left: `${position.value.x}px`, top: `${position.value.y}px`, right: 'auto', bottom: 'auto', transform: 'none' }
    : undefined);
  return { style, dragging, onPointerDown, onPointerMove, onPointerUp, onButtonClick };
}
