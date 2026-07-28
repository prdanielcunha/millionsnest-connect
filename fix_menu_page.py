import re

with open("src/features/menu/ConversationalMenuPage.tsx", "r") as f:
    page = f.read()

# Fix const declaration
page = page.replace("const [  setChannel]", "const [channel, setChannel]")

# Fix truthiness
page = re.sub(r"className=\{`px-4 py-2 rounded-lg font-bold transition min-h-\[44px\] \$\{\s*'whatsapp' \? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'\s*\}`\}",
              "className={`px-4 py-2 rounded-lg font-bold transition min-h-[44px] ${ channel === 'whatsapp' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white' }`}", page)

page = re.sub(r"className=\{`px-4 py-2 rounded-lg font-bold transition min-h-\[44px\] \$\{\s*'instagram' \? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'\s*\}`\}",
              "className={`px-4 py-2 rounded-lg font-bold transition min-h-[44px] ${ channel === 'instagram' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white' }`}", page)

page = re.sub(r"className=\{`px-4 py-2 rounded-lg font-bold transition min-h-\[44px\] \$\{\s*'inapp' \? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'\s*\}`\}",
              "className={`px-4 py-2 rounded-lg font-bold transition min-h-[44px] ${ channel === 'inapp' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white' }`}", page)

with open("src/features/menu/ConversationalMenuPage.tsx", "w") as f:
    f.write(page)

# Now fix menuMobile.test.ts locale param
with open("src/tests/menuMobile.test.ts", "r") as f:
    test_content = f.read()

test_content = test_content.replace("matchMenuTrigger('menu')", "matchMenuTrigger('menu', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('ajuda')", "matchMenuTrigger('ajuda', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('opções')", "matchMenuTrigger('opções', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('opcoes')", "matchMenuTrigger('opcoes', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('começar')", "matchMenuTrigger('começar', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('comecar')", "matchMenuTrigger('comecar', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('início')", "matchMenuTrigger('início', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('inicio')", "matchMenuTrigger('inicio', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('help')", "matchMenuTrigger('help', 'en-US')")
test_content = test_content.replace("matchMenuTrigger('options')", "matchMenuTrigger('options', 'en-US')")
test_content = test_content.replace("matchMenuTrigger('start')", "matchMenuTrigger('start', 'en-US')")
test_content = test_content.replace("matchMenuTrigger('ayuda')", "matchMenuTrigger('ayuda', 'es-ES')")
test_content = test_content.replace("matchMenuTrigger('opciones')", "matchMenuTrigger('opciones', 'es-ES')")
test_content = test_content.replace("matchMenuTrigger('comenzar')", "matchMenuTrigger('comenzar', 'es-ES')")
test_content = test_content.replace("matchMenuTrigger('0')", "matchMenuTrigger('0', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('#')", "matchMenuTrigger('#', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('MENU')", "matchMenuTrigger('MENU', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('  menu  ')", "matchMenuTrigger('  menu  ', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('opçôès')", "matchMenuTrigger('opçôès', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('!menu?')", "matchMenuTrigger('!menu?', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('submenu')", "matchMenuTrigger('submenu', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('helpful')", "matchMenuTrigger('helpful', 'en-US')")
test_content = test_content.replace("matchMenuTrigger('opcional')", "matchMenuTrigger('opcional', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('opções extras')", "matchMenuTrigger('opções extras', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('começar agora')", "matchMenuTrigger('começar agora', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('menu123')", "matchMenuTrigger('menu123', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('10')", "matchMenuTrigger('10', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('5511999990000')", "matchMenuTrigger('5511999990000', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('')", "matchMenuTrigger('', 'pt-BR')")
test_content = test_content.replace("matchMenuTrigger('   ')", "matchMenuTrigger('   ', 'pt-BR')")

with open("src/tests/menuMobile.test.ts", "w") as f:
    f.write(test_content)
