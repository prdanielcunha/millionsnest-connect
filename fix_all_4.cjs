const fs = require('fs');

fs.writeFileSync('index.html', `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MillionsNest Connect</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`);

const css = fs.readFileSync('src/index.css', 'utf-8');
const newCss = css + `
html,
body,
#root {
  width: 100%;
  min-width: 0;
  min-height: 100%;
  margin: 0;
}

body {
  overflow-x: hidden;
}
`;
fs.writeFileSync('src/index.css', newCss);

// Add test script to package.json
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
if (!pkg.scripts['test:mobile-layout']) {
  pkg.scripts['test:mobile-layout'] = 'tsx src/tests/mobileLayout.test.ts';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
}

