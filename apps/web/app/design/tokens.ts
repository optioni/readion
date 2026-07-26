export const readionDesignTokens = {
  colors: {
    background: {
      base: '#0f172a',
      surface: '#1e293b',
      elevated: '#0a0f1e',
      overlay: '#16213e',
    },
    primary: {
      default: '#1d4ed8',
      hover: '#1e40af',
      muted: '#1e40af',
      subtle: '#334155',
    },
    accent: {
      label: '#7c8cf8',
      labelMuted: '#93c5fd',
      gradient: '#4f46e5',
    },
    text: {
      primary: '#e2e8f0',
      secondary: '#94a3b8',
      muted: '#64748b',
      subtle: '#475569',
    },
    status: {
      poor: '#f87171',
      warning: '#fb923c',
      medium: '#fbbf24',
      good: '#34d399',
    },
    border: {
      default: '#1e293b',
      strong: '#334155',
    },
  },
  modes: {
    dark: {
      background: {
        base: '#0f172a',
        surface: '#1e293b',
        elevated: '#0a0f1e',
        overlay: '#16213e',
      },
      primary: {
        default: '#1d4ed8',
        hover: '#1e40af',
        active: '#1e3a8a',
      },
      accent: {
        label: '#7c8cf8',
      },
      text: {
        primary: '#e2e8f0',
        secondary: '#94a3b8',
        muted: '#64748b',
        subtle: '#475569',
        onPrimary: '#ffffff',
      },
      status: {
        poor: '#f87171',
        warning: '#fb923c',
        medium: '#fbbf24',
        good: '#34d399',
      },
      border: {
        default: '#1e293b',
        strong: '#334155',
      },
      focus: '#60a5fa',
      warning: '#fb923c',
      destructive: {
        default: '#b91c1c',
        hover: '#991b1b',
        active: '#7f1d1d',
      },
    },
    light: {
      background: {
        base: '#f8fafc',
        surface: '#ffffff',
        elevated: '#e2e8f0',
        overlay: '#f1f5f9',
      },
      primary: {
        default: '#1d4ed8',
        hover: '#1e40af',
        active: '#1e3a8a',
      },
      accent: {
        label: '#4338ca',
      },
      text: {
        primary: '#0f172a',
        secondary: '#334155',
        muted: '#475569',
        subtle: '#64748b',
        onPrimary: '#ffffff',
      },
      status: {
        poor: '#b91c1c',
        warning: '#c2410c',
        medium: '#a16207',
        good: '#047857',
      },
      border: {
        default: '#cbd5e1',
        strong: '#94a3b8',
      },
      focus: '#2563eb',
      warning: '#c2410c',
      destructive: {
        default: '#b91c1c',
        hover: '#991b1b',
        active: '#7f1d1d',
      },
    },
  },
  typography: {
    sans: ['Inter', 'ui-sans-serif', 'system-ui'],
    mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
  },
} as const
