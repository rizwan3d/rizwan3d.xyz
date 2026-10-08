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
        display: [
          "Menlo",
          "\"Meslo LG\"",
          "\"Cascadia Code\"",
          "Consolas",
          "\"Liberation Mono\"",
          "monospace"
        ],
        sans: [
          "Menlo",
          "\"Meslo LG\"",
          "\"Cascadia Code\"",
          "Consolas",
          "\"Liberation Mono\"",
          "monospace"
        ],
        serif: [
          "Menlo",
          "\"Meslo LG\"",
          "\"Cascadia Code\"",
          "Consolas",
          "\"Liberation Mono\"",
          "monospace"
        ],
        mono: [
          "Menlo",
          "\"Meslo LG\"",
          "\"Cascadia Code\"",
          "Consolas",
          "\"Liberation Mono\"",
          "monospace"
        ]
      }
    }
  },
  plugins: []
};
