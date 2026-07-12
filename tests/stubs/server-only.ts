// Stub de `server-only` para os testes (vitest roda em Node, não no bundler do
// Next). Em produção o pacote real faz o build falhar se um módulo server-only
// vazar para o browser; nos testes ele é um no-op.
export {};
