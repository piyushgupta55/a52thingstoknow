import { Camera } from 'lucide-react';

export type ChapterTemplate = 'all_words' | 'photo_top' | 'photo_second' | 'memories' | 'letter';

export const chapterTemplateLabels: Record<ChapterTemplate, string> = {
  all_words: 'Classic',
  photo_top: 'Horizontal Photo',
  photo_second: 'Vertical Photo',
  memories: 'Memories',
  letter: 'Letter',
};

interface Props {
  template: ChapterTemplate;
  onTemplateChange: (t: ChapterTemplate) => void;
  photoChapterCount: number;
  maxPhotoChapters?: number;
  disabled?: boolean;
  photoUrl?: string | null;
}

const MiniPage = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => (
  <div
    className={`bg-white rounded-[2px] border border-border/40 flex flex-col overflow-hidden ${className}`}
    style={{ width: '54px', height: '72px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
  >
    {children}
  </div>
);

const PhotoPlaceholder = ({ variant, photoUrl }: { variant: 'horizontal' | 'vertical'; photoUrl?: string | null }) => {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className="object-cover"
        style={
          variant === 'horizontal'
            ? { width: '100%', height: '28px' }
            : { width: '20px', height: '52px' }
        }
      />
    );
  }
  return (
    <div
      className="bg-muted/40 flex items-center justify-center flex-shrink-0"
      style={
        variant === 'horizontal'
          ? { width: '100%', height: '28px' }
          : { width: '20px', height: '52px' }
      }
    >
      <Camera className="h-2.5 w-2.5 text-muted-foreground/30" />
    </div>
  );
};

const TextLines = ({ count = 4, className = '' }: { count?: number; className?: string }) => (
  <div className={`flex flex-col gap-[3px] px-[5px] ${className}`}>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="rounded-full bg-muted-foreground/10"
        style={{ height: '2px', width: i === count - 1 ? '60%' : '100%' }}
      />
    ))}
  </div>
);

const templates: {
  value: ChapterTemplate;
  label: string;
  desc: string;
  isPhoto: boolean;
}[] = [
  { value: 'all_words', label: 'Classic', desc: 'No photo · 450 word budget', isPhoto: false },
  { value: 'photo_top', label: 'Horizontal Photo', desc: 'Photo on page 1 · 225 word budget', isPhoto: true },
  { value: 'photo_second', label: 'Vertical Photo', desc: 'Photo on page 2 · 175 word budget', isPhoto: true },
];

const TemplateSelector = ({
  template,
  onTemplateChange,
  photoChapterCount,
  maxPhotoChapters = 15,
  disabled,
  photoUrl,
}: Props) => {
  const isCurrentPhotoTemplate = template === 'photo_top' || template === 'photo_second';
  const atPhotoLimit = photoChapterCount >= maxPhotoChapters && !isCurrentPhotoTemplate;

  return (
    <div className="mb-6">
      <div className="grid grid-cols-3 gap-3">
        {templates.map(t => {
          const active = template === t.value;
          const photoDisabled = t.isPhoto && atPhotoLimit;
          const isDisabled = disabled || photoDisabled;

          return (
            <button
              key={t.value}
              onClick={() => !isDisabled && onTemplateChange(t.value)}
              disabled={isDisabled}
              className={`relative flex flex-col items-center gap-2 px-2 py-3 rounded-sm border transition-all text-center ${
                active
                  ? 'border-[#C9A84C] bg-[#C9A84C]/5'
                  : isDisabled
                  ? 'border-border/30 opacity-40 cursor-not-allowed'
                  : 'border-[hsl(var(--devotional-border))] hover:border-[#C9A84C]/50 cursor-pointer'
              }`}
            >
              {/* Layout preview thumbnails */}
              <div className="flex gap-1.5">
                {t.value === 'all_words' && (
                  <>
                    <MiniPage>
                      <div className="pt-2">
                        <TextLines count={6} />
                      </div>
                    </MiniPage>
                    <MiniPage>
                      <div className="pt-2">
                        <TextLines count={6} />
                      </div>
                    </MiniPage>
                  </>
                )}
                {t.value === 'photo_top' && (
                  <>
                    <MiniPage>
                      <PhotoPlaceholder variant="horizontal" photoUrl={photoUrl} />
                      <div className="pt-1.5 flex-1">
                        <TextLines count={4} />
                      </div>
                    </MiniPage>
                    <MiniPage>
                      <div className="pt-2">
                        <TextLines count={6} />
                      </div>
                    </MiniPage>
                  </>
                )}
                {t.value === 'photo_second' && (
                  <>
                    <MiniPage>
                      <div className="pt-2">
                        <TextLines count={6} />
                      </div>
                    </MiniPage>
                    <MiniPage>
                      <div className="flex flex-1 pt-2 gap-1 px-1">
                        <PhotoPlaceholder variant="vertical" photoUrl={photoUrl} />
                        <div className="flex-1 pt-0.5">
                          <TextLines count={5} />
                        </div>
                      </div>
                    </MiniPage>
                  </>
                )}
              </div>

              <div>
                <span
                  className={`text-[0.6rem] font-medium leading-tight block ${active ? 'text-foreground' : 'text-muted-foreground/60'}`}
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {t.label}
                </span>
                <span
                  className="text-[0.5rem] text-muted-foreground/40 leading-tight block mt-0.5"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {t.desc}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {atPhotoLimit && (
        <p className="mt-2 text-[0.6rem] text-destructive/70 leading-snug" style={{ fontFamily: 'var(--font-body)' }}>
          You've used all {maxPhotoChapters} photo chapters. Switch to Classic or remove a photo from another chapter.
        </p>
      )}
    </div>
  );
};

export default TemplateSelector;
