import { describe, expect, it } from 'vitest';
import { buildCsv, pdfPagePlan, selectExportFields } from './export';

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

describe('selectExportFields', () => {
  it('mantém apenas os campos escolhidos e na ordem selecionada', () => {
    const rows = [{ Nome: 'Ana', Nota: 90, Gerência: 'Operacional' }];
    expect(selectExportFields(rows, ['Nome', 'Nota'])).toEqual([{ Nome: 'Ana', Nota: 90 }]);
  });
});

describe('pdfPagePlan', () => {
  it('coloca todos os gráficos antes das páginas de dados', () => {
    expect(pdfPagePlan(3)).toEqual(['chart-1', 'chart-2', 'chart-3', 'data']);
  });

  it('mantém a exportação dos dados quando não há gráficos', () => {
    expect(pdfPagePlan(0)).toEqual(['data']);
  });
});
