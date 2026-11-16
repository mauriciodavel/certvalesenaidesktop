export type ExportValue = string | number | null | undefined;
export type ExportRow = Record<string, ExportValue>;
export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

const text = (value: ExportValue) => value === null || value === undefined ? '' : String(value);
const csvCell = (value: ExportValue) => `"${text(value).replace(/"/g, '""')}"`;

export function buildCsv(rows: ExportRow[]) {
  if (!rows.length) return '\uFEFF';
  const headers = Object.keys(rows[0]);
  return `\uFEFF${[headers.map(csvCell).join(';'), ...rows.map(row => headers.map(header => csvCell(row[header])).join(';'))].join('\r\n')}`;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function exportRows(format: ExportFormat, rows: ExportRow[], title: string, filename: string) {
  if (!rows.length) throw new Error('Não há registros para exportar com os filtros aplicados.');
  const headers = Object.keys(rows[0]);
  if (format === 'csv') {
    download(new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
    return;
  }
  if (format === 'xlsx') {
    const { Workbook } = await import('exceljs');
    const workbook = new Workbook();
    workbook.creator = 'Certifica Vale';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(title.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = headers.map(header => ({ header, key: header, width: Math.min(40, Math.max(12, header.length + 3)) }));
    rows.forEach(row => sheet.addRow(row));
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF072E61' } };
    header.alignment = { vertical: 'middle' };
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: headers.length } };
    const buffer = await workbook.xlsx.writeBuffer();
    download(new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filename}.xlsx`);
    return;
  }
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  document.setFontSize(15);
  document.setTextColor(7, 46, 97);
  document.text(title, 10, 11);
  document.setFontSize(8);
  document.setTextColor(90);
  document.text(`${rows.length} registro(s) filtrado(s) • Gerado em ${new Date().toLocaleString('pt-BR')}`, 10, 16);
  autoTable(document, {
    startY: 20,
    head: [headers],
    body: rows.map(row => headers.map(header => text(row[header]))),
    theme: 'grid',
    styles: { fontSize: 5.5, cellPadding: 1, overflow: 'linebreak' },
    headStyles: { fillColor: [7, 46, 97], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 249, 252] },
    horizontalPageBreak: true,
    horizontalPageBreakRepeat: 0,
    margin: { top: 20, right: 8, bottom: 8, left: 8 },
  });
  document.save(`${filename}.pdf`);
}
