import { describe, expect, it } from 'vitest';
import { buildCsv } from './export';

describe('buildCsv', () => {
  it('gera CSV compatível com Excel, incluindo BOM e separador brasileiro', () => {
    const csv = buildCsv([{ Nome: 'Ana; Maria', Resultado: 'Aprovado', Nota: 92.5 }]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Nome";"Resultado";"Nota"');
    expect(csv).toContain('"Ana; Maria";"Aprovado";"92.5"');
  });

  it('escapa aspas nos valores', () => {
    expect(buildCsv([{ Nome: 'João "Joca"' }])).toContain('"João ""Joca"""');
  });
});
