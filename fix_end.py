import re
with open("src/tests/menuMobile.test.ts", "r") as f:
    content = f.read()

# I will find the start of test 86 and just truncate and append
start_idx = content.find("runTest('86.")
if start_idx != -1:
    content = content[:start_idx]
    
    end_part = """runTest('86. No extra npm dependencies have been added to package.json', () => {
  const pkg = JSON.parse(packageJson);
  const depKeys = Object.keys(pkg.dependencies || {});
  const expectedDeps = ['@google/genai', '@tailwindcss/vite', '@vitejs/plugin-react', 'lucide-react', 'react', 'react-dom', 'vite', 'express', 'dotenv', 'motion'];
  checkEqual(depKeys.length, expectedDeps.length);
  for (const d of expectedDeps) {
    checkOk(depKeys.includes(d));
  }
});

console.log(`\\nTests completed: ${passedTests} passed, ${failedTests} failed, ${skippedTests} skipped. Total tests: ${totalTests}. Total assertions: ${totalAssertions}`);

if (failedTests > 0 || totalAssertions === 0) {
  process.exit(1);
} else {
  process.exit(0);
}
"""
    content += end_part

with open("src/tests/menuMobile.test.ts", "w") as f:
    f.write(content)
