/** @type {import('tailwindcss').Config} */
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
        display: ["GC Tenwork", ...[
          "Menlo",
          "\"Meslo LG\"",
          "\"Cascadia Code\"",
          "Consolas",
          "\"Liberation Mono\"",
          "monospace"
        ]],
        sans: ["GC Tenwork", ...[
          "Menlo",
          "\"Meslo LG\"",
          "\"Cascadia Code\"",
          "Consolas",
          "\"Liberation Mono\"",
          "monospace"
        ]],
        serif: ["GC Tenwork", ...[
          "Menlo",
          "\"Meslo LG\"",
          "\"Cascadia Code\"",
          "Consolas",
          "\"Liberation Mono\"",
          "monospace"
        ]],
        mono: ["AOT Serial Mono", ...[
          "Menlo",
          "\"Meslo LG\"",
          "\"Cascadia Code\"",
          "Consolas",
          "\"Liberation Mono\"",
          "monospace"
        ]]
      }
    }
  },
  plugins: []
};
