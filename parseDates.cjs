const fs = require('fs');
const content = fs.readFileSync('C:/Users/USER/.gemini/antigravity/brain/f8c85d79-97ef-4175-aa76-1f8a75ce7683/.system_generated/steps/172/output.txt', 'utf8');
const dates = content.match(/"date":"(\d{4}-\d{2})/g);
if (dates) {
    const byMonth = {};
    dates.forEach(d => {
        const month = d.replace('"date":"', '');
        byMonth[month] = (byMonth[month] || 0) + 1;
    });
    console.log(byMonth);
}
