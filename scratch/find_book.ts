import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const getEnvVal = (key: string) => {
  const match = env.match(new RegExp(`${key}="?([^"\\n]+)"?`));
  return match ? match[1] : '';
};

const supabase = createClient(
  getEnvVal('VITE_SUPABASE_URL'),
  getEnvVal('VITE_SUPABASE_PUBLISHABLE_KEY')
);

async function run() {
  const { data: books, error } = await supabase.from('books').select('id, recipient_name, occasion');
  if (error) {
    console.error(error);
  } else {
    console.log('Books:', books);
  }
}

run();
