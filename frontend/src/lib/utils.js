import { clsx } from "clsx"\nimport { twMerge } from "tailwind-merge"\n\nexport function cn(...inputs) {\n  return twMerge(clsx(inputs))\n}
