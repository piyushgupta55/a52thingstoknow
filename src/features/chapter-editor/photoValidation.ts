export interface PhotoValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

export const validatePhoto = (file: File, variant: 'horizontal' | 'vertical'): Promise<PhotoValidationResult> => {
  return new Promise((resolve) => {
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      resolve({ valid: false, error: 'Only JPG and PNG formats are accepted for print quality.' });
      return;
    }

    if (file.size < 500 * 1024) {
      resolve({ valid: false, error: 'This photo is under 500KB — it may be too low quality for print. Please choose a higher resolution image.' });
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      resolve({ valid: false, error: 'This photo exceeds the 15MB limit. Please compress or resize it before uploading.' });
      return;
    }

    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      URL.revokeObjectURL(img.src);
      if (w < 300 || h < 300) {
        resolve({ valid: false, error: 'This photo is too low resolution for print. Please choose a higher quality image.' });
        return;
      }
      const minW = variant === 'horizontal' ? 1200 : 800;
      const minH = variant === 'horizontal' ? 800 : 1200;
      if (w < minW || h < minH) {
        resolve({ valid: true, warning: `This photo may appear blurry in print (${w}x${h}px). A minimum of ${minW}x${minH}px is recommended. You can still use it.` });
        return;
      }
      resolve({ valid: true });
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      resolve({ valid: false, error: 'Could not read this image file. Please try a different photo.' });
    };
    img.src = URL.createObjectURL(file);
  });
};
