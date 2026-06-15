export type PhotoFocus = 'top' | 'center' | 'bottom';

export interface PhotoRenderLayout {
  focusX: number;
  focusY: number;
  scale: number;
  fit: 'contain' | 'cover';
  preset?: string;
}

export const DEFAULT_PHOTO_RENDER_LAYOUT: PhotoRenderLayout = {
  focusX: 50,
  focusY: 50,
  scale: 1,
  fit: 'contain',
};

export const PHOTO_FOCUS_PRESETS: Record<PhotoFocus, Pick<PhotoRenderLayout, 'focusX' | 'focusY'>> = {
  top: { focusX: 50, focusY: 0 },
  center: { focusX: 50, focusY: 50 },
  bottom: { focusX: 50, focusY: 100 },
};

export const parsePhotoRenderLayout = (value: string | null | undefined): PhotoRenderLayout => {
  if (!value) return DEFAULT_PHOTO_RENDER_LAYOUT;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return {
        ...DEFAULT_PHOTO_RENDER_LAYOUT,
        ...parsed
      };
    }
  } catch (e) {
    if (value === 'left' || value === 'right' || value === 'top' || value === 'bottom' || value === 'center') {
      return {
        ...DEFAULT_PHOTO_RENDER_LAYOUT,
        preset: value
      };
    }
  }
  return DEFAULT_PHOTO_RENDER_LAYOUT;
};

export const serializePhotoRenderLayout = (layout: PhotoRenderLayout): string => JSON.stringify(layout);

export const getPhotoFocusLabel = (layout: PhotoRenderLayout): PhotoFocus => {
  if (layout.preset) {
    if (layout.preset === 'top' || layout.preset === 'left') return 'top';
    if (layout.preset === 'bottom' || layout.preset === 'right') return 'bottom';
    return 'center';
  }
  if (layout.focusY <= 20) return 'top';
  if (layout.focusY >= 80) return 'bottom';
  return 'center';
};

export const getPhotoImageStyle = (layout: PhotoRenderLayout & { preset?: string }) => {
  let objectPosition = `${layout.focusX}% ${layout.focusY}%`;
  if (layout.preset === 'left') objectPosition = '0% 50%';
  else if (layout.preset === 'right') objectPosition = '100% 50%';
  else if (layout.preset === 'top') objectPosition = '50% 0%';
  else if (layout.preset === 'bottom') objectPosition = '50% 100%';
  else if (layout.preset === 'center') objectPosition = '50% 50%';

  return {
    width: '100%',
    height: '100%',
    objectFit: layout.fit,
    objectPosition,
    transform: layout.scale === 1 ? undefined : `scale(${layout.scale})`,
    transformOrigin: 'center center',
  };
};

