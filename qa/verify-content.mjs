import fs from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import cp from "node:child_process";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const requireDependency = createRequire(import.meta.url);
async function run() {
const icons = await import('@phosphor-icons/react');
const root = process.cwd();
const baselineRef = 'cf0c1bb894a7b1cf97f9d54a6995faf6bfbe979a';
const cache = new Map();
function loadTs(file, explicitSource) {
  const filename = path.resolve(root, file);
  if (!explicitSource && cache.has(filename)) return cache.get(filename).exports;
  const source = explicitSource || fs.readFileSync(filename, "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const m = new Module(filename);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(root);
  m.require = (name) => name === '@phosphor-icons/react' ? icons : name.startsWith("@/") ? loadTs(name.slice(2) + ".ts") : name.startsWith("./") ? loadTs(path.relative(root, path.resolve(path.dirname(filename), name + ".ts"))) : requireDependency(name);
  if (!explicitSource) cache.set(filename, m);
  m._compile(js, filename);
  return m.exports;
}
const baselineSource = cp.execFileSync("git", ["show", baselineRef + ":components/chain/Dashboard.tsx"], {encoding:"utf8"});
const original = loadTs("components/chain/Dashboard.baseline.tsx", baselineSource).Dashboard;
const updated = loadTs("components/chain/Dashboard.tsx").Dashboard;
const { reviewProps } = loadTs("qa/review-fixture.ts");
function visibleText(markup, hasResults) {
  // Unit styling splits text nodes without changing the rendered text.
  markup = markup.replace(/(<div class="(?:baseline-value|recent-value)">[^<]*)<span>([^<]*)<\/span>/g, '$1$2');
  if (!hasResults) markup = markup.replace(/<aside[\s\S]*?<\/aside>/g, "");
  markup = markup.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
  const strings = [...markup.matchAll(/>([^<>]+)</g)].map(m=>m[1].replace(/&#x27;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim()).filter(s=>s && !["↑","↓","→","▼","✓","!"].includes(s));
  return strings.sort();
}
const results = [];
for (const language of ["zh", "en"]) {
  for (const tab of ["overview", "trace", "report", "evidence"]) {
    const base = reviewProps(language, tab);
    const variants = [
      ["populated", base],
      ["empty", {...base, transactions:[], tokenTransfers:[], internalTransactions:[], counterparties:[], anomalies:[], flaggedHashes:new Set(), totalEvents:0, riskScore:0, changeAnalysis:null, secondHop:null, aiReport:""}],
      ["loading", {...base, loading:true, aiLoading:true}],
      ["initial", {...base, hasResults:false, riskScore:null, status:base.t.initialStatus, address:""}],
    ];
    for (const [state, props] of variants) {
      const a=visibleText(renderToStaticMarkup(React.createElement(original,props)),props.hasResults);
      const b=visibleText(renderToStaticMarkup(React.createElement(updated,props)),props.hasResults);
      if(JSON.stringify(a)!==JSON.stringify(b)) {
        const missing=a.filter(x=>!b.includes(x)), added=b.filter(x=>!a.includes(x));
        console.error({language,tab,state,missing,added});
        process.exitCode=1;
      } else results.push({language,tab,state,passed:true});
    }
  }
}
// Exercise all optional verification presentation states in both languages.
for (const language of ["zh", "en"]) {
  for (const status of ["SUPPORTED", "PARTIAL", "UNRESOLVED"]) {
    const base = reviewProps(language, "overview");
    if (!base.changeAnalysis?.causes.length) throw new Error("Verification fixture needs a cause");
    const props = {...base, changeAnalysis: {...base.changeAnalysis, causes: [
      {...base.changeAnalysis.causes[0], verification: {
        status, evidenceZh: ["界面状态回归测试证据"], evidenceEn: ["UI state regression evidence"],
      }},
    ]}};
    const a = visibleText(renderToStaticMarkup(React.createElement(original, props)), true);
    const b = visibleText(renderToStaticMarkup(React.createElement(updated, props)), true);
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error("Verification content mismatch: " + language + "/" + status);
    results.push({language, tab:"overview", state:"verification-" + status.toLowerCase(), passed:true});
  }
}
const changed = cp.execFileSync("git", ["diff",baselineRef,"--name-only"],{encoding:"utf8"}).trim().split(/\r?\n/);
const forbidden = changed.filter(x=>x.startsWith("lib/") || x.startsWith("app/api/") || x==="app/page.tsx");
if(forbidden.length) throw new Error("Non-visual production changes: "+forbidden.join(", "));
const report = { baseline: baselineRef, passed: !process.exitCode, cases:results.length, results, logicAndCopyUnchanged:forbidden.length===0 };
fs.writeFileSync("qa/content-verification.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({passed:report.passed,cases:report.cases,logicAndCopyUnchanged:report.logicAndCopyUnchanged}));
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
