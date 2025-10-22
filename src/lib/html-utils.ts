function getCellClass(header: string, value: any): string {
    // Prioritize column-specific styling
    if (header === 'Días Cumplidos') {
        return 'dias-cumplidos';
    }
    if (header === 'Días Incumplidos') {
        return 'dias-incumplidos';
    }

    // Then apply generic value-based styling
    if (typeof value === 'string') {
        if (value === 'NO HAY REGISTRO') return 'no-registro';
        if (value === 'REGISTRO INCOMPLETO') return 'registro-incompleto';
    }
    if (typeof value === 'number' && value < 7.75) {
        return 'horas-insuficientes';
    }
    if (typeof value === 'number' && value >= 7.75) {
        return 'horas-normales';
    }
    return '';
}

function getStyles(): string {
    return `
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #111827;
            color: #F9FAFB;
            margin: 0;
            padding: 2rem;
        }
        h1 {
            color: #E5E7EB;
            text-align: center;
            margin-bottom: 2rem;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background-color: #1F2937;
            border-radius: 0.5rem;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        }
        th, td {
            padding: 0.75rem 1rem;
            text-align: left;
            border-bottom: 1px solid #374151;
        }
        thead th {
            background-color: #374151;
            color: #E5E7EB;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        tbody tr:hover {
            background-color: #374151;
        }
        td {
           color: #D1D5DB;
        }
        .no-registro, .registro-incompleto {
            font-weight: 600;
            padding: 0.25rem 0.5rem;
            border-radius: 9999px;
            display: inline-block;
            font-size: 0.75rem;
        }
        .no-registro {
            background-color: #991B1B; /* bg-red-800 */
            color: #FEE2E2; /* text-red-100 */
        }
        .registro-incompleto {
            background-color: #9A3412; /* bg-orange-800 */
            color: #FFEDD5; /* text-orange-100 */
        }
        .horas-insuficientes {
            color: #FB923C; /* text-orange-400 */
            font-weight: 600;
        }
        .horas-normales {
            color: #4ADE80; /* text-green-400 */
        }
        .dias-cumplidos {
            background-color: rgba(34, 197, 94, 0.15); /* green-500 @ 15% */
            color: #22C55E; /* text-green-500 */
            font-weight: 700;
            padding: 0.25rem 0.5rem;
            border-radius: 0.375rem; /* rounded-md */
        }
        .dias-incumplidos {
            background-color: rgba(239, 68, 68, 0.15); /* red-500 @ 15% */
            color: #EF4444; /* text-red-500 */
            font-weight: 700;
            padding: 0.25rem 0.5rem;
            border-radius: 0.375rem; /* rounded-md */
        }
        .check-icon {
            color: #22C55E; /* text-green-500 */
            display: inline-block;
            vertical-align: middle;
            margin-right: 0.25rem;
        }
        .cross-icon {
             color: #EF4444; /* text-red-500 */
             display: inline-block;
             vertical-align: middle;
             margin-right: 0.25rem;
        }
    `;
}

function formatCellContent(value: any): string {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);

    if (stringValue.includes('\n')) {
        const parts = stringValue.split('\n');
        return `
            <div>
                <span class="check-icon">✔</span>${parts[0]}
            </div>
            <div>
                <span class="cross-icon">✔</span>${parts[1]}
            </div>
        `;
    }
    
    return stringValue;
}

export function exportToHtml(data: Record<string, any>[], filename: string) {
    if (!data || data.length === 0) {
        return;
    }

    const headers = Object.keys(data[0]);

    const tableRows = data.map(row => {
        const tableCells = headers.map(header => {
            const cellValue = row[header];
            const cellClass = getCellClass(header, cellValue);
            const formattedContent = formatCellContent(cellValue);
            return `<td class="${cellClass}">${formattedContent}</td>`;
        }).join('');
        return `<tr>${tableCells}</tr>`;
    }).join('');

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${filename}</title>
            <style>${getStyles()}</style>
        </head>
        <body>
            <h1>Extracted Attendance Data</h1>
            <table>
                <thead>
                    <tr>
                        ${headers.map(h => `<th>${h}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
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
