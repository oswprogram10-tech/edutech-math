#!/usr/bin/env node
// 단원 명세(docs/04-units/*.md)와 data/units.json 의 일치를 검사한다. 외부 의존성 없음.
// 사용법:
//   node scripts/check-specs.mjs                 # 검사만 (오류 있으면 exit 1)
//   node scripts/check-specs.mjs --list-mc       # 오개념 코드 목록(마크다운 표) 출력
//   node scripts/check-specs.mjs --write-registry  # docs/05-learning-engine.md 의 레지스트리 갱신
//   node scripts/check-specs.mjs --concepts      # data/concepts.json 생성
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const unitsDoc = JSON.parse(fs.readFileSync(path.join(root, 'data/units.json'), 'utf8'));
const units = new Map(unitsDoc.units.map((u) => [u.id, u]));
const unitDir = path.join(root, 'docs/04-units');
const files = fs.readdirSync(unitDir).filter((f) => /^g\ds\d\.md$/.test(f)).sort();

const errors = [];
const warn = [];
const seen = new Map(); // unitId -> file
const concepts = new Map(); // id -> {unit,label,prereqRaw}
const mcUse = new Map(); // code -> Set(unit)
const mcMeaning = new Map(); // code -> meaning
const UNIT_RE = /g\ds\du\d+/g;
const ENGINE_RE = /\bE\d{2}\b/g;
const MC_RE = /MC-[A-Z0-9]+(?:-[A-Z0-9]+)*/g;

const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());

for (const file of files) {
  const text = fs.readFileSync(path.join(unitDir, file), 'utf8');
  const lines = text.split(/\r?\n/);
  let cur = null; // current unit id
  let section = '';
  for (const line of lines) {
    const h2 = line.match(/^## (g\ds\du\d+)\s+(.+?)\s*$/);
    if (h2) {
      cur = h2[1];
      section = '';
      const u = units.get(cur);
      if (!u) { errors.push(`${file}: units.json에 없는 단원 ${cur}`); continue; }
      if (seen.has(cur)) errors.push(`${file}: ${cur} 중복 (이미 ${seen.get(cur)})`);
      seen.set(cur, file);
      if (h2[2] !== u.title) errors.push(`${file}: ${cur} 제목 불일치 "${h2[2]}" ≠ "${u.title}"`);
      if (file !== `g${u.grade}s${u.semester}.md`) errors.push(`${file}: ${cur}는 g${u.grade}s${u.semester}.md에 있어야 함`);
      continue;
    }
    if (/^## /.test(line)) { cur = null; section = line; continue; }
    if (/^### /.test(line)) { section = line; }

    // 학기 끝 오개념 코드 표: | MC-... | 뜻 | 단원 |
    if (!cur || /이 학기의 오개념 코드/.test(section)) {
      if (/^\|\s*MC-/.test(line)) {
        const [code, meaning] = cells(line);
        if (code && meaning && !mcMeaning.has(code)) mcMeaning.set(code, meaning);
      }
      if (!cur) continue;
    }
    const u = units.get(cur);
    if (!u) continue;

    if (/^\|\s*엔진\s*\|/.test(line)) {
      const got = [...new Set(line.match(ENGINE_RE) || [])].sort();
      const want = [...u.engines].sort();
      if (got.join() !== want.join()) errors.push(`${cur}: 엔진 불일치 [${got}] ≠ units.json [${want}]`);
    }
    if (/^\|\s*선수 단원\s*\|/.test(line)) {
      const got = [...new Set(line.match(UNIT_RE) || [])].sort();
      const want = [...u.prerequisites].sort();
      if (got.join() !== want.join()) errors.push(`${cur}: 선수 단원 불일치 [${got}] ≠ units.json [${want}]`);
    }
    const act = line.match(/^#### (g\ds\du\d+)\.A(\d+)\b(.*)$/);
    if (act) {
      if (act[1] !== cur) errors.push(`${cur}: 활동 ID ${act[1]}.A${act[2]} 접두어 불일치`);
      for (const e of act[3].match(ENGINE_RE) || []) {
        if (!u.engines.includes(e)) errors.push(`${cur}.A${act[2]}: 단원 엔진 목록에 없는 ${e}`);
      }
    }
    if (/^### 개념 노드/.test(section) && /^\|\s*g\ds\du\d+\./.test(line)) {
      const [id, label, pre = ''] = cells(line);
      if (!id.startsWith(cur + '.')) errors.push(`${cur}: 개념 ID ${id} 접두어 불일치`);
      if (concepts.has(id)) errors.push(`${cur}: 개념 ID 중복 ${id}`);
      concepts.set(id, { unit: cur, label, pre });
    }
    if (/^### 오개념/.test(section)) {
      for (const code of line.match(MC_RE) || []) {
        if (!mcUse.has(code)) mcUse.set(code, new Set());
        mcUse.get(code).add(cur);
      }
    }
  }
}

for (const id of units.keys()) if (!seen.has(id)) errors.push(`명세 없음: ${id} ${units.get(id).title}`);

// 개념 선수 관계 확인 + 순환 검사
const conceptIdRe = /g\ds\du\d+(?:\.[a-z0-9-]+)?/g;
const graph = new Map();
for (const [id, c] of concepts) {
  const refs = [...new Set((c.pre.match(conceptIdRe) || []))];
  for (const r of refs) {
    if (!concepts.has(r) && !units.has(r)) errors.push(`${id}: 존재하지 않는 선수 ${r}`);
  }
  c.prerequisites = refs.filter((r) => r !== id);
  graph.set(id, c.prerequisites);
}
// 단원 ID 선수는 그 단원의 모든 개념으로 펼쳐서 순환 검사
const expand = (r) => (concepts.has(r) ? [r] : [...concepts.keys()].filter((k) => k.startsWith(r + '.')));
const state = new Map();
const visit = (n, stack) => {
  if (state.get(n) === 2) return;
  if (state.get(n) === 1) { errors.push(`개념 순환: ${[...stack, n].join(' → ')}`); return; }
  state.set(n, 1);
  for (const r of graph.get(n) || []) for (const m of expand(r)) visit(m, [...stack, n]);
  state.set(n, 2);
};
for (const n of graph.keys()) visit(n, []);
for (const u of units.keys()) if (seen.has(u) && ![...concepts.keys()].some((k) => k.startsWith(u + '.'))) warn.push(`${u}: 개념 노드 없음`);
for (const code of mcUse.keys()) if (!mcMeaning.has(code)) warn.push(`${code}: 학기 오개념 표에 뜻이 없음`);

const registry = () => {
  const rows = [...mcUse.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([code, us]) => `| \`${code}\` | ${mcMeaning.get(code) ?? '(뜻 미기재)'} | ${[...us].sort().join(', ')} |`);
  return ['| 코드 | 뜻 | 단원 |', '| --- | --- | --- |', ...rows].join('\n');
};

if (args.has('--list-mc')) console.log(registry());
if (args.has('--write-registry')) {
  const p = path.join(root, 'docs/05-learning-engine.md');
  const doc = fs.readFileSync(p, 'utf8');
  const out = doc.replace(/<!-- MC-REGISTRY:START -->[\s\S]*<!-- MC-REGISTRY:END -->/,
    `<!-- MC-REGISTRY:START -->\n${registry()}\n<!-- MC-REGISTRY:END -->`);
  fs.writeFileSync(p, out);
  console.log(`오개념 레지스트리 갱신: ${mcUse.size}개 코드`);
}
if (args.has('--concepts')) {
  const out = { $comment: 'scripts/check-specs.mjs --concepts 로 생성. 직접 고치지 말고 docs/04-units 를 고친다.',
    concepts: [...concepts.entries()].map(([id, c]) => ({ id, unit: c.unit, label: c.label, prerequisites: c.prerequisites })) };
  fs.writeFileSync(path.join(root, 'data/concepts.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`data/concepts.json 생성: ${concepts.size}개 개념`);
}

console.log(`단원 ${seen.size}/${units.size}, 개념 ${concepts.size}, 오개념 코드 ${mcUse.size}`);
for (const w of warn) console.log('경고: ' + w);
for (const e of errors) console.error('오류: ' + e);
process.exit(errors.length ? 1 : 0);
