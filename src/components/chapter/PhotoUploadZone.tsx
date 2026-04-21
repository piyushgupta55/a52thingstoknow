import { ImagePlus, X } from 'lucide-react';

interface Props {
  photoUrls: string[];
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (index: number) => void;
  variant?: 'horizontal' | 'vertical';
}

const PhotoUploadZone = ({ photoUrls, uploading, onUpload, onRemove, variant = 'horizontal' }: Props) => {
  const photo = photoUrls[0];
  const isVertical = variant === 'vertical';

  const emptyHeight = isVertical ? '340px' : '200px';
  const filledHeight = isVertical ? '340px' : '200px';
  const emptyWidth = isVertical ? '260px' : '100%';

  const emptyLabel = isVertical
    ? 'Add a vertical photo — portrait orientation works best'
    : 'Add a horizontal photo — landscape orientation works best';

  return (
    <div className={`mb-6 ${isVertical ? 'flex justify-center' : ''}`}>
      {photo ? (
        <div
          className="relative overflow-hidden rounded-sm"
          style={{ width: isVertical ? '280px' : '100%', height: filledHeight }}
        >
          <img src={photo} alt="Chapter photo" className="w-full h-full object-cover" />
          <button
            onClick={() => onRemove(0)}
            className="absolute top-3 right-3 bg-foreground/60 text-background rounded-full p-1.5 hover:bg-foreground/80 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
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
