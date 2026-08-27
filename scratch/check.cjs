const code = require('fs').readFileSync('public/app.js', 'utf8');
console.log('Has config:', code.includes('Configurações'));
console.log('Has navSettings id:', code.includes('id="navSettings"'));
console.log('Has budget:', code.includes('setBudgetBtn'));
