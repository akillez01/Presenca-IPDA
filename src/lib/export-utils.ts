import type { AttendanceRecord } from '@/lib/types';

export function exportToCSV(data: AttendanceRecord[], filename: string = 'relatorio-presenca') {
  const headers = [
    'Nome Completo',
    'CPF',
    'Reclassificação',
    'Nome do Pastor',
    'Região',
    'Cargo na Igreja',
    'Cidade',
    'Presente',
    'Justificado',
  ];

  const csvRows = [headers.join(','), ...data.map(row => [
    row.fullName,
    row.cpf,
    row.reclassification || '',
    row.pastorName || '',
    row.region || '',
    row.churchPosition || '',
    row.city || '',
    row.status === 'Presente' ? 'Sim' : '',
    row.status === 'Justificado' ? 'Sim' : ''
  ].map(cell => `"${cell}"`).join(','))];

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportReportSummaryToCSV(
  summary: {
    total: number;
    present: number;
    justified: number;
    absent: number;
    attendanceRate: number;
  },
  byShift: Record<string, number>,
  byRegion: Record<string, number>,
  byPosition: Record<string, number>,
  filename: string = 'resumo-relatorio',
  cargosResumo?: { Cargo: string, Presentes: number, Justificados: number }[]
) {

  // RESUMO GERAL
  const resumoGeralHeader = ['Total de Registros', 'Presentes', 'Justificados', 'Ausentes', 'Taxa de Presença (%)'];
  const resumoGeralData = [
    summary.total,
    summary.present,
    summary.justified,
    summary.absent,
    summary.attendanceRate
  ];

  // POR TURNO
  const turnoHeader = Object.keys(byShift);
  const turnoData = Object.values(byShift);

  // POR REGIÃO
  const regiaoHeader = Object.keys(byRegion);
  const regiaoData = Object.values(byRegion);

  // POR CARGO
  const cargoHeader = Object.keys(byPosition);
  const cargoData = Object.values(byPosition);

  const data = [
    ['RESUMO GERAL'],
    resumoGeralHeader,
    resumoGeralData,
    [''],
    ['POR TURNO'],
    turnoHeader,
    turnoData,
    [''],
    ['POR REGIÃO'],
    regiaoHeader,
    regiaoData,
    [''],
    ['POR CARGO'],
    cargoHeader,
    cargoData
  ];

  if (cargosResumo && cargosResumo.length > 0) {
    data.push(['']);
    data.push(['PRESENTES E JUSTIFICADOS POR CARGO']);
    data.push(['Cargo', 'Presentes', 'Justificados']);
    cargosResumo.forEach(row => {
      data.push([
        String(row.Cargo),
        String(row.Presentes),
        String(row.Justificados)
      ]);
    });
  }

  const csvContent = data.map(row => row.join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export function printReport(reportData: any) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const printContent = `
    <div>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 20px; 
          color: #333;
        }
        .header { 
          text-align: center; 
          border-bottom: 2px solid #333; 
          padding-bottom: 20px; 
          margin-bottom: 30px;
        }
        .summary { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
          gap: 20px; 
          margin-bottom: 30px;
        }
        .summary-item { 
          border: 1px solid #ddd; 
          padding: 15px; 
          border-radius: 8px;
          text-align: center;
        }
        .summary-number { 
          font-size: 2em; 
          font-weight: bold; 
          color: #2563eb;
        }
        .section { 
          margin-bottom: 30px; 
        }
        .section h3 { 
          border-bottom: 1px solid #ddd; 
          padding-bottom: 10px;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 10px;
        }
        th, td { 
          border: 1px solid #ddd; 
          padding: 12px; 
          text-align: left;
        }
        th { 
          background-color: #f5f5f5; 
          font-weight: bold;
        }
        .footer {
          margin-top: 50px;
          text-align: center;
          font-size: 0.9em;
          color: #666;
        }
        @media print {
          .no-print { display: none; }
        }
      </style>
      <div class="header">
        <h1>Relatório de Presença</h1>
        <h2>Igreja Pentecostal Deus é Amor (IPDA)</h2>
        <p>Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
      </div>

      <div class="summary">
        <div class="summary-item">
          <div class="summary-number">${reportData?.summary?.total || 0}</div>
          <div>Total de Registros</div>
        </div>
        <div class="summary-item">
          <div class="summary-number">${reportData?.summary?.present || 0}</div>
          <div>Presentes</div>
        </div>
        <div class="summary-item">
          <div class="summary-number">${reportData?.summary?.justified || 0}</div>
          <div>Justificados</div>
        </div>
        <div class="summary-item">
          <div class="summary-number">${reportData?.summary?.absent || 0}</div>
          <div>Ausentes</div>
        </div>
        <div class="summary-item">
          <div class="summary-number">${reportData?.summary?.attendanceRate || 0}%</div>
          <div>Taxa de Presença</div>
        </div>
      </div>

      <div class="section">
        <h3>Distribuição por Turno</h3>
        <table>
          <thead>
            <tr><th>Turno</th><th>Presenças</th></tr>
          </thead>
          <tbody>
            ${Object.entries(reportData?.byShift || {}).map(([key, value]) => 
              `<tr><td>${key}</td><td>${value}</td></tr>`
            ).join('')}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h3>Distribuição por Região</h3>
        <table>
          <thead>
            <tr><th>Região</th><th>Presenças</th></tr>
          </thead>
          <tbody>
            ${Object.entries(reportData?.byRegion || {}).map(([key, value]) => 
              `<tr><td>${key}</td><td>${value}</td></tr>`
            ).join('')}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <p>Sistema de Presença IPDA - Relatório gerado automaticamente</p>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(printContent);
  printWindow.document.close();
  printWindow.print();
}
