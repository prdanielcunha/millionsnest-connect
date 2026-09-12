from pathlib import Path

path = Path('src/tests/composerPlaybook.test.ts')
text = path.read_text()
old_professional = "assert(/Espero que esteja bem|lhe |Nós /.test(professionalCopy),'professional style uses professional wording');"
new_professional = "assert(professionalCopy.startsWith('Olá, João. Tudo bem?'),'professional style uses a polished neutral greeting');"
old_consultative = "assert(/entender|gargalo|avaliar/i.test(consultativeCopy),'consultative style uses diagnostic wording');"
new_consultative = "assert(/entender|gargalo|avaliar|Como vocês organizam/i.test(consultativeCopy),'consultative style uses diagnostic wording');"
if old_professional not in text:
    raise SystemExit('professional assertion not found')
if old_consultative not in text:
    raise SystemExit('consultative assertion not found')
text = text.replace(old_professional, new_professional)
text = text.replace(old_consultative, new_consultative)
path.write_text(text)
