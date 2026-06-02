import { type ReactNode } from 'react';
import {
  PREVIEW_PAGE_FOOTER_HEIGHT,
  PREVIEW_PAGE_HEIGHT,
  PREVIEW_PAGE_PADDING_INNER,
  PREVIEW_PAGE_PADDING_OUTER,
  PREVIEW_PAGE_PADDING_TOP,
  PREVIEW_PAGE_WIDTH,
} from '@/features/preview/geometry';

interface Props {
  children: ReactNode;
  previewMode?: boolean;
  pageNumber?: number;
  wordCount?: number;
  wordLimit?: number;
  showWordCount?: boolean;
  companionSlot?: ReactNode;
}

const PageCanvas = ({ children, previewMode = false, pageNumber, wordCount, wordLimit, showWordCount = false, companionSlot }: Props) => {
  const percent = wordLimit && wordCount != null ? (wordCount / wordLimit) * 100 : 0;

  let countColor = '#9CA3AF';
  let message = '';
  if (percent >= 100) {
    countColor = '#EF4444';
    message = 'This page is full — your words look beautiful';
  } else if (percent >= 90) {
    countColor = '#EF4444';
    message = 'Page almost full — a great place to close your thought';
  } else if (percent >= 75) {
    countColor = '#D97706';
  }

  const isLeftPage = pageNumber !== 2;
  const paddingLeft = isLeftPage ? PREVIEW_PAGE_PADDING_OUTER : PREVIEW_PAGE_PADDING_INNER;
  const paddingRight = isLeftPage ? PREVIEW_PAGE_PADDING_INNER : PREVIEW_PAGE_PADDING_OUTER;

  return (
    <div
      className="relative mx-auto"
      style={{
        width: `${PREVIEW_PAGE_WIDTH}px`,
        maxWidth: '100%',
        minHeight: `${PREVIEW_PAGE_HEIGHT}px`,
        height: previewMode ? `${PREVIEW_PAGE_HEIGHT}px` : undefined,
        background: '#FFFFFF',
        borderRadius: '4px',
        boxShadow: previewMode
          ? '0 4px 20px rgba(0,0,0,0.12)'
          : '0 2px 12px rgba(0,0,0,0.08)',
        padding: `${PREVIEW_PAGE_PADDING_TOP}px ${paddingRight}px ${PREVIEW_PAGE_FOOTER_HEIGHT}px ${paddingLeft}px`,
        overflow: previewMode ? 'hidden' : 'visible',
      }}
    >
      {companionSlot && (
        <div className="absolute -top-5 -right-5 z-20">
          {companionSlot}
        </div>
      )}

      {children}

      {showWordCount && wordCount != null && wordLimit && (
        <div className="absolute bottom-3 right-5 text-right">
          <p
            className="text-[0.6rem] tracking-wide"
            style={{ fontFamily: 'var(--font-body)', color: countColor }}
          >
            Page {pageNumber} · {wordCount} / {wordLimit} words
          </p>
          {message && (
            <p
              className="text-[0.55rem] mt-0.5 italic"
              style={{ fontFamily: 'var(--font-body)', color: countColor }}
            >
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default PageCanvas;
