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
  const email = `temp_${Date.now()}@example.com`;
  const password = 'TemporaryPassword123!';
  
  console.log("Signing up temporary user...");
  await supabase.auth.signUp({ email, password });

  console.log("Querying distinct gender values from chapter_templates...");
  const { data, error } = await supabase.from('chapter_templates').select('gender');
  if (error) {
    console.error("Error fetching templates:", error);
  } else {
    const genders = new Set(data.map(d => d.gender));
    console.log("Distinct genders:", Array.from(genders));
    console.log("Total templates count:", data.length);
  }
}

run();
