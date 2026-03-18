import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#fef3ec",
          100: "#fde4d0",
          200: "#fac5a0",
          300: "#f7a06b",
          400: "#f47a3b",
          500: "#f26522",
          600: "#e34e14",
          700: "#bc3a12",
          800: "#962f17",
          900: "#792916",
        },
        nursery: {
          green: "#7bc67e",
          blue: "#64b5f6",
          yellow: "#ffd54f",
          pink: "#f48fb1",
          purple: "#ce93d8",
        },
      },
      fontFamily: {
        sans: ["var(--font-noto-sans-jp)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
