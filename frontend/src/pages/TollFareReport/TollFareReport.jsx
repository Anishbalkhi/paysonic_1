import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TollFareReportService from '../../services/tollFare/TollFareReportService';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import './TollFareReport.scss';

export const TollFareReport = () => {
  const [plazaId, setPlazaId] = useState('600601');
  const [vehicleClass, setVehicleClass] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Live Database Data State
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Search fares from Railway DB
  const handleSearch = useCallback(async (overridePlaza, overrideClass) => {
    const pId = overridePlaza !== undefined ? overridePlaza : plazaId;
    const vClass = overrideClass !== undefined ? overrideClass : vehicleClass;

    setLoading(true);
    setErrorMsg('');
    try {
      const data = await TollFareReportService.searchTollFares({
        plazaId: pId,
        vehicleClass: vClass
      });
      const content = Array.isArray(data) ? data : [];
      setRecords(content);
    } catch (err) {
      console.error('[TollFareReport] Search failed:', err);
      const msg = err?.response?.data?.error || err?.message || 'Database error loading toll fares';
      setErrorMsg(msg);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [plazaId, vehicleClass]);

  useEffect(() => {
    handleSearch();
  }, [handleSearch]);

  const handleReset = () => {
    setPlazaId('600601');
    setVehicleClass('ALL');
    setSearchTerm('');
    handleSearch('600601', 'ALL');
  };

  // Client-side quick search filtering
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const q = searchTerm.toLowerCase().trim();
    return records.filter((r) =>
      (r.tollPlazaId && String(r.tollPlazaId).toLowerCase().includes(q)) ||
      (r.vehicleClass && r.vehicleClass.toLowerCase().includes(q)) ||
      (r.vehicleDesc && r.vehicleDesc.toLowerCase().includes(q)) ||
      (r.singleJourney && String(r.singleJourney).includes(q)) ||
      (r.returnJourney && String(r.returnJourney).includes(q))
    );
  }, [records, searchTerm]);

  // Bottom Summary KPI metrics
  const { minSingle, maxSingle, minReturn, maxReturn, maxMonthly } = useMemo(() => {
    if (filteredRecords.length === 0) {
      return { minSingle: '0.00', maxSingle: '0.00', minReturn: '0.00', maxReturn: '0.00', maxMonthly: '0.00' };
    }
    const singleArr = filteredRecords.map((r) => Number(r.singleJourney) || 0);
    const returnArr = filteredRecords.map((r) => Number(r.returnJourney) || 0);
    const monthlyArr = filteredRecords.map((r) => Math.max(Number(r.monthly50Trips) || 0, Number(r.monthlyLocalUnder20km) || 0));

    return {
      minSingle: Math.min(...singleArr).toFixed(2),
      maxSingle: Math.max(...singleArr).toFixed(2),
      minReturn: Math.min(...returnArr).toFixed(2),
      maxReturn: Math.max(...returnArr).toFixed(2),
      maxMonthly: Math.max(...monthlyArr).toFixed(2)
    };
  }, [filteredRecords]);

  // Export Excel
  const handleExportExcel = async () => {
    if (exportingExcel || exportingCsv || filteredRecords.length === 0) return;
    setExportingExcel(true);
    try {
      await TollFareReportService.exportExcel({
        plazaId,
        vehicleClass
      });
    } catch (err) {
      console.error('[TollFareReport] Export Excel error:', err);
      alert('Failed to export Excel.');
    } finally {
      setExportingExcel(false);
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    if (exportingExcel || exportingCsv || filteredRecords.length === 0) return;
    setExportingCsv(true);
    try {
      await TollFareReportService.exportCsv({
        plazaId,
        vehicleClass
      });
    } catch (err) {
      console.error('[TollFareReport] Export CSV error:', err);
      alert('Failed to export CSV.');
    } finally {
      setExportingCsv(false);
    }
  };

  const formatAmount = (amt) => {
    if (amt === null || amt === undefined) return '0.00';
    const num = Number(amt);
    return isNaN(num) ? String(amt) : num.toFixed(2);
  };

  const fareKpis = useMemo(() => {
    if (!filteredRecords.length) return { avgSingle: '0.00', avgReturn: '0.00', totalClasses: 0 };
    const totalSingle = filteredRecords.reduce((sum, r) => sum + Number(r.singleJourneyFare || r.singleFare || 0), 0);
    const totalReturn = filteredRecords.reduce((sum, r) => sum + Number(r.returnJourneyFare || r.returnFare || 0), 0);
    return {
      totalClasses: filteredRecords.length,
      avgSingle: (totalSingle / filteredRecords.length).toFixed(2),
      avgReturn: (totalReturn / filteredRecords.length).toFixed(2)
    };
  }, [filteredRecords]);

  return (
    <div className="toll-fare-page">
      {/* Top Header */}
      <header className="page-header">
        <div className="header-titles">
          <h1 className="page-title">Toll Fare Report</h1>
          <p className="subtitle">
            Plaza Toll Fare Matrix &amp; Vehicle Class Rate Configurations (Live Railway DB)
          </p>
        </div>
      </header>

      {/* Filter Card */}
      <div className="fare-filter-box">
        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="plazaSelect">
              Toll Plaza <span className="req">*</span>
            </label>
            <select
              id="plazaSelect"
              className="select-input"
              value={plazaId}
              onChange={(e) => setPlazaId(e.target.value)}
            >
              <option value="ALL">All Plazas</option>
              <option value="501101">MUMBAI PLAZA NH-04 (501101)</option>
              <option value="502202">PUNE BYPASS PLAZA (502202)</option>
              <option value="600601">Dummytollplaza1 (600601)</option>
              <option value="600602">Dummytollplaza2 (600602)</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="vcSelect">Vehicle Class</label>
            <select
              id="vcSelect"
              className="select-input"
              value={vehicleClass}
              onChange={(e) => setVehicleClass(e.target.value)}
            >
              <option value="ALL">All Vehicle Classes</option>
              <option value="VC19">VC19 - Tractor with trailer</option>
              <option value="VC18">VC18 - Tractor</option>
              <option value="VC17">VC17 - Heavy Construction machinery</option>
              <option value="VC16">VC16 - Earth moving machinery</option>
              <option value="VC15">VC15 - Truck Multi Axle (7 and above)</option>
              <option value="VC14">VC14 - Truck 6 Axle</option>
              <option value="VC13">VC13 - Truck 5 Axle</option>
              <option value="VC12">VC12 - Truck 4 Axle</option>
              <option value="VC6">VC6 - Light Commercial Vehicle - 3 Axle</option>
              <option value="VC11">VC11 - Truck 3 Axle</option>
              <option value="VC8">VC8 - Bus 3 Axle</option>
              <option value="VC10">VC10 - Truck 2 Axle</option>
              <option value="VC7">VC7 - Bus 2 Axle</option>
              <option value="VC9">VC9 - Mini Bus</option>
              <option value="VC5">VC5 - Light Commercial Vehicle - 2 Axle</option>
              <option value="VC20">VC20 - Tata Ace or similar mini LCV</option>
              <option value="VC4">VC4 - Car / Jeep / Van</option>
            </select>
          </div>

          <div className="btn-actions">
            <button
              type="button"
              className="btn-royal-blue"
              onClick={handleExportExcel}
              disabled={exportingExcel || loading || filteredRecords.length === 0}
              id="fareExportExcelBtn"
            >
              {exportingExcel ? 'Exporting...' : 'Export Excel'}
            </button>
            <button
              type="button"
              className="btn-royal-blue"
              onClick={handleExportCsv}
              disabled={exportingCsv || loading || filteredRecords.length === 0}
              id="fareExportCsvBtn"
            >
              {exportingCsv ? 'Exporting...' : 'Export CSV'}
            </button>
            <button
              type="button"
              className="btn-royal-blue"
              onClick={handleSearch}
              disabled={loading}
              id="fareSearchBtn"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleReset}
              disabled={loading}
              id="fareResetBtn"
            >
              Reset
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
            label: 'Configured Vehicle Classes',
            value: fareKpis.totalClasses,
            sub: 'Active Toll Matrix Rates'
          },
          {
            label: 'Avg Single Journey Fare',
            value: `₹ ${fareKpis.avgSingle}`,
            sub: 'Standard Single Pass',
            highlight: 'blue'
          },
          {
            label: 'Avg Return Journey Fare',
            value: `₹ ${fareKpis.avgReturn}`,
            sub: '24-Hour Return Pass',
            highlight: 'purple'
          },
          {
            label: 'Live Railway DB',
            value: 'ONLINE',
            sub: 'toll_fare_matrix',
            isBadge: true
          }
        ]}
      />

      {/* Quick Search Bar */}
      <div className="table-controls-bar">
        <div className="table-info">
          Showing <strong>{filteredRecords.length}</strong> vehicle class fare rate{filteredRecords.length !== 1 ? 's' : ''}
        </div>
        <div className="quick-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Quick search vehicle class, desc..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button type="button" className="clear-search-btn" onClick={() => setSearchTerm('')}>
              ×
            </button>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="fare-table-container">
        {/* Top Centered Table Banner matching Image 2 */}
        <div className="table-top-banner">
          <div className="banner-title">TOLL FARE REPORT</div>
          <div className="banner-subtitle">
            Plaza: {plazaId} | Effective FASTag Toll Fare Matrix
          </div>
          <div className="banner-green-bar" />
        </div>

        <div className="table-scroll-wrapper">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Querying real toll fare matrix from Railway MySQL database...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="empty-state">
              <h4>No Toll Fares Found</h4>
              <p>There are no fare rates configured for the selected plaza and vehicle class.</p>
            </div>
          ) : (
            <table className="fare-table">
              <thead>
                <tr>
                  <th className="text-center">TollPlazaID</th>
                  <th className="text-center">Vechile Class</th>
                  <th>Vechile Desc</th>
                  <th className="text-right">Single Journey</th>
                  <th className="text-right">Return Journey</th>
                  <th className="text-right">Monthly 50-Trips</th>
                  <th className="text-right">Monthly Local - Under 10km</th>
                  <th className="text-right">Monthly Local - Under 20km</th>
                  <th className="text-right">Local Pass - Commercial Fare</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r, index) => {
                  return (
                    <tr key={r.tollPlazaId + '_' + r.vehicleClass + '_' + index}>
                      {/* 1. TollPlazaID */}
                      <td className="text-center font-bold code-font">
                        {r.tollPlazaId}
                      </td>

                      {/* 2. Vechile Class */}
                      <td className="text-center font-semibold code-font vc-cell">
                        {r.vehicleClass}
                      </td>

                      {/* 3. Vechile Desc */}
                      <td className="desc-cell">
                        {r.vehicleDesc}
                      </td>

                      {/* 4. Single Journey */}
                      <td className="text-right num-cell font-bold">
                        {formatAmount(r.singleJourney)}
                      </td>

                      {/* 5. Return Journey */}
                      <td className="text-right num-cell font-semibold">
                        {formatAmount(r.returnJourney)}
                      </td>

                      {/* 6. Monthly 50-Trips */}
                      <td className="text-right num-cell">
                        {formatAmount(r.monthly50Trips)}
                      </td>

                      {/* 7. Monthly Local - Under 10km */}
                      <td className="text-right num-cell">
                        {formatAmount(r.monthlyLocalUnder10km)}
                      </td>

                      {/* 8. Monthly Local - Under 20km */}
                      <td className="text-right num-cell font-bold" style={{ color: Number(r.monthlyLocalUnder20km) > 0 ? '#1d4ed8' : '#64748b' }}>
                        {formatAmount(r.monthlyLocalUnder20km)}
                      </td>

                      {/* 9. Local Pass - Commercial Fare */}
                      <td className="text-right num-cell">
                        {formatAmount(r.localPassCommercialFare)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 4 Bottom Summary KPI Cards matching design theme */}
        {filteredRecords.length > 0 && (
          <div className="bottom-summary-grid">
            <div className="summary-card card-green">
              Vehicle Classes: {filteredRecords.length}
            </div>
            <div className="summary-card card-blue">
              Single Fare: ₹ {minSingle} – ₹ {maxSingle}
            </div>
            <div className="summary-card card-green">
              Return Fare: ₹ {minReturn} – ₹ {maxReturn}
            </div>
            <div className="summary-card card-blue">
              Max Monthly Pass: ₹ {maxMonthly}
            </div>
          </div>
        )}

        {/* Footer Disclaimer */}
        <div className="footer-disclaimer">
          * This report generated from Paysonic Database directly on demand
        </div>
      </div>
    </div>
  );
};

export default TollFareReport;
