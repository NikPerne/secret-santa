// Verifies that every translation file has exactly the same keys as en.json.
import { readFileSync, readdirSync } from 'node:fs';

const dir = 'public/i18n';
const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

const base = new Set(flatten(JSON.parse(readFileSync(`${dir}/en.json`, 'utf8'))));
let failed = false;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'en.json')) {
  const keys = new Set(flatten(JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'))));
  const missing = [...base].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !base.has(k));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`${file}: missing [${missing.join(', ')}] extra [${extra.join(', ')}]`);
  }
}
if (failed) process.exit(1);
console.log('i18n keys are in sync');
