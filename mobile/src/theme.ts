import type { ChipColor } from "./api";

export const colors = {
  bg: "#0B0B0F",
  surface: "#16161D",
  surfaceAlt: "#1E1E28",
  border: "#2A2A36",
  text: "#F5F5F7",
  textMuted: "#9A9AA8",
  accent: "#F7B500",
  accentText: "#0B0B0F",
  success: "#34C759",
  danger: "#FF453A",
};

export interface ChipMeta {
  color: ChipColor;
  label: string;
  mood: string;
  value: number;
  seats: number;
  swatch: string;
  ink: string;
}

export const CHIP_META: Record<ChipColor, ChipMeta> = {
  red: { color: "red", label: "Red", mood: "Rage", value: 1, seats: 1, swatch: "#E5484D", ink: "#FFFFFF" },
  white: { color: "white", label: "White", mood: "Safe", value: 5, seats: 1, swatch: "#EDEDED", ink: "#0B0B0F" },
  blue: { color: "blue", label: "Blue", mood: "Calm", value: 10, seats: 1, swatch: "#3B82F6", ink: "#FFFFFF" },
  black: { color: "black", label: "Black", mood: "Consumes All", value: 100, seats: 10, swatch: "#000000", ink: "#F7B500" },
};

export const CHIP_ORDER: ChipColor[] = ["red", "white", "blue", "black"];
