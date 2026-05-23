import type { BookData } from '../types/pdf';

export interface ValidationWarning {
  chapterNumber: number;
  type: 'text_overflow' | 'memory_overflow' | 'photo_missing' | 'image_low_res' | 'image_aspect_ratio';
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  warnings: ValidationWarning[];
}

export function validateChapterLength(bookData: BookData): ValidationResult {
  const warnings: ValidationWarning[] = [];

  for (const chapter of bookData.chapters) {
    // 1. Check text limits based on template
    const rawTemplate = chapter.chapter_template || 'classic';
    const template = (rawTemplate === 'all_words') ? 'classic' :
                     (rawTemplate === 'photo_top') ? 'horizontal_photo' :
                     (rawTemplate === 'photo_second') ? 'vertical_photo' :
                     rawTemplate;

    // Strip HTML to get raw text length
    const rawText = chapter.content?.replace(/<[^>]+>/g, '') || '';
    const charCount = rawText.length;

    let maxChars = 2500; // Classic default
    if (chapter.chapter_number === 0) {
      maxChars = 1500; // Intro letter
    } else if (template === 'vertical_photo') {
      maxChars = 1000;
    } else if (template === 'horizontal_photo') {
      maxChars = 1200;
    }

    if (charCount > maxChars) {
      warnings.push({
        chapterNumber: chapter.chapter_number || 0,
        type: 'text_overflow',
        message: `Chapter ${chapter.chapter_number} text is too long (${charCount} chars). Maximum recommended for '${template}' is ${maxChars} chars. Text will be truncated.`
      });
    }

    // 2. Check memories limit
    if (chapter.memories && chapter.memories.length > 3) {
      warnings.push({
        chapterNumber: chapter.chapter_number || 0,
        type: 'memory_overflow',
        message: `Chapter ${chapter.chapter_number} has ${chapter.memories.length} memories. Maximum recommended is 3. Extra memories will be hidden.`
      });
    }

    // Memory character length
    if (chapter.memories) {
      chapter.memories.forEach((mem, idx) => {
        if (mem.memory_text.length > 400) {
           warnings.push({
            chapterNumber: chapter.chapter_number || 0,
            type: 'memory_overflow',
            message: `Chapter ${chapter.chapter_number} memory #${idx + 1} is too long (${mem.memory_text.length} chars). Maximum is 400. Text will be truncated.`
          });
        }
      });
    }
  }

  return {
    valid: warnings.length === 0,
    warnings
  };
}
