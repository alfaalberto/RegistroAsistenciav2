import * as XLSX from 'xlsx';

export interface ProcessConfig {
  sheetName: string;
  days: string;
  year: number;
  month: string;
}

function cleanData(data: any[][]): any[][] {
  // Drop rows where all cells are empty
  let filteredData = data.filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''));

  if (filteredData.length === 0) return [];

  // Find and remove completely empty columns
  const colCount = Math.max(...filteredData.map(row => row.length));
  const emptyColumnIndices = new Set<number>();

  for (let j = 0; j < colCount; j++) {
    if (filteredData.every(row => row[j] === null || row[j] === undefined || row[j] === '')) {
      emptyColumnIndices.add(j);
    }
  }

  if (emptyColumnIndices.size > 0) {
    filteredData = filteredData.map(row => row.filter((_, j) => !emptyColumnIndices.has(j)));
  }
  
  return filteredData;
}

export async function processExcel(file: File, config: ProcessConfig): Promise<Record<string, any>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  
  if (!workbook.SheetNames.includes(config.sheetName)) {
    throw new Error(`Sheet "${config.sheetName}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`);
  }

  const worksheet = workbook.Sheets[config.sheetName];
  let jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, blankrows: false });

  let data = cleanData(jsonData);

  const records: Record<string, any>[] = [];
  const days = config.days.split(',').map(d => d.trim()).filter(d => d);

  for (let i = 0; i < data.length - 1; i++) {
    const row = data[i];
    const nextRow = data[i+1];

    const isIdRow = row.some(cell => typeof cell === 'string' && cell.includes('ID :'));

    if (isIdRow) {
      const idIndex = row.findIndex(cell => typeof cell === 'string' && cell.includes('ID :'));
      const nameIndex = row.findIndex(cell => typeof cell === 'string' && cell.includes('Nombre :'));
      const deptIndex = row.findIndex(cell => typeof cell === 'string' && cell.includes('Dept. :'));

      const id = idIndex !== -1 && (idIndex + 2 < row.length) ? row[idIndex + 2] : null;
      const name = nameIndex !== -1 && (nameIndex + 2 < row.length) ? row[nameIndex + 2] : null;
      const department = deptIndex !== -1 && (deptIndex + 2 < row.length) ? row[deptIndex + 2] : null;

      // The next row should contain the attendance data
      const dateRow = nextRow || [];

      const dayRecords: { [key: string]: any } = {};
      days.forEach((day, index) => {
        const key = `${day}-${config.month}-${config.year}`;
        const value = dateRow[index];
        dayRecords[key] = (value !== null && value !== undefined) ? value : "";
      });
      
      if (id || name) { // Only add record if it has at least an ID or a name
          records.push({
            'ID': id,
            'Nombre': name,
            'Departamento': department,
            ...dayRecords
          });
      }

      i += 1; // Increment i to skip the date row we've just processed
    }
  }

  return records;
}
