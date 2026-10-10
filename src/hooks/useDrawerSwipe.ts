import { useEffect, type RefObject } from "react";

// Swipe the sidebar open and shut with a finger, like a curtain: it follows
// the finger, and lets go to whichever side is closer (or the direction of a
// quick flick).
//
// Only on phone-width screens, where the sidebar is a drawer. On wider
// screens it is permanently visible and there is nothing to drag.

const MOBILE_QUERY = "(max-width: 767px)";
// Android's own back gesture lives at the very edge, so an open-swipe is
// also accepted from further in, as long as it doesn't start somewhere that
// has its own horizontal drag (a text field, the note editor, a scrolling
// table, the activity grid).
const EDGE_PX = 28;
const OPEN_ZONE_FRACTION = 0.35;
const FLICK_PX_PER_MS = 0.35;
const SETTLE_MS = 200;

function claimsHorizontalGestures(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  if (el?.closest("input, textarea, select, [contenteditable], .ProseMirror, pre, [data-no-swipe]")) {
    return true;
  }
  while (el && el !== document.body) {
    const style = getComputedStyle(el);
    const scrollsSideways = style.overflowX === "auto" || style.overflowX === "scroll";
    if (scrollsSideways && el.scrollWidth > el.clientWidth + 1) return true;
    el = el.parentElement;
  }
  return false;
}

interface Options {
  open: boolean;
  setOpen: (open: boolean) => void;
  drawer: RefObject<HTMLElement | null>;
  overlay: RefObject<HTMLElement | null>;
}

export function useDrawerSwipe({ open, setOpen, drawer, overlay }: Options) {
  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let tracking = false;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let base = 0;
    let width = 288;
    let x = 0;
    let prevX = 0;
    let prevT = 0;
    let lastX = 0;
    let lastT = 0;
    let settleTimer: number | undefined;

    function paint(offset: number) {
      const el = drawer.current;
      const shade = overlay.current;
      // Tailwind positions the drawer with the `translate` property, so this
      // replaces its value (setting `transform` would add to it).
      if (el) el.style.translate = `${offset}px 0`;
      if (shade) shade.style.opacity = String(Math.max(0, Math.min(1, 1 + offset / width)));
    }

    function clearInline() {
      const el = drawer.current;
      const shade = overlay.current;
      if (el) {
        el.style.translate = "";
        el.style.transition = "";
      }
      if (shade) {
        shade.style.opacity = "";
        shade.style.transition = "";
        shade.style.pointerEvents = "";
      }
    }

    function onStart(e: TouchEvent) {
      if (!media.matches || e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (open) {
        // Anywhere can close it.
      } else {
        const inZone = touch.clientX <= EDGE_PX || touch.clientX <= window.innerWidth * OPEN_ZONE_FRACTION;
        if (!inZone) return;
        if (touch.clientX > EDGE_PX && claimsHorizontalGestures(e.target)) return;
      }
      window.clearTimeout(settleTimer);
      clearInline();
      tracking = true;
      dragging = false;
      startX = touch.clientX;
      startY = touch.clientY;
      width = drawer.current?.offsetWidth || 288;
      base = open ? 0 : -width;
      x = base;
      prevX = lastX = startX;
      prevT = lastT = e.timeStamp;
    }

    function onMove(e: TouchEvent) {
      if (!tracking) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (!dragging) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        const horizontal = Math.abs(dx) > Math.abs(dy) * 1.3;
        const rightWay = open ? dx < 0 : dx > 0;
        if (!horizontal || !rightWay) {
          tracking = false;
          return;
        }
        dragging = true;
        const el = drawer.current;
        const shade = overlay.current;
        if (el) el.style.transition = "none";
        if (shade) {
          shade.style.transition = "none";
          shade.style.pointerEvents = "auto";
        }
      }

      if (e.cancelable) e.preventDefault();
      x = Math.max(-width, Math.min(0, base + dx));
      prevX = lastX;
      prevT = lastT;
      lastX = touch.clientX;
      lastT = e.timeStamp;
      paint(x);
    }

    function onEnd() {
      if (!tracking) return;
      tracking = false;
      if (!dragging) return;
      dragging = false;

      const dt = lastT - prevT;
      const velocity = dt > 0 ? (lastX - prevX) / dt : 0;
      const shouldOpen =
        velocity > FLICK_PX_PER_MS ? true : velocity < -FLICK_PX_PER_MS ? false : x > -width / 2;

      // Let the last bit animate from where the finger left it, then hand
      // control back to the normal open/closed classes.
      const ms = reduceMotion ? 0 : SETTLE_MS;
      const el = drawer.current;
      const shade = overlay.current;
      if (el) el.style.transition = `translate ${ms}ms ease-out`;
      if (shade) shade.style.transition = `opacity ${ms}ms ease-out`;
      paint(shouldOpen ? 0 : -width);
      setOpen(shouldOpen);
      settleTimer = window.setTimeout(clearInline, ms + 30);
    }

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      window.clearTimeout(settleTimer);
      clearInline();
    };
  }, [open, setOpen, drawer, overlay]);

  // Escape closes it too, for a keyboard.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);
}
