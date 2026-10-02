import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Read env variables
const envPath = '/Users/chiragpipal/Documents/a52thingstoknow/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const chapterId = '3a3dcf19-46a1-46a1-bd13-fed3728faee6';
  const { data, error } = await supabase.from('chapters').select('*').eq('id', chapterId).single();
  if (error) {
    console.error("Error fetching chapter:", error);
    return;
  }
  console.log("Chapter Number:", data.chapter_number);
  console.log("Title:", data.title);
  console.log("Reference Text Length:", data.reference_text?.length);
  console.log("Content Length:", data.content?.length);
  
  const refText = data.reference_text || '';
  const idx = refText.indexOf('date s');
  if (idx !== -1) {
    console.log("Found 'date s' at index", idx);
    const slice = refText.slice(idx - 10, idx + 20);
    console.log("Slice:", JSON.stringify(slice));
    for (let i = 0; i < slice.length; i++) {
      console.log(`Char at ${i}: ${slice[i]} (code: ${slice.charCodeAt(i)})`);
    }
  } else {
    console.log("'date s' not found in reference_text");
  }

  const contentText = data.content || '';
  const idxContent = contentText.indexOf('omeone');
  if (idxContent !== -1) {
    console.log("Found 'omeone' at content index", idxContent);
    const sliceContent = contentText.slice(idxContent - 10, idxContent + 20);
    console.log("Slice content:", JSON.stringify(sliceContent));
  } else {
    console.log("'omeone' not found in content");
  }
}

run();
