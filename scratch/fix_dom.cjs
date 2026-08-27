const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// 1. Add the budget section before the categories section if it's not already there
if (!code.includes('id="setBudgetBtn"')) {
  code = code.replace(
    '<article class="panel" id="categoriesSection">',
    '<article class="panel"><div class="panel-head"><h2>Metas e Orçamento</h2><button class="btn secondary" id="setBudgetBtn">+ Definir</button></div>${budgetHtml()}</article>\n        <article class="panel" id="categoriesSection">'
  );
}

// 2. Remove the hardcoded navServices if it exists, since services.js adds it dynamically
code = code.replace(/<button class="nav-item" id="navServices">.*?<\/button>\s*/, '');

fs.writeFileSync('public/app.js', code);
console.log('Fixed app.js DOM');
