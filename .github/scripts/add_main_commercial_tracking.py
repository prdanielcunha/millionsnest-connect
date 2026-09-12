from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing anchor {label} in {path}")
    p.write_text(text.replace(old, new, 1))

client = "src/core/client/personalRadarClient.ts"
service = "src/personal/radar/personalRadarService.ts"

replace_once(client,
"  identityAliases?: string[];\n  signals: Array<{",
"  identityAliases?: string[];\n  lastCommercialAction?: 'whatsapp_opened' | 'sent_manual' | 'copied' | null;\n  lastCommercialAt?: string | null;\n  signals: Array<{",
"client person commercial fields")

replace_once(client,
"      manualPotential?: RadarPotentialLevel | null;\n      notRelevant?: boolean;\n    },",
"      manualPotential?: RadarPotentialLevel | null;\n      notRelevant?: boolean;\n      commercialAction?: 'whatsapp_opened' | 'sent_manual' | 'copied';\n    },",
"client update commercial action")

replace_once(service,
"const DAY_MS = 86_400_000;",
"const DAY_MS = 86_400_000;\nconst COMMERCIAL_ACTIONS = new Set(['whatsapp_opened', 'sent_manual', 'copied']);",
"commercial actions constant")

replace_once(service,
"      manualPotential?: PotentialLevel | null;\n      notRelevant?: boolean;\n    },",
"      manualPotential?: PotentialLevel | null;\n      notRelevant?: boolean;\n      commercialAction?: 'whatsapp_opened' | 'sent_manual' | 'copied';\n    },",
"service update commercial action")

replace_once(service,
"    const radarState = input.radarState && ['active', 'ignored', 'snoozed'].includes(input.radarState)\n      ? input.radarState\n      : String(person.radarState || 'active');\n\n    let snoozedUntil",
"    const radarState = input.radarState && ['active', 'ignored', 'snoozed'].includes(input.radarState)\n      ? input.radarState\n      : String(person.radarState || 'active');\n    if (input.commercialAction !== undefined && !COMMERCIAL_ACTIONS.has(input.commercialAction)) {\n      throw new Error('COMMERCIAL_ACTION_INVALID');\n    }\n    const commercialAt = input.commercialAction ? isoNow(this.now) : (person.lastCommercialAt || null);\n\n    let snoozedUntil",
"service commercial validation")

replace_once(service,
"      notRelevant: input.notRelevant === undefined ? Boolean(person.notRelevant) : input.notRelevant,\n      updatedAt: isoNow(this.now),",
"      notRelevant: input.notRelevant === undefined ? Boolean(person.notRelevant) : input.notRelevant,\n      lastCommercialAction: input.commercialAction === undefined ? person.lastCommercialAction || null : input.commercialAction,\n      lastCommercialAt: commercialAt,\n      updatedAt: isoNow(this.now),",
"service persist commercial action")
