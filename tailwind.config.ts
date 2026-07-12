import type { Config } from "tailwindcss";

// Base mínima do S0. No Sprint 1, ao portar as telas do Base44, este arquivo
// absorve o tailwind.config.js do protótipo (tokens shadcn, cores por tipo de
// clínica/white-label) para garantir pixel parity.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
