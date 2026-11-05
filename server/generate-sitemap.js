import { config } from 'dotenv';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// This script may be invoked from the repo root (deploy.sh) or from server/.
// GOOGLE_APPLICATION_CREDENTIALS in .env is a path relative to server/, so
// chdir there first — otherwise credential resolution silently breaks
// depending on the caller's cwd.
process.chdir(__dirname);
config({ path: join(__dirname, '.env') });

const { default: admin } = await import('./firebase-admin.js');
const SITE_URL = process.env.SITE_URL || 'https://mjshoes.xyz';

const STATIC_PAGES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/shop', changefreq: 'daily', priority: '0.9' },
  { path: '/about', changefreq: 'monthly', priority: '0.5' },
  { path: '/contact', changefreq: 'monthly', priority: '0.5' },
  { path: '/faq', changefreq: 'monthly', priority: '0.4' },
  { path: '/size-guide', changefreq: 'monthly', priority: '0.4' },
  { path: '/shipping-returns', changefreq: 'monthly', priority: '0.4' },
  { path: '/track-order', changefreq: 'monthly', priority: '0.3' },
  { path: '/privacy-policy', changefreq: 'yearly', priority: '0.2' },
  { path: '/terms', changefreq: 'yearly', priority: '0.2' },
];

function urlEntry(loc, changefreq, priority) {
  return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

async function main() {
  const entries = STATIC_PAGES.map(p => urlEntry(`${SITE_URL}${p.path}`, p.changefreq, p.priority));

  const snap = await admin.firestore().collection('products').get();
  snap.forEach(doc => {
    entries.push(urlEntry(`${SITE_URL}/product/${doc.id}`, 'weekly', '0.7'));
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;

  const outPath = join(__dirname, '..', 'public', 'sitemap.xml');
  writeFileSync(outPath, xml);
  console.log(`Sitemap written to ${outPath} with ${entries.length} URLs (${snap.size} products).`);
  process.exit(0);
}

main().catch(err => {
  console.error('Failed to generate sitemap:', err);
  process.exit(1);
});
