const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = 'C:\\Users\\carla\\Documents\\Cludo\\ai\\skills';

const SKILLS = [
  { file: 'frontend\\SKILL.md', name: 'Frontend overview', type: 'frontend' },
  { file: 'frontend\\404module.md', name: '404Module', type: '404module' },
  { file: 'frontend\\banners.md', name: 'Banners frontend', type: 'banners' },
  { file: 'frontend\\corejs.md', name: 'CoreJs', type: 'corejs' },
  { file: 'frontend\\customer-templates.md', name: 'Customer templates (frontend rulebook)', type: 'customer-templates' },
  { file: 'frontend\\customers.md', name: 'Customers (legacy CSS)', type: 'customers' },
  { file: 'frontend\\experience-builder\\SKILL.md', name: 'Experience builder', type: 'experience-builder' },
  { file: 'frontend\\experience-builder\\improvements.md', name: 'Experience builder: improvements', type: 'experience-builder' },
  { file: 'frontend\\experiences.md', name: 'Experiences (search assistant)', type: 'experiences' },
  { file: 'frontend\\good-practices-testing.md', name: 'Frontend good practices: testing', type: 'testing' },
  { file: 'frontend\\good-practices.md', name: 'Frontend good practices', type: 'good-practices' },
  { file: 'frontend\\mycludo.md', name: 'MyCludo', type: 'mycludo' },
  { file: 'frontend\\mycludo-add-beta-key.md', name: 'MyCludo: add beta key', type: 'mycludo' },
  { file: 'frontend\\mycludo-add-feature.md', name: 'MyCludo: add feature', type: 'mycludo' },
  { file: 'frontend\\mycludo-endpoints.md', name: 'MyCludo: endpoints', type: 'mycludo' },
  { file: 'frontend\\search-components.md', name: 'Search components (frontend rulebook)', type: 'search-components' },
  { file: 'cludo-search-components\\SKILL.md', name: 'Cludo search components', type: 'search-components' },
  { file: 'cludo-search-components\\exports.md', name: 'Cludo search components: exports', type: 'search-components' },
  { file: 'create-mfe\\SKILL.md', name: 'Create MFE', type: 'mfe' },
  { file: 'create-mfe\\mycludo-anchors.md', name: 'Create MFE: MyCludo anchors', type: 'mfe' },
  { file: 'customer-templates\\SKILL.md', name: 'Customer templates (SKILL)', type: 'customer-templates' },
  { file: 'customer-templates\\link-component-library.md', name: 'Customer templates: link component library', type: 'customer-templates' },
  { file: 'customer-template-new-project\\SKILL.md', name: 'Customer template: new project', type: 'customer-templates' },
  { file: 'mfe\\SKILL.md', name: 'MFE pattern', type: 'mfe' },
  { file: 'mfe\\readme-template.md', name: 'MFE readme template', type: 'mfe' },
  { file: 'static-files-404-reporting\\SKILL.md', name: 'Static files 404 reporting', type: '404module' },
];

function post(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 7777,
      path: '/skills',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(buf));
        else reject(new Error(`${res.statusCode}: ${buf}`));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  const results = { ok: [], failed: [] };
  for (const s of SKILLS) {
    const full = path.join(ROOT, s.file);
    let content;
    try {
      content = fs.readFileSync(full, 'utf8');
    } catch (e) {
      results.failed.push({ ...s, error: `read failed: ${e.message}` });
      continue;
    }
    try {
      const body = {
        name: s.name,
        type: s.type,
        content,
        project: ['general'],
        tags: ['frontend', s.type],
      };
      const created = await post(body);
      results.ok.push({ id: created.id, name: s.name, type: s.type, bytes: content.length });
    } catch (e) {
      results.failed.push({ ...s, error: e.message });
    }
  }
  console.log(`OK: ${results.ok.length} / ${SKILLS.length}`);
  for (const r of results.ok) console.log(`  ${r.type.padEnd(20)} ${r.name} (${r.bytes}b)`);
  if (results.failed.length) {
    console.log(`\nFAILED: ${results.failed.length}`);
    for (const r of results.failed) console.log(`  ${r.file}: ${r.error}`);
  }
})();
