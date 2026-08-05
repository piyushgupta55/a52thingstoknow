import { ImagePlus, X } from 'lucide-react';
import { getPhotoImageStyle, parsePhotoRenderLayout } from '@/features/photoRendering';
import { PREVIEW_PHOTO_BLOCK_HEIGHT, PREVIEW_PHOTO_VERTICAL_WIDTH } from '@/features/preview/geometry';

interface Props {
  photoUrls: string[];
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (index: number) => void;
  variant?: 'horizontal' | 'vertical';
  photoLayout?: string | null;
}

const PhotoUploadZone = ({ photoUrls, uploading, onUpload, onRemove, variant = 'horizontal', photoLayout }: Props) => {
  const photo = photoUrls[0];
  const isVertical = variant === 'vertical';
  const layout = parsePhotoRenderLayout(photoLayout);


  const emptyHeight = `${PREVIEW_PHOTO_BLOCK_HEIGHT}px`;
  const emptyWidth = isVertical ? `${PREVIEW_PHOTO_VERTICAL_WIDTH}px` : '100%';

  const emptyLabel = isVertical
    ? 'Add a vertical photo — portrait orientation works best'
    : 'Add a horizontal photo — landscape orientation works best';

  const photoClass = isVertical ? 'chapter-photo vertical-photo' : 'chapter-photo';

  return (
    <div className={`mb-6 ${isVertical ? 'flex justify-center' : 'w-full'}`}>
      {photo ? (
        <div className={`space-y-3 w-full ${isVertical ? 'flex justify-center' : ''}`}>
          <div
            className="relative overflow-hidden rounded-sm w-full"
            style={{ height: `${PREVIEW_PHOTO_BLOCK_HEIGHT}px` }}
          >
            <img src={photo} alt="Chapter photo" className={photoClass} style={getPhotoImageStyle(layout)} />
            <button
              onClick={() => onRemove(0)}
              className="absolute top-3 right-3 bg-foreground/60 text-background rounded-full p-1.5 hover:bg-foreground/80 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      ) : (
        <label
          className="block border border-dashed border-[hsl(var(--devotional-border))] rounded-sm cursor-pointer hover:border-[#C9A84C] transition-colors group"
          style={{ width: emptyWidth, height: emptyHeight }}
        >
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors">
            <ImagePlus className="h-5 w-5" />
            <span className="text-[0.7rem] text-center px-4" style={{ fontFamily: 'var(--font-body)' }}>
              {uploading ? 'Uploading…' : emptyLabel}
            </span>
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={onUpload}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
};

export default PhotoUploadZone;
