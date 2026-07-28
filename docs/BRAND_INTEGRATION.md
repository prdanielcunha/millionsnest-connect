# Integração da Marca - MillionsNest Connect

Esta documentação registra os assets, tamanhos e especificações visuais utilizados para aplicar a marca MillionsNest Connect nas superfícies do produto.

- **Versão utilizada:** Brand Kit V2.0
- **Fonte original:** `MillionsNest_Connect_Brand_Kit_v2.0`
- **Diretório de runtime:** `/public/brand/connect/v2/`

## Aplicação por Superfície (Contexto Dark)

- **Sidebar Desktop:**
  - **Asset usado:** `connect-logo-horizontal-on-dark.svg`
  - **Dimensões CSS:** 208 × 50 px (`desktopWordmark`)
- **Drawer Mobile:**
  - **Asset usado:** `connect-logo-horizontal-on-dark.svg`
  - **Dimensões CSS:** 184 × 44 px (`drawerWordmark`)
- **Cabeçalho Mobile:**
  - **Asset usado:** `connect-mark-color.svg`
  - **Dimensões CSS:** 40 × 40 px (`mobileMark`)

## Regras de Proteção e Escala

- **Área transparente oficial:** O SVG original possui uma área transparente (padding) nativa. Essa área protege o logotipo e **não deve** ser recortada.
- **ViewBox Intacto:** Sob nenhuma circunstância o `viewBox` dos assets SVG (ex: `0 0 2500 600`) deve ser modificado ou removido, nem devem ser usadas classes CSS de margem negativa para forçar o asset para fora da sua caixa protetora.
- O componente `<BrandLogo />` gerencia internamente e exclusivamente o dimensionamento por meio das props `size` para garantir proteção e preservação das proporções, utilizando `object-fit: contain` associado às definições absolutas listadas acima.

## Itens Preservados
- **Favicon, PWA, e Open Graph:** Já implantados integralmente na fase anterior (CONNECT-BRAND-01) e disponíveis estaticamente em `/public`.
- **Nenhum ícone ou asset externo ao Brand Kit oficial V2.0** foi injetado ou editado neste repositório para os fins de exibição da marca.

*Status: Atualizado durante a correção cirúrgica da escala e legibilidade da marca (CONNECT-BRAND-02).*
