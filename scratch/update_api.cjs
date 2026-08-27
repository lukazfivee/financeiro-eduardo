const fs = require('fs');

// Update public/app.js
let appJs = fs.readFileSync('public/app.js', 'utf8');
appJs = appJs.replace(
  'const r=await fetch(path,{...opts,headers});',
  'const targetUrl = (location.protocol === "file:" || location.protocol === "app:") ? "https://financeiro-eduardo.construtec-reports.workers.dev" + path : path;\n  const r=await fetch(targetUrl,{...opts,headers});'
);
fs.writeFileSync('public/app.js', appJs);

// Update public/services.js
let servicesJs = fs.readFileSync('public/services.js', 'utf8');
servicesJs = servicesJs.replace(
  'const r=await fetch(path,{...opts,headers});',
  'const targetUrl = (location.protocol === "file:" || location.protocol === "app:") ? "https://financeiro-eduardo.construtec-reports.workers.dev" + path : path;\n  const r=await fetch(targetUrl,{...opts,headers});'
);
fs.writeFileSync('public/services.js', servicesJs);

console.log('API helpers updated for file:// support!');
