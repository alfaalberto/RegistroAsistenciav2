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

function calculateHours(timeString: string | null | undefined): number | string {
  if (!timeString || typeof timeString !== 'string') {
    return 'NO HAY REGISTRO';
  }

  const parts = timeString.split('\n').map(p => p.trim()).filter(p => p);
  
  if (parts.length === 0) {
    return 'NO HAY REGISTRO';
  }
  
  if (parts.length === 1) {
    return 'REGISTRO INCOMPLETO';
  }

  const timeRegex = /(\d{1,2}):(\d{2})/;
  
  const inMatch = parts[0].match(timeRegex);
  const outMatch = parts[parts.length - 1].match(timeRegex);

  if (!inMatch || !outMatch) {
    return 'REGISTRO INCOMPLETO';
  }

  const inDate = new Date();
  inDate.setHours(parseInt(inMatch[1], 10), parseInt(inMatch[2], 10), 0, 0);
  
  const outDate = new Date();
  outDate.setHours(parseInt(outMatch[1], 10), parseInt(outMatch[2], 10), 0, 0);

  if (outDate <= inDate) {
    return 'REGISTRO INCOMPLETO';
  }

  const diffMillis = outDate.getTime() - inDate.getTime();
  const diffHours = diffMillis / (1000 * 60 * 60);

  return parseFloat(diffHours.toFixed(2));
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
      const name = nameIndex !== -1 && (nameIndex + 1 < row.length) ? row[nameIndex + 1] : null;
      const department = deptIndex !== -1 && (deptIndex + 2 < row.length) ? row[deptIndex + 2] : null;
      
      const dateRow = nextRow || [];

      const dayRecords: { [key: string]: any } = {};
      let totalHours = 0;
      let registeredDaysCount = 0;
      let daysWithInsufficientHours = 0;
      let daysWithSufficientHours = 0;

      days.forEach((day, index) => {
        const dateKey = `${day}-${config.month}-${config.year}`;
        const hoursKey = `Horas-${day}`;
        const value = dateRow[index];
        const hours = calculateHours(value);

        dayRecords[dateKey] = (value !== null && value !== undefined) ? value : "";
        dayRecords[hoursKey] = hours;

        if (typeof hours === 'number') {
            totalHours += hours;
            registeredDaysCount++;
            if (hours < 7.75) {
                daysWithInsufficientHours++;
            } else {
                daysWithSufficientHours++;
            }
        } else if (hours === 'REGISTRO INCOMPLETO') {
          daysWithInsufficientHours++;
        }
      });

      const averageHours = registeredDaysCount > 0 ? parseFloat((totalHours / registeredDaysCount).toFixed(2)) : 0;
      
      if (id || name) {
          records.push({
            'ID': id,
            'Nombre': name,
            'Departamento': department,
            ...dayRecords,
            'Horas/Día': averageHours,
            'Días Cumplidos': daysWithSufficientHours,
            'Días Incumplidos': daysWithInsufficientHours,
          });
      }

      i += 1;
    }
  }

  return records;
}
