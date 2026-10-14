import React, { useEffect, useMemo, useState } from 'react';
import type { LiveConnectSession } from '../../core/client/liveConnectSession';
import type { LanguageCode } from '../../types';
import { ConnectPushClient, pushNeedsHomeScreen, pushSupported, type PushDeviceView } from '../../core/client/connectPushClient';

const copy = {
  'pt-BR': { title: 'Avisos no celular', enable: 'Ativar neste dispositivo', disable: 'Desativar neste dispositivo', devices: 'Dispositivos', revoke: 'Remover', start: 'Silenciar a partir de', end: 'Voltar a avisar às', hint: 'O aviso oculta o conteúdo. Silêncio e Não Perturbe do aparelho podem impedir alertas.', install: 'No iPhone/iPad, adicione o Connect à Tela de Início pelo Safari e abra o aplicativo instalado.', unsupported: 'Este navegador não permite notificações em segundo plano.', denied: 'Permissão negada. Revise as notificações nas configurações do aparelho.', failure: 'Não foi possível atualizar os avisos. Sua Inbox continua funcionando.', success: 'Dispositivo ativado. A entrega depende da conexão e das configurações do aparelho.' },
  'en-US': { title: 'Mobile alerts', enable: 'Enable on this device', disable: 'Disable on this device', devices: 'Devices', revoke: 'Remove', start: 'Quiet from', end: 'Resume at', hint: 'Alerts hide message content. Device silence and Do Not Disturb may block alerts.', install: 'On iPhone/iPad, add Connect to your Home Screen in Safari and open the installed app.', unsupported: 'This browser does not support background notifications.', denied: 'Permission denied. Review notifications in device settings.', failure: 'Could not update alerts. Your Inbox still works.', success: 'Device enabled. Delivery depends on connectivity and device settings.' },
  'es-ES': { title: 'Avisos en el celular', enable: 'Activar en este dispositivo', disable: 'Desactivar en este dispositivo', devices: 'Dispositivos', revoke: 'Eliminar', start: 'Silenciar desde', end: 'Volver a avisar a las', hint: 'El aviso oculta el contenido. Silencio y No molestar pueden impedir avisos.', install: 'En iPhone/iPad, agrega Connect a la pantalla de inicio desde Safari y abre la aplicación instalada.', unsupported: 'Este navegador no permite notificaciones en segundo plano.', denied: 'Permiso denegado. Revisa las notificaciones en la configuración del dispositivo.', failure: 'No se pudieron actualizar los avisos. Tu Inbox sigue funcionando.', success: 'Dispositivo activado. La entrega depende de la conexión y del dispositivo.' },
};
export function InboxPushControls({ session, language }: { session: LiveConnectSession; language: LanguageCode }) {
  const client = useMemo(() => new ConnectPushClient(session), [session]);
  const t = copy[language];
  const [key, setKey] = useState('');
  const [devices, setDevices] = useState<PushDeviceView[]>([]);
  const [start, setStart] = useState(22), [end, setEnd] = useState(8);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  useEffect(() => {
    let current = true; setKey(''); setDevices([]); setNotice('');
    void client.status().then(status => { if (current) { setKey(status.publicKey); setDevices(status.devices); } }).catch(() => {});
    return () => { current = false; };
  }, [client]);
  // The API flag is canonical; unavailable/unauthorized feature has no deceptive active toggle.
  if (!key) return null;
  const supported = pushSupported(), install = pushNeedsHomeScreen();
  const run = async (action: () => Promise<void>, activating = false) => {
    setBusy(true); setNotice('');
    try { await action(); setDevices((await client.status()).devices); if (activating) setNotice(t.success); }
    catch (e) { setNotice(e instanceof Error && e.message === 'PUSH_PERMISSION_DENIED' ? t.denied : t.failure); }
    finally { setBusy(false); }
  };
  return <details className="connect-surface rounded-xl border border-[#2B3A4D] p-3 text-xs text-[#C4D2DF]">
    <summary className="connect-focus cursor-pointer font-semibold">{t.title}</summary>
    <p className="mt-3 text-[#8DA1B5]">{install ? t.install : !supported ? t.unsupported : t.hint}</p>
    {supported && !install && <div className="mt-3 flex flex-wrap items-end gap-3">
      <label>{t.start}<select className="ml-2 rounded bg-[#111A27] p-2" value={start} onChange={e => setStart(Number(e.target.value))}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select></label>
      <label>{t.end}<select className="ml-2 rounded bg-[#111A27] p-2" value={end} onChange={e => setEnd(Number(e.target.value))}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select></label>
      <button type="button" disabled={busy} className="connect-focus min-h-10 rounded border border-[#315064] px-3 disabled:opacity-50" onClick={() => void run(() => client.enable(key, start, end), true)}>{t.enable}</button>
      <button type="button" disabled={busy} className="connect-focus min-h-10 rounded border border-[#315064] px-3 disabled:opacity-50" onClick={() => void run(() => client.disableThisDevice())}>{t.disable}</button>
    </div>}
    {devices.length > 0 && <ul aria-label={t.devices} className="mt-3 space-y-2">{devices.map((d, index) => <li key={d.id} className="flex items-center justify-between gap-3"><span>{t.devices} {index + 1} · {d.timeZone} · {d.quietStart}:00–{d.quietEnd}:00</span><button type="button" className="connect-focus min-h-10 px-3" disabled={busy} onClick={() => void run(() => client.revoke(d.id))}>{t.revoke}</button></li>)}</ul>}
    {notice && <p role="status" className="mt-3">{notice}</p>}
  </details>;
}
