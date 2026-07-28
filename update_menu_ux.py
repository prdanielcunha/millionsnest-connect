import re

with open("src/i18n/menuUx.ts", "r") as f:
    content = f.read()

# Add fields to interface
interface_match = re.search(r'export interface MenuUxStrings \{.*?(?=^\})', content, re.MULTILINE | re.DOTALL)
if interface_match:
    interface_content = interface_match.group(0)
    new_fields = """  triggerExamples: readonly string[];
  organizationLabel: string;
  channelSelectorLabel: string;
  appLabel: string;
  toolLabel: string;
  technicalIdLabel: string;
  notApplicable: string;
  localPreviewHeader: string;
  contractMissingReason: string;
  actionNotExecuted: string;
  menuPreviewLabel: string;
"""
    content = content.replace(interface_content, interface_content + new_fields)

# Replace PT-BR block
pt_br_additions = """    triggerExamples: ['menu', 'ajuda', 'opções', 'começar', 'início', '0', '#'],
    organizationLabel: 'Organização',
    channelSelectorLabel: 'Seletor de Canal',
    appLabel: 'App',
    toolLabel: 'Ferramenta',
    technicalIdLabel: 'ID Técnico',
    notApplicable: 'N/A',
    localPreviewHeader: 'Prévia Local Simulada',
    contractMissingReason: 'Bloqueado: Contrato de opção protegida incompleto.',
    actionNotExecuted: 'Nenhuma ação executada',
    menuPreviewLabel: 'Prévia do Menu',
    scenarioLinked: 'Cenário de vínculo demonstrativo',
    scenarioLinkedDesc: 'Simula uma identidade relacionada a uma conta, sem autenticação ou autorização real.',
    authNotice: 'O vínculo apenas relaciona identidades. Esta projeção local considera membership, appAccess e permissions, mas a autorização final ocorre no backend.',
    subtitleLinked: 'Cenário vinculado demonstrativo. As opções abaixo dependem da projeção local do contexto.',"""
content = re.sub(r"'pt-BR':\s*\{", "'pt-BR': {\n" + pt_br_additions, content)
content = re.sub(r"scenarioLinked:\s*'Membro Vinculado',\s*scenarioLinkedDesc:\s*'Simula contato autenticado via MillionsNest.',\s*authNotice:\s*'O vínculo relaciona identidades, mas o acesso final depende das permissões na organização ativa.',\s*", "", content)
content = re.sub(r"subtitleLinked:\s*'Conta vinculada! Escolha uma das opções abaixo para prosseguir:',\s*", "", content)

# Replace EN-US block
en_us_additions = """    triggerExamples: ['menu', 'help', 'options', 'start', '0', '#'],
    organizationLabel: 'Organization',
    channelSelectorLabel: 'Channel Selector',
    appLabel: 'App',
    toolLabel: 'Tool',
    technicalIdLabel: 'Technical ID',
    notApplicable: 'N/A',
    localPreviewHeader: 'Simulated Local Preview',
    contractMissingReason: 'Blocked: Protected option contract incomplete.',
    actionNotExecuted: 'No action executed',
    menuPreviewLabel: 'Menu Preview',
    scenarioLinked: 'Demonstrative linked scenario',
    scenarioLinkedDesc: 'Simulates an identity related to an account, without real authentication or authorization.',
    authNotice: 'Linking only relates identities. This local projection considers membership, appAccess and permissions, but final authorization occurs in the backend.',
    subtitleLinked: 'Demonstrative linked scenario. The options below depend on local context projection.',"""
content = re.sub(r"'en-US':\s*\{", "'en-US': {\n" + en_us_additions, content)
content = re.sub(r"scenarioLinked:\s*'Linked Member',\s*scenarioLinkedDesc:\s*'Simulates contact authenticated via MillionsNest.',\s*authNotice:\s*'Linking relates identities, but final access depends on permissions in the active organization.',\s*", "", content)
content = re.sub(r"subtitleLinked:\s*'Account linked! Choose an option below to proceed:',\s*", "", content)

# Replace ES-ES block
es_es_additions = """    triggerExamples: ['menu', 'ayuda', 'opciones', 'comenzar', 'inicio', '0', '#'],
    organizationLabel: 'Organización',
    channelSelectorLabel: 'Selector de Canal',
    appLabel: 'Aplicación',
    toolLabel: 'Herramienta',
    technicalIdLabel: 'ID Técnico',
    notApplicable: 'N/A',
    localPreviewHeader: 'Vista Previa Local Simulada',
    contractMissingReason: 'Bloqueado: Contrato de opción protegida incompleto.',
    actionNotExecuted: 'Ninguna acción ejecutada',
    menuPreviewLabel: 'Vista Previa del Menú',
    scenarioLinked: 'Escenario de vínculo demostrativo',
    scenarioLinkedDesc: 'Simula una identidad relacionada a una cuenta, sin autenticación o autorización real.',
    authNotice: 'El vínculo solo relaciona identidades. Esta proyección local considera membresía, appAccess y permisos, pero la autorización final ocurre en el backend.',
    subtitleLinked: 'Escenario vinculado demostrativo. Las opciones abajo dependen de la proyección del contexto local.',"""
content = re.sub(r"'es-ES':\s*\{", "'es-ES': {\n" + es_es_additions, content)
content = re.sub(r"scenarioLinked:\s*'Miembro Vinculado',\s*scenarioLinkedDesc:\s*'Simula contacto autenticado vía MillionsNest.',\s*authNotice:\s*'El vínculo relaciona identidades, pero el acceso final depende de los permisos en la organización activa.',\s*", "", content)
content = re.sub(r"subtitleLinked:\s*'¡Cuenta vinculada! Elija una de las opciones a continuación para continuar:',\s*", "", content)

# Fix "Soporte de Louvor" in ES
content = content.replace("Soporte de Louvor", "Soporte Específico")

with open("src/i18n/menuUx.ts", "w") as f:
    f.write(content)

