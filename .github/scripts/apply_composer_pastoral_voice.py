from pathlib import Path

playbook = Path('src/personal/radar/composerPlaybook.ts')
text = playbook.read_text()
start = text.index('function greeting(name: string, style: ComposerStyle): string {')
end = text.index('\nfunction openingVariants', start)
replacement = r'''function greeting(name: string, style: ComposerStyle): string {
  if (style === 'amigavel') return name ? `E aí, ${name}! Tudo bem?` : 'E aí! Tudo bem?';
  if (style === 'profissional') return name ? `Olá, ${name}. Tudo bem?` : 'Olá. Tudo bem?';
  if (style === 'descontraido') return name ? `Fala, ${name}! Beleza?` : 'Fala! Beleza?';
  if (style === 'objetivo') return name ? `${name},` : 'Direto ao ponto:';
  if (style === 'proximo') return name ? `Oi, ${name}! Tudo bem por aí?` : 'Oi! Tudo bem por aí?';
  if (style === 'pastoral') return name ? `Paz, ${name}! Tudo bem?` : 'Paz! Tudo bem?';
  if (style === 'consultivo') return name ? `${name}, tudo bem?` : 'Tudo bem?';
  return name ? `Oi, ${name}! Tudo bem?` : 'Oi! Tudo bem?';
}

function styleGuidance(style: ComposerStyle): string {
  if (style === 'amigavel') return 'Soa leve, acolhedor e natural, como uma conversa de WhatsApp sem pressão.';
  if (style === 'profissional') return 'Mantém clareza e cuidado, sem ficar frio, burocrático ou formal demais.';
  if (style === 'descontraido') return 'Usa linguagem casual e espontânea, sem exagerar em gírias.';
  if (style === 'objetivo') return 'Vai direto ao ponto, corta introduções e mantém uma única ação clara.';
  if (style === 'proximo') return 'Parte do relacionamento existente e soa pessoal, sem parecer mensagem pronta.';
  if (style === 'pastoral') return 'Fala como pastor com respeito e proximidade, usando “Paz” sem espiritualizar a venda.';
  return 'Faz diagnóstico antes de apresentar solução: pergunta, escuta e só então conecta o MusicScale à dor real.';
}

function soften(style: ComposerStyle, text: string): string {
  let result = text;

  if (style === 'amigavel') {
    return result
      .replace(/Posso te fazer uma pergunta rápida\?/g, 'Me conta uma coisa?')
      .replace(/Posso te fazer uma pergunta rapidinha\?/g, 'Me conta uma coisa?')
      .replace(/acho que faz sentido/g, 'acho que pode ajudar vocês')
      .replace(/O que mais dá trabalho/g, 'O que mais pesa na rotina')
      .replace(/Depois me diz/g, 'Depois me conta')
      .replace(/Quero entender antes de te mostrar qualquer outra coisa\./g, 'Quero te ouvir primeiro antes de mostrar qualquer outra coisa.');
  }

  if (style === 'profissional') {
    return result
      .replace(/\bA gente\b/g, 'Nós')
      .replace(/\ba gente\b/g, 'nós')
      .replace(/acho que faz sentido/g, 'acredito que vale a pena')
      .replace(/Posso te mandar/g, 'Posso enviar para você')
      .replace(/posso te mandar/g, 'posso enviar para você')
      .replace(/te mostrar/g, 'mostrar para você')
      .replace(/te explico/g, 'explico para você')
      .replace(/rapidinho/g, 'brevemente')
      .replace(/curtinho/g, 'breve')
      .replace(/vídeo bem rápido/g, 'vídeo breve')
      .replace(/equipe daí/g, 'equipe da sua igreja')
      .replace(/Depois me diz/g, 'Depois me diga');
  }

  if (style === 'descontraido') {
    return result
      .replace(/Posso te fazer uma pergunta rápida\?/g, 'Me diz uma coisa:')
      .replace(/Posso te fazer uma pergunta rapidinha\?/g, 'Me diz uma coisa:')
      .replace(/Em vez de te explicar tudo por texto/g, 'Pra não virar textão')
      .replace(/Se você quiser/g, 'Se quiser')
      .replace(/Você conseguiu ver com calma\?/g, 'Deu pra dar uma olhada?')
      .replace(/vou te mandar/g, 'te mando')
      .replace(/Depois me diz/g, 'Depois me fala');
  }

  if (style === 'objetivo') {
    return result
      .replace(/Espero que esteja bem\.\s*/g, '')
      .replace(/Tudo bem\?\s*/g, '')
      .replace(/Tudo certo\?\s*/g, '')
      .replace(/Tudo certo por aí\?\s*/g, '')
      .replace(/Queria te fazer uma pergunta rapidinha:/g, 'Pergunta direta:')
      .replace(/Posso te fazer uma pergunta rápida\?/g, 'Pergunta direta:')
      .replace(/Pelo que você comentou sobre/g, 'Sobre')
      .replace(/Pensando no que você falou sobre/g, 'Sobre')
      .replace(/acho que faz sentido te mostrar uma coisa\./g, 'vale te mostrar isso.')
      .replace(/Em vez de te explicar tudo por texto,/g, '')
      .replace(/Como combinamos, vou te mandar um vídeo bem curto mostrando justamente a parte de/g, 'Segue um vídeo curto sobre')
      .replace(/Separei um vídeo rápido do MusicScale focado em/g, 'Vídeo rápido do MusicScale sobre')
      .replace(/Passando só para retomar/g, 'Retomando')
      .replace(/Depois me diz/g, 'Me diga')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  if (style === 'proximo') {
    return result
      .replace(/Pelo que você comentou sobre/g, 'Lembrei do que você comentou sobre')
      .replace(/Pensando no que você falou sobre/g, 'Lembrei do que você falou sobre')
      .replace(/Passando só para retomar/g, 'Lembrei de você e quis retomar')
      .replace(/Se fizer sentido/g, 'Se isso fizer sentido pra você')
      .replace(/Quer que eu te mostre/g, 'Quer que eu te mostre do jeito mais simples')
      .replace(/Depois me diz/g, 'Depois me conta')
      .replace(/quero saber/g, 'quero te ouvir sobre');
  }

  if (style === 'pastoral') {
    return result
      .replace(/A gente viveu algo bem parecido por aqui/g, 'Nós também vivemos algo parecido no ministério por aqui')
      .replace(/acho que faz sentido/g, 'pode fazer sentido por aí')
      .replace(/Pensando na rotina de vocês/g, 'Pensando com cuidado na rotina da igreja de vocês')
      .replace(/Se você pudesse resolver só uma parte/g, 'Pensando na realidade da igreja, se vocês pudessem resolver uma parte')
      .replace(/Quer que eu te mostre/g, 'Se fizer sentido por aí, posso te mostrar')
      .replace(/O teste ajudou de verdade/g, 'O teste ajudou a rotina da equipe de vocês')
      .replace(/Depois me diz/g, 'Depois me conta como isso conversa com a realidade de vocês');
  }

  if (style === 'consultivo') {
    return result
      .replace(/Vi o que você comentou sobre ([^.]+)\. Hoje vocês ainda organizam isso mais pelo WhatsApp ou já usam alguma ferramenta\?/g, 'Você comentou sobre $1. Como vocês organizam isso hoje?')
      .replace(/Lembrei do que você falou sobre/g, 'Sobre o que você comentou de')
      .replace(/Posso te fazer uma pergunta rápida\?/g, 'Para eu entender melhor:')
      .replace(/Posso te fazer uma pergunta rapidinha\?/g, 'Para eu entender melhor:')
      .replace(/O que mais dá trabalho/g, 'Qual é hoje o principal gargalo')
      .replace(/Se você pudesse resolver só uma parte/g, 'Se tivesse que priorizar um único ponto')
      .replace(/acho que faz sentido te mostrar uma coisa\./g, 'pelo cenário que você trouxe, vale avaliar uma alternativa.')
      .replace(/Quer que eu te mostre especificamente essa parte\?/g, 'Faz sentido eu te mostrar somente essa parte para avaliarmos se resolve o problema?')
      .replace(/Ficou alguma dúvida ou alguma parte que você queria ver melhor\?/g, 'Qual ponto ainda precisa ficar mais claro para você avaliar se isso resolve a necessidade?')
      .replace(/Depois me diz se isso faria diferença aí para vocês\./g, 'Depois me diga se isso ataca o problema que você comentou.')
      .replace(/o que mais te chamou atenção no vídeo\?/g, 'qual ponto do vídeo teria maior impacto na rotina de vocês?');
  }

  return result;
}
'''
text = text[:start] + replacement + text[end:]
old_tip = """  const tip = effectiveChannel === 'audio'\n    ? 'Fale como conversa, com frases curtas e pausas naturais. Não leia como anúncio.'\n    : 'Envie uma pergunta por vez. Espere a resposta antes de avançar para a próxima etapa.';"""
new_tip = """  const channelTip = effectiveChannel === 'audio'\n    ? 'Fale como conversa, com frases curtas e pausas naturais. Não leia como anúncio.'\n    : 'Envie uma pergunta por vez. Espere a resposta antes de avançar para a próxima etapa.';\n  const tip = `${styleGuidance(style)} ${channelTip}`;"""
if old_tip not in text:
    raise SystemExit('tip block not found')
text = text.replace(old_tip, new_tip)
playbook.write_text(text)

test = Path('src/tests/composerPlaybook.test.ts')
t = test.read_text()
anchor = "assert(/entender|gargalo|avaliar/i.test(consultativeCopy),'consultative style uses diagnostic wording');\n"
addition = """assert(friendlyCopy.startsWith('E aí, João!'),'friendly style opens naturally with E aí');\nconst pastoralCopy=buildComposerPlan({person:{displayName:'João'},signal,objective:'descobrir_dor',style:'pastoral'}).options[0].text;\nassert(pastoralCopy.startsWith('Paz, João!'),'pastoral style opens naturally with Paz');\nconst casualCopy=buildComposerPlan({person:{displayName:'João'},signal,objective:'descobrir_dor',style:'descontraido'}).options[0].text;\nassert(casualCopy.startsWith('Fala, João!'),'casual style has its own WhatsApp voice');\nconst directCopy=buildComposerPlan({person:{displayName:'João'},signal,objective:'descobrir_dor',style:'objetivo'}).options[0].text;\nassert(directCopy.startsWith('João,'),'objective style starts directly with the person');\nassert(/Paz/.test(pastoralCopy) && !/Paz/.test(friendlyCopy),'pastoral greeting is reserved for pastoral tone');\n"""
if anchor not in t:
    raise SystemExit('test anchor not found')
t = t.replace(anchor, anchor + addition)
test.write_text(t)
