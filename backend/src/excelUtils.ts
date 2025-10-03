import * as XLSX from 'xlsx';

export function extractDocumentNumbersFromExcel(buffer: Buffer): string[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  // Assume primeira coluna tem o documentNumber, ignora header
  return (data as any[][]).slice(1).map(row => String(row[0])).filter(Boolean);
}

export function buildResultExcel(results: Array<any>): Buffer {
  // results: [{ documentNumber, provider, balance? (ou errorMessage) }]
  const header = ['documentNumber', 'provider', 'balance', 'errorMessage'];
  const rows = [header];
  for (const r of results) {
    rows.push([
      r.documentNumber,
      r.provider,
      r.balance ?? '',
      r.errorMessage ?? ''
    ]);
  }
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Resultados');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
