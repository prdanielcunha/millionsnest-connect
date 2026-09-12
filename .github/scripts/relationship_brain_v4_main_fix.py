from pathlib import Path
p=Path('src/features/radar/RadarPage.tsx')
s=p.read_text()
s=s.replace("import { openWhatsAppDraft } from '../../core/client/whatsappDelivery';", "import { normalizeWhatsAppPhone, openWhatsAppDraft } from '../../core/client/whatsappDelivery';", 1)
s=s.replace("!normalizePhoneForUse(phones[selected.person.id] || selected.person.phone)", "!normalizeWhatsAppPhone(phones[selected.person.id] || selected.person.phone)", 1)
p.write_text(s)
