import { describe, it, expect } from 'vitest';
import { getPhotoImageStyle, parsePhotoRenderLayout, serializePhotoRenderLayout } from './photoRendering';

describe('photoRendering', () => {
  it('parses preset layouts consistently', () => {
    expect(parsePhotoRenderLayout('top')).toMatchObject({ focusX: 50, focusY: 50, scale: 1, fit: 'cover', preset: 'top' });
    expect(parsePhotoRenderLayout('center')).toMatchObject({ focusX: 50, focusY: 50, scale: 1, fit: 'cover', preset: 'center' });
    expect(parsePhotoRenderLayout('bottom')).toMatchObject({ focusX: 50, focusY: 50, scale: 1, fit: 'cover', preset: 'bottom' });
  });

  it('round-trips saved crop data', () => {
    const saved = serializePhotoRenderLayout({ focusX: 50, focusY: 80, scale: 1, fit: 'cover' });
    expect(parsePhotoRenderLayout(saved)).toMatchObject({ focusX: 50, focusY: 80, scale: 1, fit: 'cover' });
  });

  it('produces identical crop styles for all renderers', () => {
    expect(getPhotoImageStyle(parsePhotoRenderLayout('top'))).toMatchObject({
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: '50% 0%',
    });
    expect(getPhotoImageStyle(parsePhotoRenderLayout('center'))).toMatchObject({
      objectPosition: '50% 50%',
    });
    expect(getPhotoImageStyle(parsePhotoRenderLayout('bottom'))).toMatchObject({
      objectPosition: '50% 100%',
    });
  });
});

