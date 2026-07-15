"use client";

// Fronteira de client para os ícones do lucide-react em páginas PÚBLICAS.
//
// Por quê: no lucide-react 1.24.0 cada ícone renderiza via `Icon` (Icon.mjs),
// que chama `useContext(LucideContext)` e é marcado "use client". Quando um
// ícone é importado DIRETO por um React Server Component (as páginas públicas
// SSR: /buscar, /clinica, /anamnese, ClinicaCard), o bundling perde essa
// fronteira e o `useContext` roda no render do servidor com o dispatcher nulo
// → "Cannot read properties of null (reading 'useContext')". Reexportar os
// ícones atrás deste "use client" restaura a fronteira: viram client
// references e renderizam com dispatcher válido (SSR + hidratação).
//
// Server Components de rotas públicas devem importar ícones DAQUI, nunca de
// "lucide-react" direto (garantido por tests/unit/public-icons-boundary.test.ts).
export {
  Search,
  Clock,
  MapPin,
  Star,
  Stethoscope,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
