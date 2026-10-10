/** @type {import('tailwindcss').Config} */
const systemSansFallbacks = [
  "Inter",
  "Segoe UI",
  "Arial",
  "sans-serif"
];

const systemFontFallbacks = [
  "Menlo",
  "\"Meslo LG\"",
  "\"Cascadia Code\"",
  "Consolas",
  "\"Liberation Mono\"",
  "monospace"
];

export default {
  corePlugins: {
    preflight: false
  },
  content: [
    "./src/**/*.{html,js}",
    "./templates/**/*.html",
    "./scripts/**/*.mjs",
    "./writing/**/*.md"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["Kross Neue Grotesk", ...systemSansFallbacks],
        sans: ["Kross Neue Grotesk", ...systemSansFallbacks],
        serif: ["Kross Neue Grotesk", ...systemSansFallbacks],
        mono: ["AOT Serial Mono", ...systemFontFallbacks]
      }
    }
  },
  plugins: []
};
