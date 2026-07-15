const { execSync } = require('child_process');
const fs = require('fs');

try {
  const output = execSync('git show HEAD:src/pages/Leaves.tsx').toString();
  fs.writeFileSync('src/pages/Leaves.tsx', output);
  console.log('Restored successfully');
} catch (e) {
  console.error(e.message);
}
