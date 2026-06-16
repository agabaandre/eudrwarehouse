const express = require('express');
const config = require('../config');

const router = express.Router();

router.get('/robots.txt', (req, res) => {
  const base = config.publicBaseUrl || `${req.protocol}://${req.get('host')}`;
  res.type('text/plain');
  res.send(`# MAAIF EUDR Compliance Platform
User-agent: *
Allow: /
Allow: /analytics
Allow: /maps
Allow: /registration
Disallow: /management
Disallow: /api/
Disallow: /superset/

Sitemap: ${base}/sitemap.xml
`);
});

router.get('/sitemap.xml', (req, res) => {
  const base = (config.publicBaseUrl || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const pages = [
    { loc: '/', priority: '1.0', freq: 'weekly' },
    { loc: '/registration', priority: '0.9', freq: 'weekly' },
    { loc: '/analytics', priority: '0.9', freq: 'daily' },
    { loc: '/maps', priority: '0.8', freq: 'weekly' },
  ];
  const urls = pages.map((p) => `  <url>
    <loc>${base}${p.loc}</loc>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n');

  res.type('application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`);
});

module.exports = router;
