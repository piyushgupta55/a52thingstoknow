import type React from 'react';

export interface Memory {
  id: string;
  chapter_id: string;
  contributor_name: string;
  memory_text: string;
}

export interface Book {
  id: string;
  recipient_name: string;
  recipient_gender: string;
  relationship: string;
  occasion: string;
  user_id: string;
  from_label: string | null;
  author_label: string | null;
}

export interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  status: string;
  content: string | null;
  reference_text: string | null;
  bible_verse_text: string | null;
  bible_verse_reference: string | null;
  quote_text: string | null;
  quote_attribution: string | null;
  photo_urls: string[];
  chapter_template: string;
  is_photo_chapter: boolean;
}

export interface ChapterTemplate {
  chapter_number: number;
  title: string;
  is_photo_chapter: boolean;
  reference_content_male: string | null;
  reference_content_female: string | null;
}

export type SpreadDef =
  | { type: 'title' }
  | { type: 'toc_letter' }
  | { type: 'chapter'; chapter: Chapter }
  | { type: 'ancestry' };

export type SpreadRender = [React.ReactNode, React.ReactNode, string | undefined, boolean, React.ReactNode | null];
