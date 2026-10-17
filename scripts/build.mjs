import { cp, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const dist = join(projectRoot, 'dist');
await mkdir(dist, { recursive: true });

// Static site only: no backend, credentials, or user project data on Vercel.
for (const filename of ['app.js', 'styles.css', 'styles-polish.css', 'og-image.png']) {
  await copyFile(join(projectRoot, filename), join(dist, filename));
}
for (const dirname of ['src', 'assets']) {
  await cp(join(projectRoot, dirname), join(dist, dirname), { recursive: true, force: true });
}

let html = await readFile(join(projectRoot, 'index.html'), 'utf8');
const providedHost = process.env.OG_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
let base = '';
if (providedHost) {
  try {
    const url = new URL(providedHost.startsWith('http') ? providedHost : `https://${providedHost}`);
    if (url.protocol !== 'https:') throw new Error('HTTPS required');
    base = url.origin;
  } catch (error) {
    throw new Error(`Invalid OG_SITE_URL/VERCEL host: ${error.message}`);
  }
}
if (base) {
  const imageUrl = `${base}/og-image.png`;
  html = html.replaceAll('content="/og-image.png"', `content="${imageUrl}"`);
  html = html.replace('  <meta property="og:type" content="website">',
    `  <meta property="og:url" content="${base}/">\n  <meta property="og:type" content="website">`);
  console.log(`OG image URL: ${imageUrl}`);
} else {
  // Relative URL for local preview; production should expose Vercel system envs.
  console.warn('No site URL found. OG image remains relative; set OG_SITE_URL or expose Vercel system environment variables.');
}
await writeFile(join(dist, 'index.html'), html, 'utf8');
console.log('GlobalSub static build complete: dist/');
