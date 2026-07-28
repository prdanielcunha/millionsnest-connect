import re

with open("src/i18n/menuUx.ts", "r") as f:
    content = f.read()

content = re.sub(r"scenarioLinked:\s*'Membro Vinculado',\s*", "", content)
content = re.sub(r"scenarioLinkedDesc:\s*'Simula contato autenticado via MillionsNest\.',\s*", "", content)
content = re.sub(r"authNotice:\s*'O vínculo relaciona identidades, mas o acesso final depende das permissões do cargo na organização ativa\.',\s*", "", content)
content = re.sub(r"subtitleLinked:\s*'Conta vinculada! Escolha uma das opções abaixo para prosseguir:',\s*", "", content)
content = re.sub(r"subtitleLinked:\s*'Account linked! Choose an option below to proceed:',\s*", "", content)
content = re.sub(r"subtitleLinked:\s*'¡Cuenta vinculada! Elija una de las opciones a continuación para continuar:',\s*", "", content)

# I should also restore channel === in ConversationalMenuPage.tsx
with open("src/i18n/menuUx.ts", "w") as f:
    f.write(content)

with open("src/features/menu/ConversationalMenuPage.tsx", "r") as f:
    page = f.read()
page = page.replace("className={`px-4 py-2 rounded-lg font-bold transition min-h-[44px] ${ 'whatsapp' ? 'bg-[#00E676]/20 text-[#00E676] border-b-2 border-[#00E676]' : 'text-gray-400 hover:bg-[#1A2234]' }`}", 
"className={`px-4 py-2 rounded-lg font-bold transition min-h-[44px] ${ channel === 'whatsapp' ? 'bg-[#00E676]/20 text-[#00E676] border-b-2 border-[#00E676]' : 'text-gray-400 hover:bg-[#1A2234]' }`}")
page = page.replace("className={`px-4 py-2 rounded-lg font-bold transition min-h-[44px] ${ 'instagram' ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-pink-400 border-b-2 border-pink-500' : 'text-gray-400 hover:bg-[#1A2234]' }`}",
"className={`px-4 py-2 rounded-lg font-bold transition min-h-[44px] ${ channel === 'instagram' ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-pink-400 border-b-2 border-pink-500' : 'text-gray-400 hover:bg-[#1A2234]' }`}")
page = page.replace("className={`px-4 py-2 rounded-lg font-bold transition min-h-[44px] ${ 'inapp' ? 'bg-indigo-500/20 text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-400 hover:bg-[#1A2234]' }`}",
"className={`px-4 py-2 rounded-lg font-bold transition min-h-[44px] ${ channel === 'inapp' ? 'bg-indigo-500/20 text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-400 hover:bg-[#1A2234]' }`}")

with open("src/features/menu/ConversationalMenuPage.tsx", "w") as f:
    f.write(page)
