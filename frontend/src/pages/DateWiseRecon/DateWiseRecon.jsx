import React, { useState, useEffect, useCallback } from 'react';
import DateWiseReconService from '../../services/recon/DateWiseReconService';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import './DateWiseRecon.scss';

export const DateWiseRecon = () => {
  // Default range: 30 days ago to today 23:59:59
  const getDefaultDateRange = () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days to cover August seed data
    const pad = (n) => String(n).padStart(2, '0');

    const pastStr = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}T00:00:01`;
    const nowStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T23:59:59`;
    return { from: pastStr, to: nowStr };
  };

  const defaultRange = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);
  const [plazaId, setPlazaId] = useState('');

  // Data State
  const [records, setRecords] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Validate date range
  const validateDates = (start, end) => {
    if (!start || !end) {
      setErrorMsg('Both From Date and To Date are required.');
      return false;
    }
    const fromTime = new Date(start).getTime();
    const toTime = new Date(end).getTime();

    if (fromTime > toTime) {
      setErrorMsg('From Date cannot be later than To Date.');
      return false;
    }

    setErrorMsg('');
    return true;
  };

  // Search from real database
  const handleSearch = useCallback(async (overrideFrom, overrideTo, overridePlaza) => {
    const fDate = overrideFrom !== undefined ? overrideFrom : fromDate;
    const tDate = overrideTo !== undefined ? overrideTo : toDate;
    const pId = overridePlaza !== undefined ? overridePlaza : plazaId;

    if (!validateDates(fDate, tDate)) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const data = await DateWiseReconService.searchDateWiseRecon({
        fromDate: fDate,
        toDate: tDate,
        plazaId: pId
      });

      setRecords(data || []);
      // Expand all by default if there are few records so user sees the drilldown immediately
      if (Array.isArray(data) && data.length <= 10) {
        const initialExpanded = {};
        data.forEach((r) => {
          initialExpanded[r.rowId] = true;
        });
        setExpandedRows(initialExpanded);
      }
    } catch (err) {
      console.error('[DateWiseRecon] Search failed:', err);
      const msg = err?.response?.data?.error || err?.message || 'Failed to query date wise reconciliation';
      setErrorMsg(msg);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, plazaId]);

  const handleReset = () => {
    const def = getDefaultDateRange();
    setFromDate(def.from);
    setToDate(def.to);
    setPlazaId('');
    setErrorMsg('');
    handleSearch(def.from, def.to, '');
  };

  // Initial load
  useEffect(() => {
    handleSearch();
  }, [handleSearch]);

  // Toggle row expansion
  const toggleRow = (rowId) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowId]: !prev[rowId]
    }));
  };

  // Toggle all rows
  const toggleAll = () => {
    const allExpanded = records.length > 0 && records.every((r) => expandedRows[r.rowId]);
    const nextState = {};
    if (!allExpanded) {
      records.forEach((r) => {
        nextState[r.rowId] = true;
      });
    }
    setExpandedRows(nextState);
  };

  // Helper: XML string escape for Excel SpreadsheetML
  const escapeXml = (unsafe) => {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  // Helper: CSV cell escape
  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Generate Excel XML Spreadsheet matching Image 1 (Two-tier parent-child hierarchy & total row)
  const buildExcelXml = (items, fromStr, toStr, totalCount, totalAmount) => {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>Paysonic Operations</Author>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="sTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#00186B"/>
  </Style>
  <Style ss:ID="sSubtitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#6B7280"/>
  </Style>
  <Style ss:ID="sGreenBar">
   <Interior ss:Color="#10B981" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sMainHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#00186B"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#00186B"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#00186B"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#00186B"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#002060" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sParentGroup">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#00186B"/>
   <Interior ss:Color="#E8F0FE" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sParentGroupCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#00186B"/>
   <Interior ss:Color="#E8F0FE" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sParentGroupAmt">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#00186B"/>
   <Interior ss:Color="#E8F0FE" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
  <Style ss:ID="sSubHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0B4EA2"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0B4EA2"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0B4EA2"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0B4EA2"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0B4EA2" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sDataText">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#111827"/>
  </Style>
  <Style ss:ID="sDataCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#111827"/>
  </Style>
  <Style ss:ID="sDataSettlementDate">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#C2410C"/>
  </Style>
  <Style ss:ID="sDataAmt">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#111827"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
  <Style ss:ID="sTotalRow">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9CA3AF"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#4B5563"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#000000"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sTotalCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9CA3AF"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#4B5563"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#000000"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sTotalAmt">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9CA3AF"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#4B5563"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#000000"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Date Wise Recon">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="90"/>
   <Column ss:Width="200"/>
   <Column ss:Width="110"/>
   <Column ss:Width="120"/>
   <Column ss:Width="90"/>
   <Column ss:Width="120"/>

   <!-- Row 1: Title -->
   <Row ss:Height="30">
    <Cell ss:MergeAcross="5" ss:StyleID="sTitle"><Data ss:Type="String">DATE WISE RECONCILIATION REPORT</Data></Cell>
   </Row>

   <!-- Row 2: Subtitle -->
   <Row ss:Height="20">
    <Cell ss:MergeAcross="5" ss:StyleID="sSubtitle"><Data ss:Type="String">From Date: ${escapeXml(fromStr)}   |   To Date: ${escapeXml(toStr)}</Data></Cell>
   </Row>

   <!-- Row 3: Green Accent Stripe -->
   <Row ss:Height="4">
    <Cell ss:StyleID="sGreenBar"/>
    <Cell ss:StyleID="sGreenBar"/>
    <Cell ss:StyleID="sGreenBar"/>
    <Cell ss:StyleID="sGreenBar"/>
    <Cell ss:StyleID="sGreenBar"/>
    <Cell ss:StyleID="sGreenBar"/>
   </Row>

   <!-- Row 4: Main Table Header Row -->
   <Row ss:Height="24">
    <Cell ss:StyleID="sMainHeader"><Data ss:Type="String">Plaza ID</Data></Cell>
    <Cell ss:StyleID="sMainHeader"><Data ss:Type="String">Plaza Name</Data></Cell>
    <Cell ss:StyleID="sMainHeader"><Data ss:Type="String">Txn Date</Data></Cell>
    <Cell ss:StyleID="sMainHeader"><Data ss:Type="String">Settlement Date</Data></Cell>
    <Cell ss:StyleID="sMainHeader"><Data ss:Type="String">Txn Count</Data></Cell>
    <Cell ss:StyleID="sMainHeader"><Data ss:Type="String">Settled Amount</Data></Cell>
   </Row>
`;

    items.forEach((summary) => {
      // 1. Parent Summary Group Row (Image 1 Level 1)
      xml += `
   <Row ss:Height="24">
    <Cell ss:StyleID="sParentGroupCenter"><Data ss:Type="String">${escapeXml(summary.plazaId)}</Data></Cell>
    <Cell ss:StyleID="sParentGroup"><Data ss:Type="String">${escapeXml(summary.plazaName)}</Data></Cell>
    <Cell ss:StyleID="sParentGroupCenter"><Data ss:Type="String">${escapeXml(formatDate(summary.txnDate))}</Data></Cell>
    <Cell ss:StyleID="sParentGroupCenter"><Data ss:Type="String">—</Data></Cell>
    <Cell ss:StyleID="sParentGroupCenter"><Data ss:Type="Number">${summary.txnCount || 0}</Data></Cell>
    <Cell ss:StyleID="sParentGroupAmt"><Data ss:Type="Number">${Number(summary.settledAmount || 0).toFixed(2)}</Data></Cell>
   </Row>

   <!-- Child Breakdown Sub-Header Row (Image 1 Subtable) -->
   <Row ss:Height="20">
    <Cell ss:StyleID="sSubHeader"><Data ss:Type="String">PLAZA ID</Data></Cell>
    <Cell ss:StyleID="sSubHeader"><Data ss:Type="String">PLAZA NAME</Data></Cell>
    <Cell ss:StyleID="sSubHeader"><Data ss:Type="String">TXN DATE</Data></Cell>
    <Cell ss:StyleID="sSubHeader"><Data ss:Type="String">SETTLEMENT DATE</Data></Cell>
    <Cell ss:StyleID="sSubHeader"><Data ss:Type="String">TXN COUNT</Data></Cell>
    <Cell ss:StyleID="sSubHeader"><Data ss:Type="String">SETTLED AMOUNT</Data></Cell>
   </Row>
`;

      // 2. Child Breakdown Rows
      if (summary.breakdowns && summary.breakdowns.length > 0) {
        summary.breakdowns.forEach((b) => {
          xml += `
   <Row ss:Height="20">
    <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${escapeXml(summary.plazaId)}</Data></Cell>
    <Cell ss:StyleID="sDataText"><Data ss:Type="String">${escapeXml(summary.plazaName)}</Data></Cell>
    <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${escapeXml(formatDate(summary.txnDate))}</Data></Cell>
    <Cell ss:StyleID="sDataSettlementDate"><Data ss:Type="String">${escapeXml(formatDate(b.settlementDate))}</Data></Cell>
    <Cell ss:StyleID="sDataCenter"><Data ss:Type="Number">${b.txnCount || 0}</Data></Cell>
    <Cell ss:StyleID="sDataAmt"><Data ss:Type="Number">${Number(b.settledAmount || 0).toFixed(2)}</Data></Cell>
   </Row>
`;
        });
      } else {
        xml += `
   <Row ss:Height="20">
    <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${escapeXml(summary.plazaId)}</Data></Cell>
    <Cell ss:StyleID="sDataText"><Data ss:Type="String">${escapeXml(summary.plazaName)}</Data></Cell>
    <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${escapeXml(formatDate(summary.txnDate))}</Data></Cell>
    <Cell ss:StyleID="sDataSettlementDate"><Data ss:Type="String">-</Data></Cell>
    <Cell ss:StyleID="sDataCenter"><Data ss:Type="Number">${summary.txnCount || 0}</Data></Cell>
    <Cell ss:StyleID="sDataAmt"><Data ss:Type="Number">${Number(summary.settledAmount || 0).toFixed(2)}</Data></Cell>
   </Row>
`;
      }
    });

    // 3. Grand Total Summary Row
    xml += `
   <Row ss:Height="24">
    <Cell ss:StyleID="sTotalRow"><Data ss:Type="String">Total</Data></Cell>
    <Cell ss:StyleID="sTotalRow"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="sTotalRow"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="sTotalRow"><Data ss:Type="String"></Data></Cell>
    <Cell ss:StyleID="sTotalCenter"><Data ss:Type="Number">${totalCount}</Data></Cell>
    <Cell ss:StyleID="sTotalAmt"><Data ss:Type="Number">${Number(totalAmount).toFixed(2)}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;

    return xml;
  };

  // Export Excel directly matching exact hierarchical structure displayed on screen (Image 1)
  const handleExportExcel = async () => {
    if (!validateDates(fromDate, toDate)) return;
    if (!records || records.length === 0) {
      setErrorMsg('No reconciliation records to export.');
      return;
    }

    setExporting(true);
    try {
      // Record audit activity
      try {
        const session = JSON.parse(localStorage.getItem('paysonic_auth_session') || '{}');
        UserActivityService.recordAuditEvent({
          module: 'Recon Management',
          action: 'EXPORT_DATE_WISE_RECON',
          actionLabel: 'Exported Date Wise Recon Report (Excel)',
          status: 'SUCCESS',
          target: 'Date Wise Recon',
          details: `Exported Date Wise Recon report range: ${fromDate} to ${toDate}`,
          actor: session.name ? { id: session.id, name: session.name, role: session.role } : undefined
        });
      } catch (e) {
        console.warn('[DateWiseRecon] Audit logging failed:', e);
      }

      const fromStr = fromDate ? fromDate.replace('T', ' ') : '01-08-2026 00:00:00';
      const toStr = toDate ? toDate.replace('T', ' ') : '31-10-2026 23:59:59';

      const xml = buildExcelXml(records, fromStr, toStr, grandTotalCount, grandTotalAmount);
      const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      link.setAttribute('download', `Date_Wise_Recon_${timestamp}.xls`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[DateWiseRecon] Export failed:', err);
      setErrorMsg('Export Error: ' + (err?.message || 'Failed to export Excel'));
    } finally {
      setExporting(false);
    }
  };

  // Export CSV matching exact hierarchical structure displayed on screen (Image 1)
  const handleExportCsv = () => {
    if (!records || records.length === 0) return;

    const headers = ['Plaza ID', 'Plaza Name', 'Txn Date', 'Settlement Date', 'Txn Count', 'Settled Amount'];

    const fromStr = fromDate ? fromDate.replace('T', ' ') : '01-08-2026 00:00:00';
    const toStr = toDate ? toDate.replace('T', ' ') : '31-10-2026 23:59:59';

    const rows = [];
    // Banner & Date subtitle
    rows.push(['DATE WISE RECONCILIATION REPORT', '', '', '', '', '']);
    rows.push([`From Date: ${fromStr}   |   To Date: ${toStr}`, '', '', '', '', '']);
    rows.push(['', '', '', '', '', '']);

    // Main header
    rows.push(headers);

    records.forEach((r) => {
      // 1. Parent Summary Row (Level 1 in Image 1)
      rows.push([
        r.plazaId || '',
        r.plazaName || '',
        formatDate(r.txnDate),
        '—',
        r.txnCount || 0,
        (Number(r.settledAmount) || 0).toFixed(2)
      ]);

      // 2. Child Breakdown Sub-Header Row (Subtable header in Image 1)
      rows.push([
        'PLAZA ID',
        'PLAZA NAME',
        'TXN DATE',
        'SETTLEMENT DATE',
        'TXN COUNT',
        'SETTLED AMOUNT'
      ]);

      // 3. Child Breakdown Rows
      if (r.breakdowns && r.breakdowns.length > 0) {
        r.breakdowns.forEach((b) => {
          rows.push([
            r.plazaId || '',
            r.plazaName || '',
            formatDate(r.txnDate),
            formatDate(b.settlementDate),
            b.txnCount || 0,
            (Number(b.settledAmount) || 0).toFixed(2)
          ]);
        });
      } else {
        rows.push([
          r.plazaId || '',
          r.plazaName || '',
          formatDate(r.txnDate),
          '-',
          r.txnCount || 0,
          (Number(r.settledAmount) || 0).toFixed(2)
        ]);
      }
    });

    // Summary Total Row (Matching tfoot in Image 1)
    rows.push(['Total', '', '', '', grandTotalCount, grandTotalAmount.toFixed(2)]);

    const csvContent = '\uFEFF' + rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    link.setAttribute('download', `Date_Wise_Recon_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Date formatter (DD-MM-YYYY)
  const formatDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return dateVal;
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    } catch {
      return dateVal;
    }
  };

  // Currency formatter
  const formatCurrency = (amt) => {
    if (amt === null || amt === undefined) return '₹0.00';
    const num = Number(amt);
    if (isNaN(num)) return amt;
    return `₹${num.toFixed(2)}`;
  };

  // Calculate grand totals
  const grandTotalCount = records.reduce((acc, curr) => acc + (Number(curr.txnCount) || 0), 0);
  const grandTotalAmount = records.reduce((acc, curr) => acc + (Number(curr.settledAmount) || 0), 0);

  return (
    <div className="date-recon-page">
      <h2 className="page-title">Date Wise Reconciliation Report</h2>

      {/* Filter Card */}
      <div className="filter-box">
        <div className="filter-row">
          <div className="input-group">
            <label htmlFor="dwrFromDate">
              From Date <span className="req">*</span>
            </label>
            <input
              id="dwrFromDate"
              type="datetime-local"
              step="1"
              className="form-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label htmlFor="dwrToDate">
              To Date <span className="req">*</span>
            </label>
            <input
              id="dwrToDate"
              type="datetime-local"
              step="1"
              className="form-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label htmlFor="dwrPlaza">Plaza (Optional)</label>
            <input
              id="dwrPlaza"
              type="text"
              placeholder="e.g. 600601, Dummytollplaza1"
              className="form-input"
              value={plazaId}
              onChange={(e) => setPlazaId(e.target.value)}
            />
          </div>

          <div className="btn-group">
            <button
              type="button"
              className="btn-royal-blue"
              onClick={handleSearch}
              disabled={loading}
              id="dwrSearchBtn"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleReset}
              disabled={loading}
              id="dwrResetBtn"
            >
              Reset
            </button>

            <button
              type="button"
              className="btn-royal-blue"
              onClick={handleExportExcel}
              disabled={exporting || loading || records.length === 0}
              id="dwrExportBtn"
            >
              {exporting ? 'Exporting...' : 'Export Excel'}
            </button>

            <button
              type="button"
              className="btn-royal-blue"
              onClick={handleExportCsv}
              disabled={loading || records.length === 0}
              id="dwrExportCsvBtn"
            >
              Export CSV
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="error-banner">
            <span>⚠️</span> {errorMsg}
          </div>
        )}
      </div>

      {/* Summary KPI Cards / Mini Dashboard */}
      <ReportKpiGrid
        cards={[
          {
            label: 'Total Recon Groups',
            value: records.length,
            sub: 'Filtered Dates & Plazas'
          },
          {
            label: 'Total Settled Transactions',
            value: grandTotalCount.toLocaleString('en-IN'),
            sub: 'Consolidated Txn Count',
            highlight: 'blue'
          },
          {
            label: 'Total Settlement Amount',
            value: formatCurrency(grandTotalAmount),
            sub: 'Gross Remitted Funds',
            highlight: 'purple'
          },
          {
            label: 'Live Railway DB',
            value: 'ONLINE',
            sub: 'date_wise_recon',
            isBadge: true
          }
        ]}
      />

      {/* Hierarchical Two-Tier Table */}
      <div className="table-card">
        <div className="table-top-bar">
          <div>
            Showing <strong>{records.length}</strong> date reconciliation groups (Grand Total: <strong>{grandTotalCount}</strong> transactions, <strong>{formatCurrency(grandTotalAmount)}</strong> settled)
          </div>

          {records.length > 0 && (
            <button type="button" className="expand-all-btn" onClick={toggleAll}>
              {records.every((r) => expandedRows[r.rowId]) ? 'Collapse All −' : 'Expand All +'}
            </button>
          )}
        </div>

        <div className="table-scroll">
          {loading ? (
            <div className="loading-msg">
              <div className="spinner"></div>
              <p>Aggregating date reconciliation data from database...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="empty-msg">
              <h4>No Reconciliation Records Found</h4>
              <p>No settled transactions found for the selected date range.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th className="col-toggle"></th>
                  <th>Plaza ID</th>
                  <th>Plaza Name</th>
                  <th>Txn Date</th>
                  <th className="text-right">Txn Count</th>
                  <th className="text-right">Settled Amount</th>
                </tr>
              </thead>
              <tbody>
                {records.map((summary) => {
                  const isExpanded = Boolean(expandedRows[summary.rowId]);

                  return (
                    <React.Fragment key={summary.rowId}>
                      {/* Parent / Collapsed Summary Row */}
                      <tr className={`parent-row ${isExpanded ? 'is-expanded' : ''}`}>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn-toggle"
                            onClick={() => toggleRow(summary.rowId)}
                            title={isExpanded ? 'Collapse breakdown' : 'Expand settlement dates'}
                          >
                            {isExpanded ? '−' : '+'}
                          </button>
                        </td>
                        <td>{summary.plazaId}</td>
                        <td style={{ fontWeight: 600 }}>{summary.plazaName}</td>
                        <td>{formatDate(summary.txnDate)}</td>
                        <td className="text-right" style={{ fontWeight: 600 }}>
                          {summary.txnCount}
                        </td>
                        <td className="text-right amt-val">
                          {formatCurrency(summary.settledAmount)}
                        </td>
                      </tr>

                      {/* Expanded Child Breakdown Sub-Table */}
                      {isExpanded && (
                        <tr className="child-container-row">
                          <td colSpan="6">
                            <div className="child-table-wrapper">
                              <table className="child-table">
                                <thead>
                                  <tr>
                                    <th>Plaza ID</th>
                                    <th>Plaza Name</th>
                                    <th>Txn Date</th>
                                    <th>Settlement Date</th>
                                    <th className="text-right">Txn Count</th>
                                    <th className="text-right">Settled Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {summary.breakdowns && summary.breakdowns.length > 0 ? (
                                    summary.breakdowns.map((b, idx) => (
                                      <tr key={idx}>
                                        <td>{summary.plazaId}</td>
                                        <td>{summary.plazaName}</td>
                                        <td>{formatDate(summary.txnDate)}</td>
                                        <td className="settlement-date-cell" style={{ fontWeight: 600 }}>
                                          {formatDate(b.settlementDate)}
                                        </td>
                                        <td className="text-right">{b.txnCount}</td>
                                        <td className="text-right" style={{ fontWeight: 600 }}>
                                          {formatCurrency(b.settledAmount)}
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan="6" style={{ textAlign: 'center', color: '#9ca3af' }}>
                                        No settlement date breakdown available.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td></td>
                  <td colSpan="3">Total</td>
                  <td className="text-right">{grandTotalCount}</td>
                  <td className="text-right">{formatCurrency(grandTotalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default DateWiseRecon;
