/**
 * Capture a screenshot of the current page with any feedback UI hidden.
 *
 * Elements marked with `data-feedback-ui` are hidden during the capture,
 * along with any open Radix dialogs / overlays.
 */
export async function captureScreen(): Promise<File | null> {
  const selectors = [
    '[data-feedback-ui]',
    '[role="dialog"]',
    '[data-radix-dialog-overlay]',
    '[data-radix-popper-content-wrapper]',
  ].join(', ');

  const els = Array.from(document.querySelectorAll(selectors)) as HTMLElement[];
  const prev = els.map((el) => el.style.visibility);
  els.forEach((el) => (el.style.visibility = 'hidden'));

  // Let the browser paint the hidden state.
  await new Promise((r) => setTimeout(r, 120));

  try {
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(document.body, {
      useCORS: true,
      logging: false,
      scale: Math.min(window.devicePixelRatio || 1, 2),
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight,
      // Capture what the user actually sees rather than the full page.
      x: window.scrollX,
      y: window.scrollY,
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    });

    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob(res, 'image/png', 0.92)
    );
    if (!blob) return null;
    return new File([blob], `screen-${Date.now()}.png`, { type: 'image/png' });
  } finally {
    els.forEach((el, i) => (el.style.visibility = prev[i] ?? ''));
  }
}
