export const PulseTheme = {
  bg:         '#0A0A0F',
  surface:    '#141419',
  card:       '#1A1A24',
  cardAlt:    '#1E1E2A',
  border:     'rgba(255,255,255,0.07)',

  primary:    '#58A6FF',
  accent:     '#39D353',
  warning:    '#F7C94B',
  danger:     '#FF6B70',
  purple:     '#B78BFA',
  cyan:       '#56D4E8',

  text:       '#FFFFFF',
  textSub:    '#C8D1DA',
  textMuted:  '#8B949E',
  textDim:    '#4A5568',

  hnOrange:   '#FF6314',
  devPurple:  '#9333EA',

  tabBarBg:   '#0D0D14',
  tabActive:  '#58A6FF',
  tabInactive:'#4A5568',

  categoryColors: {
    All:      '#58A6FF',
    AI:       '#B78BFA',
    Dev:      '#39D353',
    Startups: '#F7C94B',
    Security: '#FF6B70',
    Science:  '#56D4E8',
    Brainrot: '#FF2D78',
  } as Record<string, string>,
} as const;

export type PulseThemeType = typeof PulseTheme;
