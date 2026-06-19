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

export const parsePhotoRenderLayout = (value: string | null | undefined): PhotoRenderLayout => {
  if (!value) return DEFAULT_PHOTO_RENDER_LAYOUT;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return {
        ...DEFAULT_PHOTO_RENDER_LAYOUT,
        ...parsed,
        fit: 'contain' // Force fit to contain to override any saved 'cover' value
      };
    }
  } catch (e) {
    if (value === 'left' || value === 'right' || value === 'top' || value === 'bottom' || value === 'center') {
      return {
        ...DEFAULT_PHOTO_RENDER_LAYOUT,
        preset: value,
        fit: 'contain' // Force fit to contain
      };
    }
  }
  return DEFAULT_PHOTO_RENDER_LAYOUT;
};

export const getPhotoImageStyle = (layout: PhotoRenderLayout & { preset?: string }) => {
  return {
    width: '100%',
    height: 'auto',
    display: 'block',
  };
};

export const PHOTO_FOCUS_PRESETS: Record<PhotoFocus, Pick<PhotoRenderLayout, 'focusX' | 'focusY'>> = {
  top: { focusX: 50, focusY: 0 },
  center: { focusX: 50, focusY: 50 },
  bottom: { focusX: 50, focusY: 100 },
};

