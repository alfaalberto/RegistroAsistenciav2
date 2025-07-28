export function exportToCsv(data: Record<string, any>[], filename: string) {
  if (!data || data.length === 0) {
    return;
  }

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','), 
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        const stringValue = (value === null || value === undefined) ? '' : String(value);
        // Escape commas and quotes
        if (stringValue.includes(',') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ];

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
