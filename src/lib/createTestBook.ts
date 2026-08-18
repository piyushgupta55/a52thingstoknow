import { supabase } from './supabase';

export const createTestBook = async (userId: string) => {
  // 1. Create Book
  const { data: book, error: bookError } = await supabase
    .from('books')
    .insert({
      user_id: userId,
      recipient_name: 'Test Recipient',
      relationship: 'Daughter',
      recipient_gender: 'Girl/Young Woman',
      gender: 'female',
      occasion: '18th Birthday',
      writing_tone: 'Warm and Conversational',
      from_label: 'Mom and Dad',
      author_label: 'Mom',
    })
    .select()
    .single();

  if (bookError) throw bookError;

  // 2. Create Intro / Letter from the Author
  const letterChapter = {
    book_id: book.id,
    chapter_number: 0,
    title: 'Letter from the Author',
      review_status: null,
    chapter_template: 'letter',
    is_photo_chapter: false,
    photo_urls: [],
    photo_layout: 'top',
    content: '<p>Welcome to this book. May the thoughts and memories compiled within these pages bring you comfort, joy, and inspiration. It has been a labor of love to gather these words of wisdom, and I hope they serve as a guide for you in your journey ahead.</p><p>As you read through these chapters, remember that wisdom is not a destination but a way of traveling. Enjoy every step.</p>',
  };

  // 3. Create regular chapters matching Simple Phase 4 Test Plan
  const chapters = [
    {
      book_id: book.id,
      chapter_number: 1,
      title: 'Chapter A: The Depth of Wisdom',
      chapter_template: 'classic',
      is_photo_chapter: false,
      photo_urls: [],
      photo_layout: 'top',
      review_status: null,
      content: `
        <p>Wisdom begins with listening, not speaking. In a world filled with endless noise, the quiet mind becomes a sanctuary for truth. When we take the time to pause and reflect on the moments that define our lives, we discover that the most profound lessons are often found in the quietest spaces.</p>
        <p>To build a life of meaning, one must cultivate patience. Patience is not merely the ability to wait, but the attitude we maintain while waiting. It is the understanding that growth takes time, like a seed developing under the dark soil before it breaks through to the light. We cannot rush the seasons of our lives, and attempting to do so only leads to frustration and missed opportunities.</p>
        <p>Gratitude is the lens that transforms ordinary days into thanksgiving. When we focus on what we lack, our world shrinks. But when we focus on what we have, our hearts expand. Gratitude is not a response to good fortune; it is a choice to see the beauty in every circumstance, to find the silver linings even when the sky is covered in clouds.</p>
        <p>Kindness is a language that the deaf can hear and the blind can see. A simple act of kindness, no matter how small, has a ripple effect that can change the course of someone's day. It requires no wealth, no status, and no special talent—only a willing heart and a moment of genuine presence.</p>
        <p>Finally, we must remember that failure is not the opposite of success, but a stepping stone toward it. Every setback is an opportunity to learn, to adjust our course, and to grow stronger. Those who never fail are those who never try. Embrace the challenges, for they are the very things that shape our character and build our resilience.</p>
        <p>Walk slowly, love deeply, and always keep your mind open to the wonders of the journey. The destination is important, but the person we become along the way is what truly matters. Trust the process, believe in your path, and keep moving forward with hope in your heart.</p>
      `,
    },
    {
      book_id: book.id,
      chapter_number: 2,
      title: 'Chapter B: Cinematic Horizons',
      chapter_template: 'horizontal_photo',
      is_photo_chapter: true,
      photo_urls: ['https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1000&auto=format&fit=crop'],
      photo_layout: 'top',
      review_status: null,
      content: `
        <p>There is a unique clarity that comes from standing on the peak of a mountain, looking out over the vast expanse below. The challenges that seemed so large from the valley suddenly appear small and manageable. Nature has a way of restoring our perspective if we are willing to step away and listen.</p>
        <p>When we align our path with the natural rhythms of life, we find a sense of peace that no material success can replicate. Let the mountains teach you strength, and let the rivers teach you flow.</p>
      `,
      quote_text: 'In all things of nature there is something of the marvelous.',
      quote_attribution: 'Aristotle',
      bible_verse_text: 'The heavens declare the glory of God; the skies proclaim the work of his hands.',
      bible_verse_reference: 'Psalm 19:1'
    },
    {
      book_id: book.id,
      chapter_number: 3,
      title: 'Chapter C: Vertical Perspectives',
      chapter_template: 'vertical_photo',
      is_photo_chapter: true,
      photo_urls: ['https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1000&auto=format&fit=crop'],
      photo_layout: 'top',
      review_status: null,
      content: `
        <p>Standing tall amidst the storm is not about being rigid; it is about having roots that run deep enough to hold you steady while the branches bend. The trees in the forest survive high winds because they grow together, their root systems intertwining beneath the soil to form a support network that cannot be broken by any single gust.</p>
        <p>In our own lives, we need that same interconnectedness. We cannot walk this path alone, nor were we ever meant to. The relationships we build, the love we share, and the communities we foster are the roots that sustain us through the storms of life. Nourish those roots, for they are your true strength.</p>
      `,
    }
  ];

  const { data: insertedChapters, error: chapError } = await supabase
    .from('chapters')
    .insert([letterChapter, ...chapters])
    .select();

  if (chapError) throw chapError;

  // 4. Create Memories for Chapter A and Chapter C
  const memoriesToInsert = [];

  // Chapter A (Chapter 1)
  const chapA = insertedChapters.find(c => c.chapter_number === 1);
  if (chapA) {
    memoriesToInsert.push(
      {
        book_id: book.id,
        chapter_id: chapA.id,
        status: 'approved',
        memory_text: 'I remember when you showed me how to listen to the wind in the trees. It taught me to appreciate the silence.',
        contributor_name: 'Sarah',
        contributor_type: 'family',
        size_tag: 'medium'
      },
      {
        book_id: book.id,
        chapter_id: chapA.id,
        status: 'approved',
        memory_text: 'Your patience during my hardest years was a beacon of hope. Thank you for never giving up on me.',
        contributor_name: 'James',
        contributor_type: 'family',
        size_tag: 'medium'
      }
    );
  }

  // Chapter C (Chapter 3)
  const chapC = insertedChapters.find(c => c.chapter_number === 3);
  if (chapC) {
    memoriesToInsert.push({
      book_id: book.id,
      chapter_id: chapC.id,
      status: 'approved',
      memory_text: 'I will always remember our walk through the redwood forest, and how you showed me the strength in standing together.',
      contributor_name: 'David',
      contributor_type: 'family',
      size_tag: 'medium'
    });
  }

  if (memoriesToInsert.length > 0) {
    const { error: memError } = await supabase.from('memories').insert(memoriesToInsert);
    if (memError) throw memError;
  }

  return book.id;
};
