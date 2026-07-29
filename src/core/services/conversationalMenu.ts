import { LanguageCode, EffectiveEcosystemContext, ToolDefinition } from '../../types';
import {
  matchMenuTrigger,
  resolveDemoMenuProjection,
  staticOptionDefinitions,
  optionsLocalizedCatalog,
  DemoIdentityScenario,
  ProjectedMenuOption,
} from '../../features/menu/menuDomain';
import { menuUxCatalog } from '../../i18n/menuUx';

export interface ConversationalMenuResponse {
  isTriggerMatch: boolean;
  matchedTrigger?: string;
  menuTitle: string;
  subtitle: string;
  publicOptions: ProjectedMenuOption[];
  musicscaleAuthOptions: ProjectedMenuOption[];
  footerNote: string;
}

export class ConversationalMenuService {
  static isTrigger(input: string, locale: LanguageCode): boolean {
    return matchMenuTrigger(input, locale) !== null;
  }

  static getMenu(params: {
    input: string;
    locale: LanguageCode;
    scenario: DemoIdentityScenario;
    context: EffectiveEcosystemContext;
    tools: ToolDefinition[];
  }): ConversationalMenuResponse {
    const triggerMatch = matchMenuTrigger(params.input, params.locale);
    const strings = menuUxCatalog[params.locale] || menuUxCatalog['pt-BR'];

    if (!triggerMatch) {
      return {
        isTriggerMatch: false,
        menuTitle: strings.noMatchTitle,
        subtitle: strings.noMatchDesc,
        publicOptions: [],
        musicscaleAuthOptions: [],
        footerNote: '',
      };
    }

    const projectionResults = resolveDemoMenuProjection(
      params.context,
      params.scenario,
      staticOptionDefinitions,
      params.tools
    );

    const publicOptions: ProjectedMenuOption[] = [];
    const musicscaleAuthOptions: ProjectedMenuOption[] = [];
    const localizedMap = optionsLocalizedCatalog[params.locale] || optionsLocalizedCatalog['pt-BR'];

    for (const opt of staticOptionDefinitions) {
      const loc = localizedMap[opt.id];
      const projection = projectionResults[opt.id] || { allowed: false, reason: undefined };

      const projectedOpt: ProjectedMenuOption = {
        ...opt,
        title: loc ? loc.title : '',
        description: loc ? loc.description : '',
        badge: loc ? loc.badge : undefined,
        allowed: projection.allowed,
        reason: projection.reason,
      };

      if (opt.category === 'public') {
        publicOptions.push(projectedOpt);
      } else {
        if (projectedOpt.allowed) {
          musicscaleAuthOptions.push(projectedOpt);
        }
      }
    }

    const menuTitle = strings.menuTitle;
    const subtitle = params.scenario === 'linked_demo' ? strings.subtitleLinked : strings.subtitleUnlinked;
    const footerNote = strings.footerNote;

    return {
      isTriggerMatch: true,
      matchedTrigger: triggerMatch.canonicalTrigger,
      menuTitle,
      subtitle,
      publicOptions,
      musicscaleAuthOptions,
      footerNote,
    };
  }
}
