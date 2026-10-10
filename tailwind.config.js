/** @type {import('tailwindcss').Config} */
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
        display: ["GC Tenwork", ...systemFontFallbacks],
        sans: ["GC Tenwork", ...systemFontFallbacks],
        serif: ["GC Tenwork", ...systemFontFallbacks],
        mono: ["AOT Serial Mono", ...systemFontFallbacks]
      }
    }
  },
  plugins: []
};
