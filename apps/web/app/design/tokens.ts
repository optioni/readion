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
  typography: {
    sans: ['Inter', 'ui-sans-serif', 'system-ui'],
    mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
  },
} as const
