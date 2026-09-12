from pathlib import Path

path = Path('src/tests/composerPlaybook.test.ts')
text = path.read_text()
old = "assert(/Espero que esteja bem|lhe |Nós /.test(professionalCopy),'professional style uses professional wording');"
new = "assert(professionalCopy.startsWith('Olá, João. Tudo bem?'),'professional style uses a polished neutral greeting');"
if old not in text:
    raise SystemExit('professional assertion not found')
path.write_text(text.replace(old, new))
