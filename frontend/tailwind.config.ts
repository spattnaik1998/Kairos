import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Kairos brand palette — deep navy + electric amber
        kairos: {
          bg:        "#0a0e1a",
          surface:   "#111827",
          border:    "#1f2937",
          muted:     "#374151",
          text:      "#f9fafb",
          subtle:    "#9ca3af",
          accent:    "#f59e0b",   // amber — primary CTA
          accentDim: "#92400e",
          green:     "#10b981",   // bullish
          red:       "#ef4444",   // bearish
          blue:      "#3b82f6",   // info / neutral
          purple:    "#8b5cf6",   // pattern library
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(rgba(59,130,246,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.03) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "40px 40px",
      },
    },
  },
  plugins: [],
};

export default config;
