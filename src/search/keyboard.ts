import { useEffect } from 'react';

/** The on-screen keyboard is taken to be open when the visible area is this much shorter than the window. */
const KEYBOARD_MIN = 120;

/**
 * While the keyboard is up (iPhone), the page is as tall as what is still visible: the results list scrolls inside that
 * space, so the last result can be reached, and the tab bar, which would sit under the keyboard, is hidden (search.css
 * reads `data-kb` and `--vvh` on <html>). Without a visual viewport (desktop tests) it does nothing.
 */
export function useKeyboardFit(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const clear = () => {
      delete root.dataset.kb;
      root.style.removeProperty('--vvh');
    };
    const update = () => {
      if (window.innerHeight - vv.height > KEYBOARD_MIN) {
        root.dataset.kb = '';
        root.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
        if (window.scrollY !== 0 || vv.offsetTop !== 0) window.scrollTo(0, 0); // iOS pans the page to the field
      } else {
        clear();
      }
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      clear();
    };
  }, []);
}
