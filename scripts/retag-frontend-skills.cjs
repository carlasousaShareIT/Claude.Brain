const http = require('http');

const NAME_TO_PROJECT = {
  'Frontend overview': ['general'],
  '404Module': ['404module'],
  'Banners frontend': ['banners-editor'],
  'CoreJs': ['corejs-types'],
  'Customer templates (frontend rulebook)': ['customer-templates'],
  'Customers (legacy CSS)': ['customers'],
  'Experience builder': ['experience-builder'],
  'Experience builder: improvements': ['experience-builder'],
  'Experiences (search assistant)': ['experiences'],
  'Frontend good practices: testing': ['general'],
  'Frontend good practices': ['general'],
  'MyCludo': ['mycludo-perf'],
  'MyCludo: add beta key': ['mycludo-perf'],
  'MyCludo: add feature': ['mycludo-perf'],
  'MyCludo: endpoints': ['mycludo-perf'],
  'Search components (frontend rulebook)': ['search-components'],
  'Cludo search components': ['search-components'],
  'Cludo search components: exports': ['search-components'],
  'Create MFE': ['mfe-migration'],
  'Create MFE: MyCludo anchors': ['mfe-migration'],
  'Customer templates (SKILL)': ['customer-templates'],
  'Customer templates: link component library': ['customer-templates'],
  'Customer template: new project': ['customer-templates'],
  'MFE pattern': ['mfe-migration'],
  'MFE readme template': ['mfe-migration'],
  'Static files 404 reporting': ['404module'],
};

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 7777, path, method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
    };
    const r = http.request(opts, (res) => {
      let buf = ''; res.on('data', (c) => (buf += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(buf ? JSON.parse(buf) : null);
        else reject(new Error(`${res.statusCode}: ${buf}`));
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const skills = await req('GET', '/skills');
  const results = { ok: [], skipped: [], failed: [] };
  for (const skill of skills) {
    const target = NAME_TO_PROJECT[skill.name];
    if (!target) { results.skipped.push(skill.name); continue; }
    if (JSON.stringify(skill.project) === JSON.stringify(target)) { results.skipped.push(`${skill.name} (already correct)`); continue; }
    try {
      await req('PATCH', `/skills/${skill.id}`, { project: target });
      results.ok.push(`${skill.name} → ${target.join(',')}`);
    } catch (e) {
      results.failed.push(`${skill.name}: ${e.message}`);
    }
  }
  console.log(`Updated: ${results.ok.length}`);
  for (const r of results.ok) console.log(`  ${r}`);
  if (results.skipped.length) {
    console.log(`\nSkipped: ${results.skipped.length}`);
    for (const r of results.skipped) console.log(`  ${r}`);
  }
  if (results.failed.length) {
    console.log(`\nFailed: ${results.failed.length}`);
    for (const r of results.failed) console.log(`  ${r}`);
  }
})();
