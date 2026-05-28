import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read .env file manually using process.cwd()
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnvVar = (name: string) => {
  const match = envContent.match(new RegExp(`${name}\\s*=\\s*["']?([^"'\r\n]+)["']?`));
  return match ? match[1] : undefined;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseKey = getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY');

async function check() {
  console.log('Supabase URL:', supabaseUrl);
  // We can use the service role key if it's there, but let's query with the anon key
  const supabase = createClient(supabaseUrl!, supabaseKey!);
  
  // Fetch all books
  const { data: books, error: booksError } = await supabase.from('books').select('*');
  if (booksError) {
    console.error('Error fetching books:', booksError);
    return;
  }
  
  console.log(`Found ${books.length} books.`);

  for (const book of books) {
    const { data: chapters, error: chapError } = await supabase
      .from('chapters')
      .select('id, chapter_number, status, title, content, reference_text')
      .eq('book_id', book.id);
    
    const { data: memories, error: memError } = await supabase
      .from('memories')
      .select('id, contributor_name, memory_text')
      .eq('book_id', book.id);
      
    console.log(`\nBook: "${book.recipient_name}" (${book.id})`);
    console.log(`  Chapters count: ${chapters?.length || 0}`);
    if (chapters) {
      const complete = chapters.filter(c => c.status === 'complete');
      const inProgress = chapters.filter(c => c.status === 'in_progress');
      console.log(`  Complete chapters count: ${complete.length}`);
      complete.forEach(c => {
        console.log(`    - Ch ${c.chapter_number}: "${c.title}" (Content length: ${c.content?.length || 0})`);
      });
      console.log(`  In-progress chapters count: ${inProgress.length}`);
      inProgress.forEach(c => {
        console.log(`    - Ch ${c.chapter_number}: "${c.title}" (Content length: ${c.content?.length || 0})`);
      });
    }
    console.log(`  Memories count: ${memories?.length || 0}`);
    if (memories && memories.length > 0) {
      memories.forEach(m => {
        console.log(`    - Memory by ${m.contributor_name}: "${m.memory_text?.slice(0, 40)}..."`);
      });
    }
  }
}

check();
