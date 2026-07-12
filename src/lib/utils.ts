// Porta de reference/base44 src/lib/utils.js (cn — merge de classes Tailwind)
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
