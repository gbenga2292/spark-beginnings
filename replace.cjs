const fs = require('fs');

const files = [
  'src/pages/Payroll.tsx',
  'src/pages/Billing.tsx',
  'src/pages/Payments.tsx',
  'src/pages/VatPayments.tsx',
  'src/pages/SalaryLoans.tsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');

  // Replace raw .toLocaleString() usages inside JSX brackets
  // e.g. {totals.gross.toLocaleString()} -> {priv?.canViewAmounts === false ? '***' : totals.gross.toLocaleString()}
  code = code.replace(/\{([^{}]+?)\.toLocaleString\((.*?)\)\}/g, (match, expression, args) => {
    return `{priv?.canViewAmounts === false ? '***' : ${expression}.toLocaleString(${args})}`;
  });

  fs.writeFileSync(file, code);
  console.log('Replaced in', file);
});
