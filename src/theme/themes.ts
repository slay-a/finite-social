export interface Theme {
  id: string;
  name: string;
  swatch: string;   // color shown in picker
  isDark: boolean;

  bg: string;
  surface: string;
  card: string;
  cardAlt: string;
  border: string;

  primary: string;
  accent: string;
  warning: string;
  danger: string;
  purple: string;
  cyan: string;

  text: string;
  textSub: string;
  textMuted: string;
  textDim: string;

  hnOrange: string;
  devPurple: string;

  tabBarBg: string;
  tabActive: string;
  tabInactive: string;

  categoryColors: Record<string, string>;
}

export const THEMES: Theme[] = [
  {
    id: 'dark',
    name: 'Dark',
    swatch: '#1A1A24',
    isDark: true,
    bg: '#0A0A0F', surface: '#141419', card: '#1A1A24', cardAlt: '#1E1E2A',
    border: 'rgba(255,255,255,0.07)',
    primary: '#58A6FF', accent: '#39D353', warning: '#F7C94B', danger: '#FF6B70',
    purple: '#B78BFA', cyan: '#56D4E8',
    text: '#FFFFFF', textSub: '#C8D1DA', textMuted: '#8B949E', textDim: '#4A5568',
    hnOrange: '#FF6314', devPurple: '#9333EA',
    tabBarBg: '#0D0D14', tabActive: '#58A6FF', tabInactive: '#4A5568',
    categoryColors: {
      All: '#58A6FF', AI: '#B78BFA', Dev: '#39D353',
      Startups: '#F7C94B', Security: '#FF6B70', Science: '#56D4E8', Brainrot: '#FF2D78', Repos: '#58A6FF',
    },
  },
  {
    id: 'amoled',
    name: 'AMOLED',
    swatch: '#000000',
    isDark: true,
    bg: '#000000', surface: '#080808', card: '#101010', cardAlt: '#161616',
    border: 'rgba(255,255,255,0.09)',
    primary: '#6AB7FF', accent: '#4FD97A', warning: '#FFD045', danger: '#FF7B7B',
    purple: '#C49EFF', cyan: '#60DDEE',
    text: '#FFFFFF', textSub: '#D0D9E2', textMuted: '#909AA4', textDim: '#505868',
    hnOrange: '#FF7328', devPurple: '#A855F7',
    tabBarBg: '#000000', tabActive: '#6AB7FF', tabInactive: '#505868',
    categoryColors: {
      All: '#6AB7FF', AI: '#C49EFF', Dev: '#4FD97A',
      Startups: '#FFD045', Security: '#FF7B7B', Science: '#60DDEE', Brainrot: '#FF4D90', Repos: '#6AB7FF',
    },
  },
  {
    id: 'light',
    name: 'Light',
    swatch: '#F0F2F5',
    isDark: false,
    bg: '#F0F2F5', surface: '#FFFFFF', card: '#FFFFFF', cardAlt: '#F8F9FA',
    border: 'rgba(0,0,0,0.10)',
    primary: '#0969DA', accent: '#1A7F37', warning: '#9A6700', danger: '#CF222E',
    purple: '#8250DF', cyan: '#1781B5',
    text: '#1C1E21', textSub: '#444950', textMuted: '#65676B', textDim: '#BCC0C4',
    hnOrange: '#D44A00', devPurple: '#7928CA',
    tabBarBg: '#FFFFFF', tabActive: '#0969DA', tabInactive: '#8D9199',
    categoryColors: {
      All: '#0969DA', AI: '#8250DF', Dev: '#1A7F37',
      Startups: '#9A6700', Security: '#CF222E', Science: '#1781B5', Brainrot: '#C73E85', Repos: '#0969DA',
    },
  },
  {
    id: 'sepia',
    name: 'Sepia',
    swatch: '#2A231A',
    isDark: true,
    bg: '#1A1410', surface: '#221C15', card: '#2A231A', cardAlt: '#312821',
    border: 'rgba(255,210,140,0.10)',
    primary: '#E8A87C', accent: '#8BC34A', warning: '#F7C94B', danger: '#FF6B70',
    purple: '#D4A0F0', cyan: '#72CCB8',
    text: '#F5E6C8', textSub: '#D4BC94', textMuted: '#A08060', textDim: '#604030',
    hnOrange: '#E07020', devPurple: '#B060E0',
    tabBarBg: '#160F0A', tabActive: '#E8A87C', tabInactive: '#604030',
    categoryColors: {
      All: '#E8A87C', AI: '#D4A0F0', Dev: '#8BC34A',
      Startups: '#F7C94B', Security: '#FF8080', Science: '#72CCB8', Brainrot: '#FF8AAA', Repos: '#E8A87C',
    },
  },
  {
    id: 'colorblind',
    name: 'Color Safe',
    swatch: '#001E5A',
    isDark: true,
    // IBM color-blind safe palette — no red/green reliance
    bg: '#0A0A0F', surface: '#141419', card: '#1A1A24', cardAlt: '#1E1E2A',
    border: 'rgba(255,255,255,0.07)',
    primary: '#648FFF', accent: '#FFB000', warning: '#FE6100', danger: '#DC267F',
    purple: '#785EF0', cyan: '#009CDE',
    text: '#FFFFFF', textSub: '#C8D1DA', textMuted: '#8B949E', textDim: '#4A5568',
    hnOrange: '#FE6100', devPurple: '#785EF0',
    tabBarBg: '#0D0D14', tabActive: '#648FFF', tabInactive: '#4A5568',
    categoryColors: {
      All: '#648FFF', AI: '#785EF0', Dev: '#FFB000',
      Startups: '#FE6100', Security: '#DC267F', Science: '#009CDE', Brainrot: '#FF6E54', Repos: '#648FFF',
    },
  },
];

export const DEFAULT_THEME = THEMES[0];
export type ThemeId = typeof THEMES[number]['id'];
