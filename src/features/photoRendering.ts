export type PhotoFocus = 'top' | 'center' | 'bottom';

export interface PhotoRenderLayout {
  focusX: number;
  focusY: number;
  scale: number;
  fit: 'cover';
}

export const DEFAULT_PHOTO_RENDER_LAYOUT: PhotoRenderLayout = {
  focusX: 50,
  focusY: 50,
  scale: 1,
  fit: 'cover',
};

export const PHOTO_FOCUS_PRESETS: Record<PhotoFocus, Pick<PhotoRenderLayout, 'focusX' | 'focusY'>> = {
  top: { focusX: 50, focusY: 0 },
  center: { focusX: 50, focusY: 50 },
  bottom: { focusX: 50, focusY: 100 },
};

export const parsePhotoRenderLayout = (value: string | null | undefined): PhotoRenderLayout => {
  return DEFAULT_PHOTO_RENDER_LAYOUT;
};

export const serializePhotoRenderLayout = (layout: PhotoRenderLayout): string => JSON.stringify(layout);

export const getPhotoFocusLabel = (layout: PhotoRenderLayout): PhotoFocus => {
  if (layout.focusY <= 20) return 'top';
  if (layout.focusY >= 80) return 'bottom';
  return 'center';
};

export const getPhotoImageStyle = (layout: PhotoRenderLayout) => ({
  width: '100%',
  height: '100%',
  objectFit: layout.fit,
  objectPosition: `${layout.focusX}% ${layout.focusY}%`,
  transform: layout.scale === 1 ? undefined : `scale(${layout.scale})`,
  transformOrigin: 'center center',
});
