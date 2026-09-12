from pathlib import Path

p = Path('src/features/contacts/LivePeoplePage.tsx')
s = p.read_text()

old = """  useEffect(() => {\n    if (!selected) return;\n    const known = STAGES.some(stage => stage.objective === selected.salesStage) ? selected.salesStage as Objective : 'iniciar_conversa';\n    setObjective(known); setEditPhone(selected.phone || ''); setPlan(null); setDraft('');\n  }, [selectedId, selected?.phone, selected?.salesStage]);\n"""
new = """  useEffect(() => {\n    if (!selected) return;\n    const known = STAGES.some(stage => stage.objective === selected.salesStage) ? selected.salesStage as Objective : 'iniciar_conversa';\n    setObjective(known);\n    setEditPhone(selected.phone || '');\n    setPlan(null);\n    setDraft('');\n  }, [selectedId]);\n"""
assert old in s, 'selected reset effect not found'
s = s.replace(old, new)

old = """      setPlan(result); setDraft(result.draft || result.options?.[0]?.text || ''); await refresh();\n    } catch (e) { setError(e instanceof Error ? e.message : 'Erro'); } finally { setBusy(false); }\n  };\n"""
new = """      setPlan(result);\n      setDraft(result.draft || result.options?.[0]?.text || '');\n      setPeople(current => current.map(person => person.id === selected.id ? { ...person, salesStage: nextObjective } : person));\n    } catch (e) { setError(e instanceof Error ? e.message : 'Erro'); } finally { setBusy(false); }\n  };\n\n  const selectStage = (nextObjective: Objective) => {\n    setObjective(nextObjective);\n    setPlan(null);\n    setDraft('');\n    void generate(nextObjective, tone, style);\n  };\n"""
assert old in s, 'generate tail not found'
s = s.replace(old, new, 1)

old = """  return <main className=\"mx-auto w-full max-w-7xl space-y-5 pb-24\">\n"""
new = """  return <main className=\"mx-auto w-full min-w-0 max-w-7xl space-y-5 overflow-x-hidden pb-24\">\n"""
assert old in s, 'main class not found'
s = s.replace(old, new)

old = """      <div className=\"space-y-4\">\n"""
new = """      <div className=\"min-w-0 space-y-4\">\n"""
assert old in s, 'left column not found'
s = s.replace(old, new, 1)

old = """      <div className=\"rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:p-5\">"""
new = """      <div className=\"min-w-0 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:p-5\">"""
assert old in s, 'detail card not found'
s = s.replace(old, new, 1)

old = """<div className=\"flex gap-2\"><input value={editPhone} onChange={e=>setEditPhone(e.target.value)} inputMode=\"tel\" placeholder=\"55 43 99999-9999\" className=\"min-h-11 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none\"/><button onClick={()=>void savePhone()} disabled={busy} className=\"rounded-xl border border-white/10 px-3 text-sm font-medium text-white disabled:opacity-40\">{text.savePhone}</button></div>"""
new = """<div className=\"flex min-w-0 gap-2\"><input value={editPhone} onChange={e=>setEditPhone(e.target.value)} inputMode=\"tel\" placeholder=\"55 43 99999-9999\" className=\"min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none\"/><button onClick={()=>void savePhone()} disabled={busy} className=\"shrink-0 rounded-xl border border-white/10 px-3 text-sm font-medium text-white disabled:opacity-40\">{text.savePhone}</button></div>"""
assert old in s, 'phone row not found'
s = s.replace(old, new)

old = """<div className=\"flex gap-2 overflow-x-auto pb-2\">{STAGES.map((stage,index)=><button key={stage.objective} onClick={()=>{setObjective(stage.objective); void client.updatePerson(selected.id,{salesStage:stage.objective}); setPlan(null); setDraft('');}} className={`shrink-0 rounded-xl border px-3 py-2 text-left ${objective===stage.objective?'border-indigo-400/40 bg-indigo-400/[0.10] text-indigo-100':'border-white/10 bg-black/10 text-slate-400'}`}>"""
new = """<div className=\"flex max-w-full snap-x snap-mandatory gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden\">{STAGES.map((stage,index)=><button key={stage.objective} disabled={busy && objective===stage.objective} onClick={()=>selectStage(stage.objective)} className={`min-w-[104px] shrink-0 snap-start rounded-xl border px-3 py-2 text-left transition ${objective===stage.objective?'border-indigo-400/50 bg-indigo-400/[0.12] text-indigo-100 shadow-[0_0_0_1px_rgba(129,140,248,.08)]':'border-white/10 bg-black/10 text-slate-400 hover:bg-white/[0.03]'} disabled:opacity-60`}>"""
assert old in s, 'stage row not found'
s = s.replace(old, new)

old = """<section className=\"rounded-2xl border border-white/10 bg-black/15 p-4\"><div className=\"flex flex-wrap items-center justify-between gap-3\"><div><h3 className=\"text-sm font-semibold text-white\">{text.messages}</h3><p className=\"mt-1 text-xs text-slate-500\">{currentStage.hintPt}</p></div><button onClick={()=>void generate()} disabled={busy} className=\"inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white disabled:opacity-40\">{busy?<Loader2 size={15} className=\"animate-spin\"/>:<MessageCircle size={15}/>} {text.generate}</button></div>"""
new = """<section className=\"min-w-0 rounded-2xl border border-white/10 bg-black/15 p-4\"><div className=\"grid min-w-0 gap-3 sm:grid-cols-[1fr_auto] sm:items-center\"><div className=\"min-w-0\"><h3 className=\"text-sm font-semibold text-white\">{text.messages}</h3><p className=\"mt-1 text-xs leading-5 text-slate-500\">{busy ? 'Preparando a melhor abordagem para esta etapa…' : currentStage.hintPt}</p></div><button onClick={()=>void generate()} disabled={busy} className=\"inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white disabled:opacity-40 sm:w-auto\">{busy?<Loader2 size={15} className=\"animate-spin\"/>:<MessageCircle size={15}/>} {text.generate}</button></div>"""
assert old in s, 'message header not found'
s = s.replace(old, new)

s = s.replace('className=\"mt-4 flex flex-wrap gap-2\"', 'className=\"mt-4 flex max-w-full flex-wrap gap-2\"', 1)
s = s.replace('className=\"mt-2 flex flex-wrap gap-2\"', 'className=\"mt-2 flex max-w-full flex-wrap gap-2\"', 1)

needle = """          {plan && <div className=\"mt-4 space-y-3\">"""
replacement = """          {!plan && !busy && <button onClick={()=>void generate()} className=\"mt-4 w-full rounded-2xl border border-dashed border-indigo-400/25 bg-indigo-400/[0.04] p-4 text-left transition hover:bg-indigo-400/[0.07]\"><div className=\"text-sm font-medium text-indigo-100\">Gerar mensagem para {label(currentStage,currentLang)}</div><div className=\"mt-1 text-xs leading-5 text-slate-500\">Toque aqui ou escolha uma etapa acima. O Connect prepara 3 opções editáveis e depois você abre o WhatsApp com o texto pronto.</div></button>}\n          {plan && <div className=\"mt-4 space-y-3\">"""
assert needle in s, 'plan block not found'
s = s.replace(needle, replacement, 1)

p.write_text(s)
print('People mobile Composer UX fix applied')
