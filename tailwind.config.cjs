/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        "zb-bg": "var(--zb-bg)",
        "zb-surface": "var(--zb-surface)",
        "zb-surface-strong": "var(--zb-surface-strong)",
        "zb-ink": "var(--zb-ink)",
        "zb-ink-muted": "var(--zb-ink-muted)",
        "zb-subtle": "var(--zb-subtle)",
        "zb-border": "var(--zb-border)",
        "zb-green": "var(--zb-green)",
        "zb-blue": "var(--zb-blue)",
        "zb-moss": "var(--zb-moss)",
        "zb-ever": "var(--zb-ever)",
        "zb-gray": "var(--zb-gray)",
        "zb-warm": "var(--zb-warm)",
        "zb-water": "var(--zb-water)",
        "zb-leaf": "var(--zb-leaf)",
        "zb-black": "var(--zb-black)",
        "zb-white": "var(--zb-white)",
      },
      fontFamily: {
        display: [
          "var(--zb-font-display)",
          "Montserrat",
          "system-ui",
          "sans-serif",
        ],
        ui: ["var(--zb-font-ui)", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "zb-sm": "var(--zb-radius-sm)",
        "zb-md": "var(--zb-radius-md)",
        "zb-lg": "var(--zb-radius-lg)",
      },
      boxShadow: {
        "zb-1": "var(--zb-shadow-1)",
        "zb-2": "var(--zb-shadow-2)",
      },
      spacing: {
        "zb-1": "var(--zb-space-1)",
        "zb-2": "var(--zb-space-2)",
        "zb-3": "var(--zb-space-3)",
        "zb-4": "var(--zb-space-4)",
        "zb-5": "var(--zb-space-5)",
        "zb-6": "var(--zb-space-6)",
        "zb-7": "var(--zb-space-7)",
        "zb-8": "var(--zb-space-8)",
      },
      zIndex: {
        "zb-base": "var(--zb-z-base)",
        "zb-header": "var(--zb-z-header)",
        "zb-overlay": "var(--zb-z-overlay)",
      },
    },
  },
  plugins: [],
};
