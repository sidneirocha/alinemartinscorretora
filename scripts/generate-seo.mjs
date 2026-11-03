import { readFileSync, writeFileSync } from 'node:fs';

const site = 'https://corretoraalinemartins.com.br';
const catalog = JSON.parse(readFileSync(new URL('../content/properties.json', import.meta.url), 'utf8'));
const paths = ['/', '/imoveis/', '/sobre/', '/contato/', '/privacidade/'];
for (const property of catalog.properties || []) {
  try {
    const pathname = new URL(property.url).pathname;
    paths.push(pathname.endsWith('/') ? pathname : `${pathname}/`);
  } catch {}
}
const uniquePaths = [...new Set(paths)];
const urls = uniquePaths.map(path => `  <url><loc>${site}${path}</loc><changefreq>${path === '/' ? 'weekly' : 'daily'}</changefreq><priority>${path === '/' ? '1.0' : path === '/imoveis/' ? '0.9' : '0.7'}</priority></url>`).join('\n');
writeFileSync(new URL('../public/sitemap.xml', import.meta.url), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
