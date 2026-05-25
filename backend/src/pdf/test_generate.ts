import { generatePDF } from './generatePDF';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const bookData = {
    title: 'A Book of Wisdom',
    author: 'Eleanor Vance',
    chapters: [
      {
        chapter_number: 0,
        title: 'Introduction',
        content: '<p>Welcome to this book. May the thoughts and memories compiled within these pages bring you comfort, joy, and inspiration. It has been a labor of love to gather these words of wisdom, and I hope they serve as a guide for you in your journey ahead.</p><p>As you read through these chapters, remember that wisdom is not a destination but a way of traveling. Enjoy every step.</p>',
        chapter_template: 'letter',
        photo_urls: []
      },
      {
        chapter_number: 1,
        title: 'Chapter A: The Depth of Wisdom',
        chapter_template: 'classic',
        content: `
          <p>Wisdom begins with listening, not speaking. In a world filled with endless noise, the quiet mind becomes a sanctuary for truth. When we take the time to pause and reflect on the moments that define our lives, we discover that the most profound lessons are often found in the quietest spaces.</p>
          <p>To build a life of meaning, one must cultivate patience. Patience is not merely the ability to wait, but the attitude we maintain while waiting. It is the understanding that growth takes time, like a seed developing under the dark soil before it breaks through to the light. We cannot rush the seasons of our lives, and attempting to do so only leads to frustration and missed opportunities.</p>
          <p>Gratitude is the lens that transforms ordinary days into thanksgiving. When we focus on what we lack, our world shrinks. But when we focus on what we have, our hearts expand. Gratitude is not a response to good fortune; it is a choice to see the beauty in every circumstance, to find the silver linings even when the sky is covered in clouds.</p>
          <p>Kindness is a language that the deaf can hear and the blind can see. A simple act of kindness, no matter how small, has a ripple effect that can change the course of someone's day. It requires no wealth, no status, and no special talent—only a willing heart and a moment of genuine presence.</p>
          <p>Finally, we must remember that failure is not the opposite of success, but a stepping stone toward it. Every setback is an opportunity to learn, to adjust our course, and to grow stronger. Those who never fail are those who never try. Embrace the challenges, for they are the very things that shape our character and build our resilience.</p>
          <p>Walk slowly, love deeply, and always keep your mind open to the wonders of the journey. The destination is important, but the person we become along the way is what truly matters. Trust the process, believe in your path, and keep moving forward with hope in your heart.</p>
        `,
        memories: [
          { memory_text: 'I remember when you showed me how to listen to the wind in the trees. It taught me to appreciate the silence.', contributor_name: 'Sarah' },
          { memory_text: 'Your patience during my hardest years was a beacon of hope. Thank you for never giving up on me.', contributor_name: 'James' }
        ]
      },
      {
        chapter_number: 2,
        title: 'Chapter B: Cinematic Horizons',
        chapter_template: 'horizontal_photo',
        photo_urls: ['https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1000&auto=format&fit=crop'],
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
        chapter_number: 4,
        title: 'Chapter D: A Short Thought',
        chapter_template: 'classic',
        content: `
          <p>This is a very short chapter. It has only one paragraph, and it should easily fit on a single page without overflowing to the next page. Let's see if the layout engine removes the empty page 2 for this chapter.</p>
        `,
        memories: []
      },
      {
        chapter_number: 5,
        title: 'Chapter E: Short Vertical Photo',
        chapter_template: 'vertical_photo',
        photo_urls: ['https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1000&auto=format&fit=crop'],
        content: `
          <p>This is a short chapter with a vertical photo. Since the text is short, it and the photo should ideally fit together on page 1 without pushing the photo to page 2, or if it does push, let's see how it behaves.</p>
        `,
        memories: []
      }
    ],
    ancestryPdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
  };

  console.log('Generating PDF...');
  const pdfBuffer = await generatePDF(bookData);
  
  const outputPath = path.join(process.cwd(), 'test-output.pdf');
  fs.writeFileSync(outputPath, pdfBuffer);
  console.log(`PDF successfully generated and saved to ${outputPath}`);
}

main().catch(console.error);

