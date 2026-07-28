import re

with open("src/tests/menuMobile.test.ts", "r") as f:
    content = f.read()

# Fix currentAssertions and totalAssertions
content = content.replace("let totalPassedAssertions = 0;", "let currentAssertions = 0;")
content = content.replace("totalPassedAssertions++;", "totalAssertions++;\n  currentAssertions++;")

# Replace runTest to check currentAssertions
run_test_old = """function runTest(name: string, testFn: () => void) {
  totalTests++;
  try {
    testFn();
    console.log(`✅ Test passed: ${name}`);
    passedTests++;
  } catch (error: any) {
    console.error(`❌ Test failed: ${name}`);
    console.error(error);
    failedTests++;
  }
}"""
run_test_new = """function runTest(name: string, testFn: () => void) {
  totalTests++;
  currentAssertions = 0;
  try {
    testFn();
    if (currentAssertions === 0) {
      throw new Error('Test executed 0 assertions.');
    }
    console.log(`✅ Test passed: ${name}`);
    passedTests++;
  } catch (error: unknown) {
    console.error(`❌ Test failed: ${name}`);
    console.error(error);
    failedTests++;
    process.exit(1);
  }
}"""
content = content.replace(run_test_old, run_test_new)

# Fix testTools
test_tools_old = """const testTools: ToolDefinition[] = [
  {
    name: 'viewSchedules',
    appId: 'musicscale',
    description: 'test',
    requiredPermissions: ['schedule.view'],
    organizationScoped: true,
    riskLevel: 'R1_SAFE',
    confirmationPolicy: 'auto_execute'
  }
];"""
test_tools_new = """const testTools: ToolDefinition[] = [
  {
    name: 'viewSchedules',
    appId: 'musicscale',
    description: 'test',
    requiredPermissions: ['schedule.view'],
    organizationScoped: true,
    riskLevel: 'R1_SAFE',
    confirmationPolicy: 'auto_execute'
  },
  {
    name: 'addSongToLivingLibrary',
    appId: 'musicscale',
    description: 'test',
    requiredPermissions: ['livingLibrary.manage'],
    organizationScoped: false,
    riskLevel: 'R3_PRIVILEGED',
    confirmationPolicy: 'human_approval'
  }
];"""
content = content.replace(test_tools_old, test_tools_new)

# Fix test 56 (livingLibrary.manage)
test56_old = """runTest('56. livingLibrary.manage is never granted by bypass', () => {
  // Check if option opt_ms_7 or a hypothetical living library write option gets blocked if livingLibrary.manage is not in context
  const results = resolveDemoMenuProjection(
    testBaseContext,
    'linked_demo',
    staticOptionDefinitions,
    testTools
  );
  // our base permissions don't have 'livingLibrary.manage', let's check opt_ms_7 if it requires listSchedules/searchLivingLibrary
  const opt7 = staticOptionDefinitions.find((o) => o.id === 'opt_ms_7');
  checkOk(opt7 !== undefined);
});"""
test56_new = """runTest('56. livingLibrary.manage is never granted by bypass', () => {
  const customOption = {
    id: 'opt_ms_test_living',
    numberKey: '9',
    category: 'protected' as const,
    requiresActiveMembership: true,
    appId: 'musicscale',
    toolName: 'addSongToLivingLibrary',
    actionPayload: 'ACTION_TEST_LIVING'
  };
  
  // No capability
  let results = resolveDemoMenuProjection(
    testBaseContext,
    'linked_demo',
    [customOption],
    testTools
  );
  checkEqual(results['opt_ms_test_living'].allowed, false);

  // Owner bypass attempt
  const ownerContext = {
    ...testBaseContext,
    memberships: [{
      ...testBaseContext.memberships[0],
      organizationRole: 'owner' as const,
      permissions: []
    }]
  };
  results = resolveDemoMenuProjection(ownerContext, 'linked_demo', [customOption], testTools);
  checkEqual(results['opt_ms_test_living'].allowed, false);
  
  // Explicit capability test
  const explicitContext = {
    ...testBaseContext,
    memberships: [{
      ...testBaseContext.memberships[0],
      permissions: ['livingLibrary.manage']
    }]
  };
  results = resolveDemoMenuProjection(explicitContext, 'linked_demo', [customOption], testTools);
  checkEqual(results['opt_ms_test_living'].allowed, true);
});"""
content = content.replace(test56_old, test56_new)

# Fix test 59, 60, 61 Mobile state
content = re.sub(r"\{ activeView: 'preview', selectedOptionId: 'opt_1' \}", "{ activeView: 'preview' }", content)
content = re.sub(r"\{ activeView: 'preview', selectedOptionId: 'opt_2' \}", "{ activeView: 'preview' }", content)
content = re.sub(r"checkEqual\(state\.selectedOptionId, null\);\n", "", content)

# Fix test 73
content = content.replace("pageTsx.includes('min-h-[44px]') || pageTsx.includes('min-h-[38px]')", "pageTsx.includes('min-h-[44px]') && !pageTsx.includes('min-h-[38px]')")

# Fix test 86
test86_old = """runTest('86. No extra npm dependencies have been added to package.json', () => {
  const pkg = JSON.parse(packageJson);
  const depKeys = Object.keys(pkg.dependencies || {});
  const expectedDeps = ['lucide-react', 'motion', 'react', 'react-dom'];
  for (const d of expectedDeps) {
    if (depKeys.includes(d)) {
      checkOk(true);
    }
  }
});"""
test86_new = """runTest('86. No extra npm dependencies have been added to package.json', () => {
  const pkg = JSON.parse(packageJson);
  const depKeys = Object.keys(pkg.dependencies || {});
  const expectedDeps = ['lucide-react', 'motion', 'react', 'react-dom'];
  checkEqual(depKeys.length, expectedDeps.length);
  for (const d of expectedDeps) {
    checkOk(depKeys.includes(d));
  }
});"""
content = content.replace(test86_old, test86_new)

# Fix footer logging
content = content.replace("(passed: ${totalPassedAssertions})", "")

# Remove test 35 because action payloads might change if translated, wait no they shouldn't.
# Wait, matchMenuTrigger in menuDomain.ts was modified, I should make sure its tests pass.

with open("src/tests/menuMobile.test.ts", "w") as f:
    f.write(content)
