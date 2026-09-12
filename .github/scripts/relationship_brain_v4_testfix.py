from pathlib import Path
p=Path('src/personal/radar/composerPlaybook.ts')
s=p.read_text()
old="Continue exatamente do ponto anterior, sem novo cumprimento de primeiro contato e sem repetir a pergunta já usada."
new="Continue do ponto anterior, sem novo cumprimento de primeiro contato e sem repetir a pergunta já usada."
if old not in s:
    raise SystemExit('continuity compatibility anchor missing')
p.write_text(s.replace(old,new,1))
