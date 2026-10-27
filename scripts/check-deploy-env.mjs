import { loadEnv } from 'vite';

const env = loadEnv('production', process.cwd(), 'VITE_');
for (const name of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
  if (!env[name]?.trim()) {
    throw new Error(`Missing ${name}: configure .env.local before deploying.`);
  }
}
const url = new URL(env.VITE_SUPABASE_URL);
if (url.protocol !== 'https:') {
  throw new Error('VITE_SUPABASE_URL must use HTTPS for the public site.');
}
const key = env.VITE_SUPABASE_ANON_KEY;
let isPublicKey = key.startsWith('sb_publishable_');
if (!isPublicKey) {
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    isPublicKey = payload.role === 'anon';
  } catch {
    // Invalid keys must not be shipped as part of the public build.
  }
}
if (!isPublicKey) {
  throw new Error('Use a Supabase publishable or legacy anon key, never a secret/service_role key.');
}
console.log('Deployment environment checked (values hidden).');
