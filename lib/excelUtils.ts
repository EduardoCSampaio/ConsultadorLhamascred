import * as XLSX from 'xlsx'; // CORRIGIDO
import { Buffer } from 'buffer'; // Importar Buffer

export function extractDocumentNumbersFromExcel(fileBuffer: Buffer): string[] {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  const documentNumbers: string[] = [];
  // Assumindo que os números de documento estão na primeira coluna (índice 0)
  // e ignorando a primeira linha (cabeçalho)
  for (let i = 1; i < json.length; i++) {
    const row: any = json[i];
    if (row && row[0]) {
      documentNumbers.push(String(row[0]).trim());
    }
  }
  return documentNumbers;
}

export function buildResultExcel(results: any[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(results);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}