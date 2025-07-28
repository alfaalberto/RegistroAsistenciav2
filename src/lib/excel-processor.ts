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

  const emptyColumnIndices = new Set<number>();
  if (filteredData.length > 0) {
    const colCount = Math.max(...filteredData.map(row => row.length));
    for (let j = 0; j < colCount; j++) {
      if (filteredData.every(row => !row[j])) {
        emptyColumnIndices.add(j);
      }
    }
  }

  if (emptyColumnIndices.size > 0) {
    return filteredData.map(row => row.filter((_, j) => !emptyColumnIndices.has(j)));
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

  let i = 0;
  while (i < data.length) {
    const row = data[i];
    if (typeof row?.[0] === 'string' && row[0].includes('ID')) {
      const idRow = row;
      const dateRow = data[i + 1] || [];

      const id = idRow[2];
      const name = idRow[4];
      const department = idRow[6];

      const dayRecords: { [key: string]: any } = {};
      days.forEach((day, index) => {
        const key = `${day}-${config.month}-${config.year}`;
        const value = dateRow[index];
        dayRecords[key] = (value !== null && value !== undefined) ? value : "";
      });
      
      records.push({
        'ID': id,
        'Nombre': name,
        'Departamento': department,
        ...dayRecords
      });

      i += 2; // Skip ID row and what is assumed to be the date row
    } else {
      i += 1;
    }
  }

  return records;
}
