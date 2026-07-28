import { EffectiveEcosystemContext } from '../../types';

export type DemoToolInputFactory = (
  context: EffectiveEcosystemContext
) => Record<string, unknown>;

export const DEMO_TOOL_INPUT_FACTORIES: Readonly<Record<string, DemoToolInputFactory>> = {
  listSchedules: (context) => ({
    organizationId: context.activeOrganization.id,
    limit: 5,
    status: 'all'
  }),
  getSchedule: () => ({
    scheduleId: 'demo-schedule-001'
  }),
  createScheduleDraft: () => ({
    title: 'Culto Demo',
    date: '2026-08-02',
    serviceTime: '19:00'
  }),
  cloneSchedule: () => ({
    sourceScheduleId: 'demo-schedule-001',
    targetDate: '2026-08-09'
  }),
  listMembers: (context) => ({
    organizationId: context.activeOrganization.id
  }),
  addMember: () => ({
    name: 'Membro Demo 01',
    role: 'Vocal',
    phone: '+55 00 00000-0000'
  }),
  listRepertoire: () => ({
    query: 'Canção Demo',
    tag: 'demo'
  }),
  addSongToRepertoire: () => ({
    title: 'Canção Demo Local',
    artist: 'Artista Demo',
    key: 'G'
  }),
  searchLivingLibrary: () => ({
    query: 'Canção Demo'
  }),
  addSongToLivingLibrary: () => ({
    title: 'Canção Demo Global',
    artist: 'Artista Demo',
    isrc: 'DEMO-ISRC-0001',
    bpm: 120,
    defaultKey: 'G'
  })
};

export function buildDemoToolInput(
  tool: { name: string },
  context: EffectiveEcosystemContext
): Record<string, unknown> | null {
  const factory = DEMO_TOOL_INPUT_FACTORIES[tool.name];
  if (!factory) return null;
  return factory(context);
}
