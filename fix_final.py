with open("src/features/menu/ConversationalMenuPage.tsx", "r") as f:
    page = f.read()

page = page.replace("'instagram' ? 'bg-[#D10E65] text-white'", "channel === 'instagram' ? 'bg-[#D10E65] text-white'")
page = page.replace("'inapp' ? 'bg-[#5145CD] text-white'", "channel === 'inapp' ? 'bg-[#5145CD] text-white'")

with open("src/features/menu/ConversationalMenuPage.tsx", "w") as f:
    f.write(page)

with open("src/tests/menuMobile.test.ts", "r") as f:
    test_content = f.read()

test_content = test_content.replace("matchMenuTrigger('!menu?')", "matchMenuTrigger('!menu?', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('submenu')", "matchMenuTrigger('submenu', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('5511999990000')", "matchMenuTrigger('5511999990000', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('   ')", "matchMenuTrigger('   ', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('')", "matchMenuTrigger('', 'pt-BR')")

# Fix all possible matchMenuTrigger remaining issues just in case
import re
test_content = re.sub(r"matchMenuTrigger\('([^']*)'\)", r"matchMenuTrigger('\1', 'pt-BR')", test_content)

with open("src/tests/menuMobile.test.ts", "w") as f:
    f.write(test_content)
