import XLSX from 'xlsx';

export function getHeaderRow(filePath: string): string[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });
  return (rows[0] ?? []).map((value) => String(value));
}
