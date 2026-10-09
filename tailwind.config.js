/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Tema cinematográfico oscuro, alimentado por variables CSS
        // (ver src/styles/globals.css). Permite el modo claro opcional.
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        line: 'var(--border)',
        ink: 'var(--text)',
        muted: 'var(--text-muted)',
        accent: 'var(--accent)',
        'accent-strong': 'var(--accent-strong)',
        'accent-soft': 'var(--accent-soft)',
        danger: 'var(--danger)',
        success: 'var(--success)',
      },
      borderRadius: {
        xl2: 'var(--radius)',
      },
      boxShadow: {
        soft: '0 8px 30px rgba(0, 0, 0, 0.35)',
        glow: '0 0 24px rgba(139, 92, 246, 0.35)',
      },
    },
  },
  plugins: [],
};
