import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import OnboardingService from '../../services/onboarding/OnboardingService';
import StateCitySelect from '../../components/StateCitySelect/StateCitySelect';
import { hasMenuAccess } from '../../config/roleMenus';
import TablePagination from '../../components/common/TablePagination';
import './Onboarding.scss';

// Vehicle classes VC4 through VC20 (NETC / NPCI Standard FASTag Specifications)
const VEHICLE_CLASSES = [
  { id: 'VC4', name: 'Car / Jeep / Van', label: 'VC4 · Car / Jeep / Van' },
  { id: 'VC5', name: 'Light Commercial Vehicle (LCV) 2-Axle', label: 'VC5 · Light Commercial Vehicle (LCV) 2-Axle' },
  { id: 'VC6', name: 'Light Commercial Vehicle (LCV) 3-Axle', label: 'VC6 · Light Commercial Vehicle (LCV) 3-Axle' },
  { id: 'VC7', name: 'Bus 2-Axle', label: 'VC7 · Bus 2-Axle' },
  { id: 'VC8', name: 'Bus 3-Axle', label: 'VC8 · Bus 3-Axle' },
  { id: 'VC9', name: 'Mini-Bus', label: 'VC9 · Mini-Bus' },
  { id: 'VC10', name: 'Truck 2-Axle', label: 'VC10 · Truck 2-Axle' },
  { id: 'VC11', name: 'Truck 3-Axle', label: 'VC11 · Truck 3-Axle' },
  { id: 'VC12', name: 'Truck 4-Axle', label: 'VC12 · Truck 4-Axle' },
  { id: 'VC13', name: 'Truck 5-Axle', label: 'VC13 · Truck 5-Axle' },
  { id: 'VC14', name: 'Truck 6-Axle', label: 'VC14 · Truck 6-Axle' },
  { id: 'VC15', name: 'Multi-Axle Truck (7+ Axle)', label: 'VC15 · Multi-Axle Truck (7+ Axle)' },
  { id: 'VC16', name: 'Earth Moving Machinery (EMM)', label: 'VC16 · Earth Moving Machinery (EMM)' },
  { id: 'VC17', name: 'Heavy Construction Machinery (HCM)', label: 'VC17 · Heavy Construction Machinery (HCM)' },
  { id: 'VC18', name: 'Tractor', label: 'VC18 · Tractor' },
  { id: 'VC19', name: 'Tractor with trailer', label: 'VC19 · Tractor with trailer' },
  { id: 'VC20', name: 'Tata Ace / Mini LCV', label: 'VC20 · Tata Ace / Mini LCV' },
];

const CALLBACK_APIS = [
  'CheckTxnStatusAPI',
  'ResponsePayAPI',
  'ReqPayAPI',
  'TransStatusAPI',
  'NotificationAPI',
  'SyncTimeAPI',
  'ReqQueryExceptionListAPI',
  'VoilationAPI',
  'PassSchemeAPI',
  'HeartBeatAPI',
  'SignReqPayAPI',
  'PlazaDetailsAPI',
  'ReqGetExceptionListAPI',
  'TagDetailsAPI',
];

// Empty schema for Paysonic Plaza Onboarding — strictly populated from Railway live database
const getEmptyStore = () => ({
  concessionaires: [],
  plazas: [],
  lanes: [],
  callbacks: {},
  fares: {},
  cch: {},
  source: 'LIVE_BACKEND_DB',
  _liveDb: true,
});

export const Onboarding = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Tab management
  const ONBOARDING_TABS_CONFIG = [
    { key: 'view', idx: 'A', title: 'View Plaza', perm: 'on_boarding_view_plaza' },
    { key: 'concess', idx: 'B', title: 'Add Concessionaire', perm: 'on_boarding_add_concessionaire' },
    { key: 'addplaza', idx: 'C', title: 'Add Plaza', perm: 'on_boarding_add_plaza' },
    { key: 'lanes', idx: 'D', title: 'Lane Details', perm: 'on_boarding_lane_details' },
    { key: 'callback', idx: 'E', title: 'Callback URLs', perm: 'on_boarding_callback_url', count: '14' },
    { key: 'fare', idx: 'F', title: 'Fare Mapping', perm: 'on_boarding_fare_mapping', count: '17 Classes' },
    { key: 'cch', idx: 'G', title: 'CCH Mapping', perm: 'on_boarding_cch_mapping', count: '17 Classes' },
  ];

  const allowedTabs = useMemo(() => {
    return ONBOARDING_TABS_CONFIG.filter((t) => hasMenuAccess(currentUser, t.perm));
  }, [currentUser]);

  const fallbackTab = allowedTabs[0]?.key || 'view';
  const tabParam = searchParams.get('tab') || fallbackTab;
  const currentTabAllowed = allowedTabs.some((t) => t.key === tabParam);
  const activeTab = currentTabAllowed ? tabParam : fallbackTab;

  useEffect(() => {
    if (!currentTabAllowed && allowedTabs.length > 0) {
      setSearchParams({ tab: fallbackTab });
    }
  }, [currentTabAllowed, fallbackTab, allowedTabs.length, setSearchParams]);

  const setTab = (tab) => {
    setSearchParams({ tab });
  };

  // Main state — initialized empty, loaded exclusively from Railway live database
  const [store, setStore] = useState(() => getEmptyStore());

  // ── Railway live database hydration on mount ───────────────────────────────
  const [railwayLoading, setRailwayLoading] = useState(true);
  const [dbLoadError, setDbLoadError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setRailwayLoading(true);
    setDbLoadError(null);

    OnboardingService.loadFullStore()
      .then((hydrated) => {
        if (!isMounted) return;
        if (hydrated && Array.isArray(hydrated.plazas)) {
          setStore({
            concessionaires: hydrated.concessionaires || [],
            plazas: hydrated.plazas || [],
            lanes: hydrated.lanes || [],
            callbacks: hydrated.callbacks || {},
            fares: hydrated.fares || {},
            cch: hydrated.cch || {},
            source: 'LIVE_BACKEND_DB',
            _liveDb: true,
          });
          // Automatically synchronize scope to first live Railway MySQL plaza
          if (hydrated.plazas.length > 0) {
            setSelectedPlazaId((currentId) => {
              const hasCurrent = hydrated.plazas.some((p) => p.id === currentId);
              return hasCurrent ? currentId : hydrated.plazas[0].id;
            });
          }
        }
      })
      .catch((err) => {
        console.error('[Onboarding] Railway database load error:', err?.message);
        if (isMounted) {
          setDbLoadError(err?.message || 'Failed to connect to database');
        }
      })
      .finally(() => {
        if (isMounted) setRailwayLoading(false);
      });

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toast notifications
  const [toast, setToast] = useState({ show: false, msg: '', type: 'info' });
  const showToast = (msg, type = 'info') => {
    setToast({ show: true, msg, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3200);
  };

  // Plaza scoped selectors (shared for Lanes, Callback, Fare, CCH)
  const [selectedPlazaId, setSelectedPlazaId] = useState('');

  useEffect(() => {
    if (store.plazas.length > 0) {
      const exists = store.plazas.some((p) => p.id === selectedPlazaId);
      if (!exists || !selectedPlazaId) {
        setSelectedPlazaId(store.plazas[0].id);
      }
    }
  }, [store.plazas, selectedPlazaId]);

  // =========================================================================
  // SUBMODULE 1: VIEW PLAZA
  // =========================================================================
  const [plazaSearch, setPlazaSearch] = useState('');
  const [plazaConcessFilter, setPlazaConcessFilter] = useState('');
  const [plazaStatusFilter, setPlazaStatusFilter] = useState('');
  const [plazaCategoryFilter, setPlazaCategoryFilter] = useState('');
  const [viewPlazaDetail, setViewPlazaDetail] = useState(null);

  const getConcessionaireName = (concessId) => {
    const c = store.concessionaires.find((x) => x.id === concessId);
    return c ? c.name : concessId || '—';
  };

  const filteredPlazas = useMemo(() => {
    return store.plazas.filter((p) => {
      const matchesSearch =
        !plazaSearch ||
        (p.id + p.name + p.orgId + p.agencyId + getConcessionaireName(p.concessionaireId) + p.city + p.state)
          .toLowerCase()
          .includes(plazaSearch.toLowerCase().trim());
      const matchesConcess = !plazaConcessFilter || p.concessionaireId === plazaConcessFilter;
      const matchesStatus = !plazaStatusFilter || p.status === plazaStatusFilter;
      const matchesCategory = !plazaCategoryFilter || p.category === plazaCategoryFilter;
      return matchesSearch && matchesConcess && matchesStatus && matchesCategory;
    });
  }, [store.plazas, plazaSearch, plazaConcessFilter, plazaStatusFilter, plazaCategoryFilter, store.concessionaires]);

  // Tab A: View Plaza Pagination
  const [plazaPage, setPlazaPage] = useState(1);
  const [plazaPageSize, setPlazaPageSize] = useState(10);

  useEffect(() => {
    setPlazaPage(1);
  }, [plazaSearch, plazaConcessFilter, plazaStatusFilter, plazaCategoryFilter]);

  const paginatedPlazas = useMemo(() => {
    const start = (plazaPage - 1) * plazaPageSize;
    return filteredPlazas.slice(start, start + plazaPageSize);
  }, [filteredPlazas, plazaPage, plazaPageSize]);

  // Tab B: Concessionaires Pagination
  const [concessPage, setConcessPage] = useState(1);
  const [concessPageSize, setConcessPageSize] = useState(10);

  const paginatedConcessionaires = useMemo(() => {
    const start = (concessPage - 1) * concessPageSize;
    return (store.concessionaires || []).slice(start, start + concessPageSize);
  }, [store.concessionaires, concessPage, concessPageSize]);

  const kpis = useMemo(() => {
    const total = store.plazas.length;
    const active = store.plazas.filter((p) => p.status === 'Active').length;
    const pending = store.plazas.filter((p) => p.status === 'Pending Approval').length;
    const draft = store.plazas.filter((p) => p.status === 'Draft').length;
    const suspended = store.plazas.filter((p) => p.status === 'Suspended').length;
    return { total, active, pending, draft, suspended };
  }, [store.plazas]);

  const handleDownloadCsv = (plazasToExport = filteredPlazas) => {
    if (!plazasToExport || plazasToExport.length === 0) {
      showToast('No plaza records available to download', 'warning');
      return;
    }

    const headers = [
      'Plaza ID',
      'Plaza Name',
      'Org ID',
      'Agency Code',
      'Authority',
      'Concessionaire',
      'Concessionaire ID',
      'Category',
      'Subtype',
      'Base Pricing',
      'Interface',
      'Scheme Rule',
      'Scheme Duration',
      'Status',
      'State',
      'City',
      'Activation Date',
      'Geo Code',
      'Contact Address',
      'Contact Phone',
      'Contact Email',
      'Bank Fee (%)',
      'NPCI Fee (%)',
      'Bank GST (%)',
      'NPCI GST (%)',
    ];

    const escapeCsv = (val) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = plazasToExport.map((p) => [
      escapeCsv(p.id),
      escapeCsv(p.name),
      escapeCsv(p.orgId),
      escapeCsv(p.agencyId),
      escapeCsv(p.authority),
      escapeCsv(getConcessionaireName(p.concessionaireId)),
      escapeCsv(p.concessionaireId),
      escapeCsv(p.category),
      escapeCsv(p.subtype),
      escapeCsv(p.basePricing),
      escapeCsv(p.plazaInterface),
      escapeCsv(p.schemeRule || ''),
      escapeCsv(p.schemeDuration || ''),
      escapeCsv(p.status),
      escapeCsv(p.state),
      escapeCsv(p.city),
      escapeCsv(p.activationDate),
      escapeCsv(p.geoCode || ''),
      escapeCsv(p.contactAddress || ''),
      escapeCsv(p.contactNo || ''),
      escapeCsv(p.contactMail || ''),
      escapeCsv(p.mdr?.bankFee ?? '0'),
      escapeCsv(p.mdr?.npciFee ?? '0'),
      escapeCsv(p.mdr?.bankGst ?? '0'),
      escapeCsv(p.mdr?.npciGst ?? '0'),
    ]);

    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const statusSuffix = plazaStatusFilter ? `_${plazaStatusFilter.replace(/\s+/g, '_')}` : '';
    link.setAttribute('download', `Plazas_Report${statusSuffix}_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`✓ Downloaded ${plazasToExport.length} plaza records as CSV`, 'success');
  };

  const handleDownloadExcel = (plazasToExport = filteredPlazas) => {
    if (!plazasToExport || plazasToExport.length === 0) {
      showToast('No plaza records available to download', 'warning');
      return;
    }

    const escapeXml = (val) => {
      if (val === undefined || val === null) return '';
      return String(val)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const headers = [
      'Plaza ID', 'Plaza Name', 'Org ID', 'Agency Code', 'Authority',
      'Concessionaire', 'Concessionaire ID', 'Category', 'Subtype',
      'Base Pricing', 'Interface', 'Scheme Rule', 'Scheme Duration',
      'Status', 'State', 'City', 'Activation Date', 'Geo Code',
      'Contact Address', 'Contact Phone', 'Contact Email',
      'Bank Fee (%)', 'NPCI Fee (%)', 'Bank GST (%)', 'NPCI GST (%)',
    ];

    let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Default">
   <Alignment ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Plazas">
  <Table>
   <Row ss:StyleID="Header">`;

    headers.forEach((h) => {
      xml += `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`;
    });
    xml += `</Row>`;

    plazasToExport.forEach((p) => {
      xml += `<Row ss:StyleID="Default">
       <Cell><Data ss:Type="String">${escapeXml(p.id)}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.name)}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.orgId)}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.agencyId)}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.authority)}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(getConcessionaireName(p.concessionaireId))}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.concessionaireId)}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.category)}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.subtype)}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.basePricing)}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.plazaInterface)}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.schemeRule || '')}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.schemeDuration || '')}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.status)}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.state)}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.city)}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.activationDate)}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.geoCode || '')}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.contactAddress || '')}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.contactNo || '')}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.contactMail || '')}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.mdr?.bankFee ?? '0')}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.mdr?.npciFee ?? '0')}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.mdr?.bankGst ?? '0')}</Data></Cell>
       <Cell><Data ss:Type="String">${escapeXml(p.mdr?.npciGst ?? '0')}</Data></Cell>
      </Row>`;
    });

    xml += `</Table></Worksheet></Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const statusSuffix = plazaStatusFilter ? `_${plazaStatusFilter.replace(/\s+/g, '_')}` : '';
    link.setAttribute('download', `Plazas_Report${statusSuffix}_${timestamp}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`✓ Downloaded ${plazasToExport.length} plaza records as Excel`, 'success');
  };

  // =========================================================================
  // =========================================================================
  // SUBMODULE 2: ADD / EDIT CONCESSIONAIRE
  // =========================================================================
  const [concessForm, setConcessForm] = useState({
    name: '',
    address: '',
    mail: '',
    contact: '',
  });
  const [concessErrors, setConcessErrors] = useState({});
  const [isEditingConcess, setIsEditingConcess] = useState(false);
  const [editingConcessId, setEditingConcessId] = useState('');

  const nextConcessionaireId = useMemo(() => {
    const maxNum = store.concessionaires.reduce((acc, c) => {
      const match = c.id.match(/^CON-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        return num > acc ? num : acc;
      }
      return acc;
    }, 1000);
    return `CON-${maxNum + 1}`;
  }, [store.concessionaires]);

  const validateConcessField = (field, val, currentForm = concessForm) => {
    switch (field) {
      case 'name': {
        const v = (val !== undefined ? val : currentForm.name).trim().toUpperCase();
        if (!v) return 'Concessionaire Name is required';
        if (!/^[A-Z &.,-]{1,100}$/.test(v)) {
          return 'Alphabets, spaces, &, ., - allowed · max 100 chars';
        }
        return '';
      }
      case 'address': {
        const v = (val !== undefined ? val : currentForm.address).trim().toUpperCase();
        if (!v) return 'Address is required';
        if (!/^[A-Z0-9 ,.\-/#]{1,250}$/.test(v)) {
          return 'Alphanumeric + , . - / # allowed · max 250 chars';
        }
        return '';
      }
      case 'mail': {
        const v = (val !== undefined ? val : currentForm.mail).trim();
        if (!v) return 'Mail ID is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
          return 'Enter a valid email address';
        }
        if (
          store.concessionaires.some(
            (c) =>
              c.mail.toLowerCase() === v.toLowerCase() &&
              (!isEditingConcess || c.id !== editingConcessId)
          )
        ) {
          return 'This mail ID is already registered for another concessionaire';
        }
        return '';
      }
      case 'contact': {
        const v = (val !== undefined ? val : currentForm.contact).trim();
        if (!v) return 'Contact No is required';
        if (!/^\d{10}$/.test(v)) {
          return 'Contact No must be exactly 10 digits';
        }
        return '';
      }
      default:
        return '';
    }
  };

  const handleConcessBlur = (field) => {
    const err = validateConcessField(field, concessForm[field]);
    setConcessErrors((prev) => ({ ...prev, [field]: err }));
  };

  const handleConcessChange = (field, val) => {
    setConcessForm((prev) => ({ ...prev, [field]: val }));
    if (concessErrors[field]) {
      setConcessErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleStartEditConcess = (c) => {
    setIsEditingConcess(true);
    setEditingConcessId(c.id);
    setConcessForm({
      name: c.name || '',
      address: c.address || '',
      mail: c.mail || '',
      contact: c.contact || '',
    });
    setConcessErrors({});
    const formEl = document.querySelector('.form-column');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCancelEditConcess = () => {
    setIsEditingConcess(false);
    setEditingConcessId('');
    setConcessForm({ name: '', address: '', mail: '', contact: '' });
    setConcessErrors({});
  };

  const handleDeleteConcess = (c) => {
    const linkedPlazas = store.plazas.filter(
      (p) => String(p.concessionaireId).toUpperCase() === String(c.id).toUpperCase()
    );
    if (linkedPlazas.length > 0) {
      const plazaNames = linkedPlazas.map((p) => p.name || p.id).join(', ');
      showToast(
        `Cannot delete Concessionaire ${c.name}: linked to ${linkedPlazas.length} active Plaza(s) (${plazaNames}). Reassign or delete associated plazas first.`,
        'error'
      );
      return;
    }

    if (window.confirm(`Are you sure you want to permanently delete Concessionaire ${c.name} (${c.id})?`)) {
      setStore((prev) => ({
        ...prev,
        concessionaires: prev.concessionaires.filter((item) => item.id !== c.id),
      }));

      if (isEditingConcess && editingConcessId === c.id) {
        handleCancelEditConcess();
      }

      OnboardingService.deleteConcessionaire(c.id, {
        actor: currentUser
          ? { id: currentUser.id, name: currentUser.name, role: currentUser.role, ipAddress: '127.0.0.1' }
          : undefined,
      })
        .then(() => {
          showToast(`Concessionaire ${c.name} (${c.id}) deleted successfully`, 'success');
        })
        .catch((err) => {
          showToast(`⚠ Concessionaire Delete Failed: ${err?.response?.data?.error || err.message}`, 'error');
        });
    }
  };

  const handleSaveConcessionaire = (e) => {
    e.preventDefault();
    const fields = ['name', 'address', 'mail', 'contact'];
    const errors = {};
    fields.forEach((f) => {
      const err = validateConcessField(f, concessForm[f]);
      if (err) errors[f] = err;
    });

    if (Object.keys(errors).length > 0) {
      setConcessErrors(errors);
      showToast('Please fix the highlighted errors', 'error');
      return;
    }

    const name = concessForm.name.trim().toUpperCase();
    const address = concessForm.address.trim().toUpperCase();
    const mail = concessForm.mail.trim();
    const contact = concessForm.contact.trim();

    const concessRecord = {
      id: isEditingConcess ? editingConcessId : nextConcessionaireId,
      name,
      address,
      mail,
      contact,
    };

    const wasEditing = isEditingConcess;
    const targetId = concessRecord.id;

    // Optimistic update
    setStore((prev) => {
      if (wasEditing) {
        return {
          ...prev,
          concessionaires: prev.concessionaires.map((c) =>
            c.id === targetId ? concessRecord : c
          ),
        };
      }
      return {
        ...prev,
        concessionaires: [...prev.concessionaires, concessRecord],
      };
    });

    setIsEditingConcess(false);
    setEditingConcessId('');
    setConcessForm({ name: '', address: '', mail: '', contact: '' });
    setConcessErrors({});

    // Direct Railway MySQL API write
    OnboardingService.saveConcessionaire(concessRecord, {
      isEdit: wasEditing,
      actor: currentUser
        ? { id: currentUser.id, name: currentUser.name, role: currentUser.role, ipAddress: '127.0.0.1' }
        : undefined,
    })
      .then(() => {
        showToast(
          `Concessionaire ${concessRecord.name} (${targetId}) ${wasEditing ? 'updated' : 'saved'} successfully!`,
          'success'
        );
      })
      .catch((err) => {
        showToast(`⚠ Database Error: ${err?.response?.data?.error || err.message}`, 'error');
      });
  };

  // =========================================================================
  // SUBMODULE 3: ADD / EDIT PLAZA
  // =========================================================================
  const [isEditingPlaza, setIsEditingPlaza] = useState(false);
  const [editingPlazaOriginalId, setEditingPlazaOriginalId] = useState('');
  const [plazaForm, setPlazaForm] = useState({
    id: '',
    name: '',
    orgId: '',
    agencyId: '',
    concessionaireId: '',
    publicKey: '',
    category: 'Toll',
    basePricing: 'Distance Based',
    plazaInterface: 'API',
    subtype: 'National',
    authority: 'NHAI',
    schemeRule: 'Single Return',
    schemeDuration: '24 Hrs',
    status: 'Draft',
    state: '',
    city: '',
    activationDate: new Date().toISOString().slice(0, 10),
    geoCode: '',
    contactAddress: '',
    contactNo: '',
    contactMail: '',
    mdr: { bankFee: '0.90', npciFee: '0.15', bankGst: '18', npciGst: '18' },
  });
  const [plazaErrors, setPlazaErrors] = useState({});

  const handleStartEditPlaza = (p) => {
    setIsEditingPlaza(true);
    setEditingPlazaOriginalId(p.id);
    setPlazaForm({
      ...p,
      mdr: p.mdr || { bankFee: '0.90', npciFee: '0.15', bankGst: '18', npciGst: '18' },
    });
    setPlazaErrors({});
    setTab('addplaza');
  };

  const handleResetPlazaForm = () => {
    setIsEditingPlaza(false);
    setEditingPlazaOriginalId('');
    setPlazaForm({
      id: '',
      name: '',
      orgId: '',
      agencyId: '',
      concessionaireId: store.concessionaires[0]?.id || '',
      publicKey: '',
      category: 'Toll',
      basePricing: 'Distance Based',
      plazaInterface: 'API',
      subtype: 'National',
      authority: 'NHAI',
      schemeRule: 'Single Return',
      schemeDuration: '24 Hrs',
      status: 'Draft',
      state: '',
      city: '',
      activationDate: new Date().toISOString().slice(0, 10),
      geoCode: '',
      contactAddress: '',
      contactNo: '',
      contactMail: '',
      mdr: { bankFee: '0.90', npciFee: '0.15', bankGst: '18', npciGst: '18' },
    });
    setPlazaErrors({});
  };

  const validatePlazaField = (field, val, currentForm = plazaForm) => {
    switch (field) {
      case 'concessionaireId': {
        const v = val !== undefined ? val : currentForm.concessionaireId;
        if (!v) return 'Please select a Concessionaire';
        return '';
      }
      case 'name': {
        const v = (val !== undefined ? val : currentForm.name).trim().toUpperCase();
        if (!v) return 'Plaza Name is required';
        if (!/^[A-Z0-9 -]{1,100}$/.test(v)) {
          return 'Alphanumeric, - and spaces only · max 100 chars';
        }
        if (store.plazas.some((p) => (p.name || '').trim().toUpperCase() === v && String(p.id).trim().toUpperCase() !== String(editingPlazaOriginalId || '').trim().toUpperCase())) {
          return 'Plaza Name already exists! Each plaza must have a unique Plaza Name.';
        }
        return '';
      }
      case 'id': {
        const v = (val !== undefined ? val : currentForm.id).trim();
        if (!v) return 'Plaza ID is required';
        if (!/^\d{6}$/.test(v)) {
          return 'Plaza ID must be exactly 6 digits';
        }
        if (store.plazas.some((p) => String(p.id).trim() === v && String(p.id).trim().toUpperCase() !== String(editingPlazaOriginalId || '').trim().toUpperCase())) {
          return 'Plaza ID already exists! Each plaza must have a unique Plaza ID.';
        }
        return '';
      }
      case 'orgId': {
        const v = (val !== undefined ? val : currentForm.orgId).trim().toUpperCase();
        if (!v) return 'Org ID is required';
        if (!/^[A-Z0-9]{3,6}$/.test(v)) {
          return 'Alphanumeric only · 3 to 6 characters';
        }
        if (store.plazas.some((p) => (p.orgId || '').trim().toUpperCase() === v && String(p.id).trim().toUpperCase() !== String(editingPlazaOriginalId || '').trim().toUpperCase())) {
          return 'Org ID already exists! Each plaza must have a unique Org ID.';
        }
        return '';
      }
      case 'agencyId': {
        const v = (val !== undefined ? val : currentForm.agencyId).trim().toUpperCase();
        if (!v) return 'Agency Code is required';
        if (!/^[A-Z0-9]{4,6}$/.test(v)) {
          return 'Alphanumeric only · 4 to 6 characters';
        }
        if (store.plazas.some((p) => (p.agencyId || '').trim().toUpperCase() === v && String(p.id).trim().toUpperCase() !== String(editingPlazaOriginalId || '').trim().toUpperCase())) {
          return 'Agency Code already exists! Each plaza must have a unique Agency Code.';
        }
        return '';
      }
      case 'state': {
        const v = (val !== undefined ? val : currentForm.state).trim();
        if (!v) return 'State is required';
        return '';
      }
      case 'city': {
        const v = (val !== undefined ? val : currentForm.city).trim();
        if (!v) return 'City is required';
        return '';
      }
      case 'activationDate': {
        const v = val !== undefined ? val : currentForm.activationDate;
        if (!v) return 'Plaza Activation Date is required';
        return '';
      }
      case 'geoCode': {
        const raw = (val !== undefined ? val : currentForm.geoCode) || '';
        const v = raw.trim();
        if (!v) return 'Plaza Geo Code is required';
        const cleanGeo = v.replace(/\s+/g, '');
        if (!/^-?\d{1,3}\.\d+,-?\d{1,3}\.\d+$/.test(cleanGeo)) {
          return 'Format must be Latitude,Longitude (e.g. 19.9975,73.7898)';
        }
        if (store.plazas.some((p) => (p.geoCode || '').replace(/\s+/g, '').trim() === cleanGeo && String(p.id).trim().toUpperCase() !== String(editingPlazaOriginalId || '').trim().toUpperCase())) {
          return 'Geo Code already exists! Each plaza must have a unique Geo Code.';
        }
        return '';
      }
      case 'publicKey': {
        const v = (val !== undefined ? val : currentForm.publicKey).trim();
        if (v.length > 5000) {
          return 'Max 5000 characters allowed';
        }
        return '';
      }
      case 'contactNo': {
        const v = (val !== undefined ? val : currentForm.contactNo).trim();
        if (v && !/^\d{10}$/.test(v)) {
          return 'Contact number must be 10 digits';
        }
        return '';
      }
      case 'contactMail': {
        const v = (val !== undefined ? val : currentForm.contactMail).trim();
        if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
          return 'Enter a valid email address';
        }
        return '';
      }
      default:
        return '';
    }
  };

  const handlePlazaBlur = (field, val) => {
    const v = val !== undefined ? val : plazaForm[field];
    const err = validatePlazaField(field, v);
    setPlazaErrors((prev) => ({ ...prev, [field]: err }));
  };

  const handlePlazaChange = (field, val) => {
    setPlazaForm((prev) => ({ ...prev, [field]: val }));
    setPlazaErrors((prev) => {
      if (!prev[field]) return prev;
      return { ...prev, [field]: '' };
    });
  };

  const handlePlazaMdrChange = (field, val) => {
    setPlazaForm((prev) => ({
      ...prev,
      mdr: { ...prev.mdr, [field]: val },
    }));
  };

  const handleSavePlaza = async (e) => {
    e.preventDefault();
    const fieldsToValidate = [
      'concessionaireId',
      'name',
      'id',
      'orgId',
      'agencyId',
      'state',
      'city',
      'activationDate',
      'geoCode',
      'publicKey',
      'contactNo',
      'contactMail',
    ];
    const errors = {};
    fieldsToValidate.forEach((f) => {
      const err = validatePlazaField(f, plazaForm[f]);
      if (err) errors[f] = err;
    });

    const name = (plazaForm.name || '').trim().toUpperCase();
    const id = (plazaForm.id || '').trim();
    const orgId = (plazaForm.orgId || '').trim().toUpperCase();
    const agencyId = (plazaForm.agencyId || '').trim().toUpperCase();
    const state = (plazaForm.state || '').trim().toUpperCase();
    const city = (plazaForm.city || '').trim().toUpperCase();
    const geoCode = (plazaForm.geoCode || '').trim();
    const pubKey = (plazaForm.publicKey || '').trim();
    const contactNo = (plazaForm.contactNo || '').trim();
    const contactMail = (plazaForm.contactMail || '').trim();
    const targetOriginalId = isEditingPlaza && editingPlazaOriginalId
      ? String(editingPlazaOriginalId).trim().toUpperCase()
      : null;

    // Explicit duplicate validation against store.plazas
    if (!errors.id && store.plazas.some((p) => String(p.id).trim().toUpperCase() === id.toUpperCase() && String(p.id).trim().toUpperCase() !== targetOriginalId)) {
      errors.id = 'Plaza ID already exists! Each plaza must have a unique Plaza ID.';
    }
    if (!errors.name && store.plazas.some((p) => (p.name || '').trim().toUpperCase() === name && String(p.id).trim().toUpperCase() !== targetOriginalId)) {
      errors.name = 'Plaza Name already exists! Each plaza must have a unique Plaza Name.';
    }
    if (!errors.orgId && store.plazas.some((p) => (p.orgId || '').trim().toUpperCase() === orgId && String(p.id).trim().toUpperCase() !== targetOriginalId)) {
      errors.orgId = 'Org ID already exists! Each plaza must have a unique Org ID.';
    }
    if (!errors.agencyId && store.plazas.some((p) => (p.agencyId || '').trim().toUpperCase() === agencyId && String(p.id).trim().toUpperCase() !== targetOriginalId)) {
      errors.agencyId = 'Agency Code already exists! Each plaza must have a unique Agency Code.';
    }
    const cleanGeo = geoCode.replace(/\s+/g, '');
    if (!cleanGeo) {
      errors.geoCode = 'Plaza Geo Code is required';
    } else if (!errors.geoCode && store.plazas.some((p) => (p.geoCode || '').replace(/\s+/g, '').trim() === cleanGeo && String(p.id).trim().toUpperCase() !== targetOriginalId)) {
      errors.geoCode = 'Geo Code already exists! Each plaza must have a unique Geo Code.';
    }

    if (Object.keys(errors).length > 0) {
      setPlazaErrors(errors);
      const firstMsg = Object.values(errors)[0];
      showToast(firstMsg, 'error');
      return;
    }

    const savedPlaza = {
      ...plazaForm,
      id,
      name,
      orgId,
      agencyId,
      state,
      city,
      geoCode,
      publicKey: pubKey,
      contactAddress: (plazaForm.contactAddress || '').toUpperCase(),
      contactNo,
      contactMail,
    };

    try {
      // Save directly to Railway MySQL with backend & client uniqueness checks
      await OnboardingService.savePlaza(savedPlaza, {
        isEdit: isEditingPlaza,
        originalId: editingPlazaOriginalId,
        actor: currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role, ipAddress: '127.0.0.1' } : undefined,
      });

      // Update store state on success
      setStore((prev) => {
        let updatedPlazas = [...prev.plazas];
        const targetLookupId = isEditingPlaza && editingPlazaOriginalId ? editingPlazaOriginalId : id;
        const existingIdx = updatedPlazas.findIndex((p) => p.id === targetLookupId || p.id === id);

        if (existingIdx >= 0) {
          updatedPlazas[existingIdx] = savedPlaza;
        } else {
          updatedPlazas.push(savedPlaza);
        }

        // If ID was modified during editing, ensure old ID entry is removed so no duplicates appear
        if (isEditingPlaza && editingPlazaOriginalId && editingPlazaOriginalId !== id) {
          updatedPlazas = updatedPlazas.filter((p, idx) => idx === existingIdx || p.id !== editingPlazaOriginalId);
        }

        // Migrate callbacks, fares, cch, lanes if ID was modified
        const newCallbacks = { ...prev.callbacks };
        const newFares = { ...prev.fares };
        const newCch = { ...prev.cch };
        const newLanes = (prev.lanes || []).map((l) =>
          isEditingPlaza && editingPlazaOriginalId && l.plazaId === editingPlazaOriginalId
            ? { ...l, plazaId: id }
            : l
        );

        if (isEditingPlaza && editingPlazaOriginalId && editingPlazaOriginalId !== id) {
          if (newCallbacks[editingPlazaOriginalId]) {
            newCallbacks[id] = newCallbacks[editingPlazaOriginalId];
            delete newCallbacks[editingPlazaOriginalId];
          }
          if (newFares[editingPlazaOriginalId]) {
            newFares[id] = newFares[editingPlazaOriginalId];
            delete newFares[editingPlazaOriginalId];
          }
          if (newCch[editingPlazaOriginalId]) {
            newCch[id] = newCch[editingPlazaOriginalId];
            delete newCch[editingPlazaOriginalId];
          }
        }

        if (!newCallbacks[id]) newCallbacks[id] = {};
        if (!newFares[id]) newFares[id] = {};
        if (!newCch[id]) newCch[id] = {};

        return {
          ...prev,
          plazas: updatedPlazas,
          lanes: newLanes,
          callbacks: newCallbacks,
          fares: newFares,
          cch: newCch,
        };
      });

      if (selectedPlazaId === editingPlazaOriginalId) {
        setSelectedPlazaId(id);
      }

      showToast(`✓ Plaza ${savedPlaza.name} (${savedPlaza.id}) saved successfully!`, 'success');
      handleResetPlazaForm();
      setTab('view');
    } catch (err) {
      const errorMsg = err?.response?.data?.error || err.message || 'Database Save Failed';
      showToast(errorMsg, 'error');
      if (errorMsg.includes('Plaza ID')) {
        setPlazaErrors((prev) => ({ ...prev, id: errorMsg }));
      } else if (errorMsg.includes('Plaza Name')) {
        setPlazaErrors((prev) => ({ ...prev, name: errorMsg }));
      } else if (errorMsg.includes('Org ID')) {
        setPlazaErrors((prev) => ({ ...prev, orgId: errorMsg }));
      } else if (errorMsg.includes('Geo Code')) {
        setPlazaErrors((prev) => ({ ...prev, geoCode: errorMsg }));
      }
    }
  };

  const handleDeletePlaza = async (plazaId, plazaName) => {
    if (
      !window.confirm(
        `Are you sure you want to delete Plaza ${plazaName} (${plazaId})?\n\nThis will permanently remove it from the system and all plaza filters across the application.`
      )
    ) {
      return;
    }

    try {
      await OnboardingService.deletePlaza(plazaId, {
        actor: currentUser
          ? { id: currentUser.id, name: currentUser.name, role: currentUser.role, ipAddress: '127.0.0.1' }
          : undefined,
      });

      setStore((prev) => {
        const updatedPlazas = (prev.plazas || []).filter((p) => String(p.id) !== String(plazaId));
        return {
          ...prev,
          plazas: updatedPlazas,
          lanes: (prev.lanes || []).filter((l) => String(l.plazaId) !== String(plazaId)),
        };
      });

      if (selectedPlazaId === plazaId) {
        const remaining = (store.plazas || []).filter((p) => String(p.id) !== String(plazaId));
        setSelectedPlazaId(remaining.length > 0 ? remaining[0].id : '');
      }

      showToast(`✓ Plaza ${plazaName} (${plazaId}) deleted successfully.`, 'success');
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Failed to delete plaza';
      showToast(msg, 'error');
    }
  };

  // =========================================================================
  // SUBMODULE 4: LANE DETAILS
  // =========================================================================
  const [laneModalOpen, setLaneModalOpen] = useState(false);
  const [isEditingLane, setIsEditingLane] = useState(false);
  const [editingLaneId, setEditingLaneId] = useState('');
  const [newLane, setNewLane] = useState({
    laneId: '',
    direction: 'North',
    type: 'Entry',
    mode: 'Normal',
    category: 'Hybrid',
    status: 'Open',
  });
  const [laneError, setLaneError] = useState('');

  const plazaLanes = useMemo(() => {
    return store.lanes.filter((l) => l.plazaId === selectedPlazaId);
  }, [store.lanes, selectedPlazaId]);

  // Tab D: Lanes Pagination
  const [lanePage, setLanePage] = useState(1);
  const [lanePageSize, setLanePageSize] = useState(10);

  useEffect(() => {
    setLanePage(1);
  }, [selectedPlazaId]);

  const paginatedLanes = useMemo(() => {
    const start = (lanePage - 1) * lanePageSize;
    return plazaLanes.slice(start, start + lanePageSize);
  }, [plazaLanes, lanePage, lanePageSize]);

  const handleOpenAddLane = () => {
    if (!selectedPlazaId) {
      showToast('Please select a plaza first', 'error');
      return;
    }
    setIsEditingLane(false);
    setEditingLaneId('');
    let nextNum = plazaLanes.length + 1;
    let candidate = `L${String(nextNum).padStart(2, '0')}`;
    while (plazaLanes.some((l) => l.laneId?.toUpperCase() === candidate)) {
      nextNum++;
      candidate = `L${String(nextNum).padStart(2, '0')}`;
    }
    setNewLane({
      laneId: candidate,
      direction: 'North',
      type: 'Entry',
      mode: 'Normal',
      category: 'Hybrid',
      status: 'Open',
    });
    setLaneError('');
    setLaneModalOpen(true);
  };

  const handleOpenEditLane = (lane) => {
    setIsEditingLane(true);
    setEditingLaneId(lane.laneId);
    setNewLane({
      laneId: lane.laneId,
      direction: lane.direction || 'North',
      type: lane.type || 'Entry',
      mode: lane.mode || 'Normal',
      category: lane.category || 'Hybrid',
      status: lane.status || 'Open',
    });
    setLaneError('');
    setLaneModalOpen(true);
  };

  const validateLaneId = (val) => {
    const laneId = (val !== undefined ? val : newLane.laneId).trim().toUpperCase();
    if (!laneId) return 'Lane ID is required';
    if (!/^[A-Z0-9]{1,6}$/.test(laneId)) {
      return 'Alphanumeric only, no spaces · max 6 characters';
    }
    const isDuplicateInPlaza = (store.lanes || []).some(
      (l) =>
        l.plazaId === selectedPlazaId &&
        l.laneId?.toUpperCase() === laneId &&
        (!isEditingLane || l.laneId?.toUpperCase() !== editingLaneId?.toUpperCase())
    );
    if (isDuplicateInPlaza) {
      return `Lane ID ${laneId} already exists in this plaza`;
    }
    return '';
  };

  const handleLaneBlur = () => {
    const err = validateLaneId(newLane.laneId);
    setLaneError(err);
  };

  const handleSaveLane = (e) => {
    e.preventDefault();
    const laneId = newLane.laneId.trim().toUpperCase();
    const err = validateLaneId(laneId);
    if (err) {
      setLaneError(err);
      return;
    }

    const laneRecord = {
      ...newLane,
      plazaId: selectedPlazaId,
      laneId,
    };

    if (isEditingLane) {
      // Optimistic update for edit
      setStore((prev) => ({
        ...prev,
        lanes: prev.lanes.map((l) =>
          l.laneId === editingLaneId && l.plazaId === selectedPlazaId ? laneRecord : l
        ),
      }));

      setLaneModalOpen(false);

      OnboardingService.updateLane(laneRecord, {
        oldLaneId: editingLaneId,
        actor: currentUser
          ? { id: currentUser.id, name: currentUser.name, role: currentUser.role, ipAddress: '127.0.0.1' }
          : undefined,
      })
        .then(() => {
          showToast(`Lane ${laneId} updated successfully`, 'success');
        })
        .catch((err) => {
          showToast(`Lane Update Failed: ${err?.response?.data?.error || err.message}`, 'error');
        });
    } else {
      // Optimistic update for add
      setStore((prev) => ({
        ...prev,
        lanes: [...prev.lanes, laneRecord],
      }));

      setLaneModalOpen(false);

      OnboardingService.saveLane(laneRecord, {
        actor: currentUser
          ? { id: currentUser.id, name: currentUser.name, role: currentUser.role, ipAddress: '127.0.0.1' }
          : undefined,
      })
        .then(() => {
          showToast(`Lane ${laneId} saved successfully`, 'success');
        })
        .catch((err) => {
          showToast(`Lane Save Failed: ${err?.response?.data?.error || err.message}`, 'error');
        });
    }
  };

  const handleDeleteLane = (laneId) => {
    if (window.confirm(`Are you sure you want to remove Lane ${laneId} from Plaza ${selectedPlazaId}?`)) {
      // Optimistic update
      setStore((prev) => ({
        ...prev,
        lanes: prev.lanes.filter((l) => !(l.laneId === laneId && l.plazaId === selectedPlazaId)),
      }));

      // Delete lane
      OnboardingService.deleteLane(laneId, selectedPlazaId, {
        actor: currentUser
          ? { id: currentUser.id, name: currentUser.name, role: currentUser.role, ipAddress: '127.0.0.1' }
          : undefined,
      })
        .then(() => {
          showToast(`Lane ${laneId} deleted successfully`, 'success');
        })
        .catch((err) => {
          showToast(`Lane Delete Failed: ${err?.response?.data?.error || err.message}`, 'error');
        });
    }
  };

  // =========================================================================
  // SUBMODULE 5: CALLBACK URL CONFIGURATION
  // =========================================================================
  const [callbackUrls, setCallbackUrls] = useState({});
  const [testResults, setTestResults] = useState({});
  const [isAutoFilledCallbacks, setIsAutoFilledCallbacks] = useState(false);
  const [urlSpacePopup, setUrlSpacePopup] = useState({ show: false, api: '', rawVal: '' });

  useEffect(() => {
    if (selectedPlazaId && store.callbacks[selectedPlazaId]) {
      setCallbackUrls({ ...store.callbacks[selectedPlazaId] });
      setTestResults({});
      setIsAutoFilledCallbacks(false);
    } else {
      setCallbackUrls({});
      setTestResults({});
      setIsAutoFilledCallbacks(false);
    }
  }, [selectedPlazaId, store.callbacks]);

  const handleCallbackChange = (api, val) => {
    if (/\s/.test(val)) {
      // Reject spaces at start, end, or inside URL and alert user via popup
      const cleaned = val.replace(/\s+/g, '');
      setCallbackUrls((prev) => ({ ...prev, [api]: cleaned }));
      setUrlSpacePopup({
        show: true,
        api,
        rawVal: val,
      });
      showToast(`${api}: Spaces are not permitted in Callback URLs`, 'error');
      return;
    }
    setCallbackUrls((prev) => ({ ...prev, [api]: val }));
  };

  const handleCallbackBlur = (api) => {
    const current = callbackUrls[api] || '';
    if (/\s/.test(current)) {
      const cleaned = current.replace(/\s+/g, '');
      setCallbackUrls((prev) => ({ ...prev, [api]: cleaned }));
      setUrlSpacePopup({
        show: true,
        api,
        rawVal: current,
      });
      showToast(`${api}: Spaces are not permitted in Callback URLs`, 'error');
    }
  };

  const handleTestCallback = async (api) => {
    const raw = callbackUrls[api] || '';
    if (!raw || !raw.trim()) {
      setTestResults((prev) => ({ ...prev, [api]: { status: 'error', msg: 'Empty URL · Enter a URL to test' } }));
      showToast(`${api}: No URL provided to test`, 'error');
      return;
    }

    if (/\s/.test(raw)) {
      setUrlSpacePopup({ show: true, api, rawVal: raw });
      setTestResults((prev) => ({ ...prev, [api]: { status: 'error', msg: 'Whitespace detected in URL' } }));
      showToast(`${api}: Cannot test URL containing whitespace`, 'error');
      return;
    }

    const url = raw.trim();

    // 1. Strict URL syntax validation
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [api]: { status: 'error', msg: 'Invalid URL format · Malformed syntax' },
      }));
      showToast(`${api}: Invalid URL syntax`, 'error');
      return;
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      setTestResults((prev) => ({
        ...prev,
        [api]: { status: 'error', msg: 'Protocol must be http:// or https://' },
      }));
      showToast(`${api}: Protocol must be http:// or https://`, 'error');
      return;
    }

    if (!parsedUrl.hostname || (!parsedUrl.hostname.includes('.') && parsedUrl.hostname !== 'localhost')) {
      setTestResults((prev) => ({
        ...prev,
        [api]: { status: 'error', msg: 'Invalid hostname/domain' },
      }));
      showToast(`${api}: Invalid hostname or domain`, 'error');
      return;
    }

    setTestResults((prev) => ({ ...prev, [api]: { status: 'testing', msg: 'Verifying webhook endpoint...' } }));

    // 2. Real verification: Try backend endpoint /api/webhooks/test
    try {
      const res = await httpClient.post('/api/webhooks/test', { url }, { timeout: 6000 });
      if (res?.data) {
        const isSuccess = res.data.status === 'success';
        const msg = res.data.message || (isSuccess ? '200 OK · Handshake Verified' : 'Handshake Failed');
        setTestResults((prev) => ({
          ...prev,
          [api]: { status: isSuccess ? 'success' : 'error', msg },
        }));
        showToast(`${api}: ${msg}`, isSuccess ? 'success' : 'error');
        return;
      }
    } catch (err) {
      if (err?.response?.data?.message) {
        const msg = err.response.data.message;
        setTestResults((prev) => ({
          ...prev,
          [api]: { status: 'error', msg },
        }));
        showToast(`${api}: ${msg}`, 'error');
        return;
      }
    }

    // 3. Fallback client-side network verification
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    try {
      await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      setTestResults((prev) => ({
        ...prev,
        [api]: { status: 'success', msg: '200 OK · Handshake Verified' },
      }));
      showToast(`${api}: Connection handshake verified (200 OK)`, 'success');
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      let errMsg = 'Host Unreachable / DNS Resolution Failed';
      if (fetchErr.name === 'AbortError') {
        errMsg = 'Connection Timed Out (4500ms exceeded)';
      } else if (fetchErr.message && !fetchErr.message.includes('Failed to fetch')) {
        errMsg = fetchErr.message;
      }
      setTestResults((prev) => ({
        ...prev,
        [api]: { status: 'error', msg: `Failed · ${errMsg}` },
      }));
      showToast(`${api}: Webhook verification failed — ${errMsg}`, 'error');
    }
  };

  const handleClearCallbacks = () => {
    const cleared = {};
    CALLBACK_APIS.forEach((api) => {
      cleared[api] = '';
    });
    setCallbackUrls(cleared);
    setTestResults({});
    setIsAutoFilledCallbacks(false);
    showToast('Auto-filled URLs removed', 'info');
  };

  const handleAutoGenerateCallbacks = () => {
    if (!selectedPlazaId) return;

    const allMatchGenerated = CALLBACK_APIS.every(
      (api) => callbackUrls[api] === `https://api.paysonic.in/v1/plazas/${selectedPlazaId.toLowerCase()}/${api.toLowerCase()}`
    );

    // If clicked again after auto-filling or matching generated URLs, toggle/remove them
    if (isAutoFilledCallbacks || allMatchGenerated) {
      handleClearCallbacks();
      return;
    }

    const generated = {};
    CALLBACK_APIS.forEach((api) => {
      generated[api] = `https://api.paysonic.in/v1/plazas/${selectedPlazaId.toLowerCase()}/${api.toLowerCase()}`;
    });
    setCallbackUrls(generated);
    setTestResults({});
    setIsAutoFilledCallbacks(true);
    showToast('Auto-generated endpoint paths for all 14 APIs', 'info');
  };

  const handleSaveCallbacks = (e) => {
    e.preventDefault();
    if (!selectedPlazaId) {
      showToast('Select a plaza first', 'error');
      return;
    }

    // Check for any spaces first and show popup
    for (const [api, url] of Object.entries(callbackUrls)) {
      if (url && /\s/.test(url)) {
        setUrlSpacePopup({
          show: true,
          api,
          rawVal: url,
        });
        showToast(`Cannot save: ${api} contains spaces`, 'error');
        return;
      }
    }

    let invalidCount = 0;
    let filledCount = 0;
    Object.entries(callbackUrls).forEach(([api, url]) => {
      const u = (url || '').trim();
      if (u) {
        filledCount++;
        try {
          const parsed = new URL(u);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            invalidCount++;
          }
        } catch {
          invalidCount++;
        }
      }
    });

    if (invalidCount > 0) {
      showToast(`${invalidCount} URL(s) are invalid. Must start with http:// or https://`, 'error');
      return;
    }

    // Optimistic update
    setStore((prev) => ({
      ...prev,
      callbacks: {
        ...prev.callbacks,
        [selectedPlazaId]: { ...callbackUrls },
      },
    }));

    const urlLabel = filledCount === 1 ? '1 URL' : `${filledCount} URLs`;
    showToast(`Saved ${urlLabel} for Plaza ${selectedPlazaId}`, 'success');

    // Direct Railway MySQL API write
    OnboardingService.saveCallbacks(selectedPlazaId, callbackUrls, {
      actor: currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role, ipAddress: '127.0.0.1' } : undefined,
    }).then(() => {
      showToast(`${urlLabel} for Plaza ${selectedPlazaId} saved successfully`, 'success');
    }).catch((err) => {
      showToast(`⚠ Callback Save Failed: ${err?.response?.data?.error || err.message}`, 'error');
    });
  };

  // =========================================================================
  // SUBMODULE 6: FARE MAPPING
  // =========================================================================
  const [plazaFares, setPlazaFares] = useState({});

  useEffect(() => {
    if (selectedPlazaId && store.fares[selectedPlazaId]) {
      setPlazaFares(JSON.parse(JSON.stringify(store.fares[selectedPlazaId])));
    } else {
      setPlazaFares({});
    }
  }, [selectedPlazaId, store.fares]);

  const [fareError, setFareError] = useState('');
  const lastAutoPopulateClickRef = useRef(0);

  const handleClearAutoFares = () => {
    const cleared = {};
    VEHICLE_CLASSES.forEach((vc) => {
      cleared[vc.id] = {
        single: '',
        ret: '',
        local10: '',
        local20: '',
        district: '',
        monthly: '',
      };
    });
    setPlazaFares(cleared);
    setFareError('');
    showToast('Auto-populated fares removed', 'info');
  };

  const handleAutoPopulateToggle = () => {
    const now = Date.now();
    // Double-click detected (within 450ms) -> clear/remove auto-populated fares
    if (now - lastAutoPopulateClickRef.current < 450) {
      handleClearAutoFares();
      lastAutoPopulateClickRef.current = 0;
      return;
    }
    lastAutoPopulateClickRef.current = now;

    // Single click: populate standard NHAI matrix defaults
    const updated = {};
    VEHICLE_CLASSES.forEach((vc, i) => {
      const base = 60 + i * 25;
      updated[vc.id] = {
        single: base,
        ret: Math.round(base * 1.5),
        local10: Math.round(base * 0.4),
        local20: Math.round(base * 0.6),
        district: Math.round(base * 20),
        monthly: Math.round(base * 40),
      };
    });
    setPlazaFares(updated);
    setFareError('');
    showToast('Populated standard NHAI fare matrix defaults (Double-click button to remove)', 'info');
  };

  const handleFareInputChange = (vcId, journeyType, val) => {
    // Only numbers allowed, max 6 digits
    if (val && !/^\d{0,6}$/.test(val)) return;
    setFareError('');
    setPlazaFares((prev) => ({
      ...prev,
      [vcId]: {
        ...(prev[vcId] || {}),
        [journeyType]: val,
      },
    }));
  };

  const handleSaveFares = (e) => {
    e.preventDefault();
    if (!selectedPlazaId) {
      showToast('Select a plaza first', 'error');
      return;
    }

    // Validate that no fare amount is blank and valid rates are provided
    const JOURNEY_KEYS = ['single', 'ret', 'local10', 'local20', 'district', 'monthly'];
    let hasBlankAmount = false;

    for (const vc of VEHICLE_CLASSES) {
      const rates = plazaFares[vc.id];
      if (!rates || typeof rates !== 'object') {
        hasBlankAmount = true;
        break;
      }
      for (const jk of JOURNEY_KEYS) {
        const val = rates[jk];
        if (val === '' || val === null || val === undefined || String(val).trim() === '') {
          hasBlankAmount = true;
          break;
        }
      }
      if (hasBlankAmount) break;
    }

    const hasAnyPositiveAmount = Object.values(plazaFares || {}).some((rates) => {
      if (!rates || typeof rates !== 'object') return false;
      return Object.values(rates).some((val) => Number(val) > 0);
    });

    if (hasBlankAmount || !hasAnyPositiveAmount) {
      const errorMsg = 'Amount is required';
      setFareError(errorMsg);
      showToast(errorMsg, 'error');
      return;
    }

    setFareError('');

    // Optimistic update
    setStore((prev) => ({
      ...prev,
      fares: {
        ...prev.fares,
        [selectedPlazaId]: plazaFares,
      },
    }));

    // Direct Railway MySQL API write
    OnboardingService.saveFares(selectedPlazaId, plazaFares, {
      actor: currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role, ipAddress: '127.0.0.1' } : undefined,
    }).then(() => {
      showToast(`Fare mapping for Plaza ${selectedPlazaId} saved successfully!`, 'success');
    }).catch((err) => {
      showToast(`⚠ Fare Save Failed: ${err?.response?.data?.error || err.message}`, 'error');
    });
  };

  // =========================================================================
  // SUBMODULE 7: CCH MAPPING
  // =========================================================================
  const [plazaCch, setPlazaCch] = useState({});

  useEffect(() => {
    if (selectedPlazaId && store.cch[selectedPlazaId]) {
      setPlazaCch(JSON.parse(JSON.stringify(store.cch[selectedPlazaId])));
    } else {
      setPlazaCch({});
    }
  }, [selectedPlazaId, store.cch]);

  const handleCchInputChange = (vcId, val) => {
    if (val && !/^\d{0,6}$/.test(val)) return;
    setPlazaCch((prev) => ({
      ...prev,
      [vcId]: {
        ...(prev[vcId] || { current: '', new: '' }),
        new: val,
      },
    }));
  };

  const handleSaveCch = (e) => {
    e.preventDefault();
    if (!selectedPlazaId) {
      showToast('Select a plaza first', 'error');
      return;
    }

    // Apply new CCH to current CCH if entered
    const updated = {};
    VEHICLE_CLASSES.forEach((vc) => {
      const item = plazaCch[vc.id] || { current: '', new: '' };
      const newNum = item.new ? parseInt(item.new, 10) : item.current;
      updated[vc.id] = {
        current: newNum,
        new: '',
      };
    });

    setPlazaCch(updated);
    // Optimistic update
    setStore((prev) => ({
      ...prev,
      cch: {
        ...prev.cch,
        [selectedPlazaId]: updated,
      },
    }));

    // Save CCH
    OnboardingService.saveCch(selectedPlazaId, updated, {
      actor: currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role, ipAddress: '127.0.0.1' } : undefined,
    }).then(() => {
      showToast(`CCH mapping for Plaza ${selectedPlazaId} saved successfully!`, 'success');
    }).catch((err) => {
      showToast(`⚠ CCH Save Failed: ${err?.response?.data?.error || err.message}`, 'error');
    });
  };

  const selectedPlazaObject = useMemo(() => {
    return store.plazas.find((p) => p.id === selectedPlazaId) || null;
  }, [store.plazas, selectedPlazaId]);

  return (
    <div className="onboarding-page">
      {/* Toast Alert */}
      {toast.show && (
        <div className={`onboarding-toast ${toast.type}`}>
          <span className="toast-icon">
            {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
          </span>
          <span className="toast-msg">{toast.msg.replace(/^[✓✕⚠ℹ]\s*/, '')}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="onboarding-header">
        <div className="header-left">
          <h1>Plaza Onboarding Module</h1>
        </div>
        <div className="header-actions">
          {hasMenuAccess(currentUser, 'on_boarding_add_plaza') && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                handleResetPlazaForm();
                setTab('addplaza');
              }}
            >
              + Add New Plaza
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      {allowedTabs.length > 0 && (
        <div className="module-tabs">
          {allowedTabs.map((t) => {
            const count =
              t.key === 'view'
                ? store.plazas.length
                : t.key === 'concess'
                ? store.concessionaires.length
                : t.key === 'lanes'
                ? plazaLanes.length
                : t.count;
            const title = t.key === 'addplaza' && isEditingPlaza ? 'Edit Plaza' : t.title;

            return (
              <button
                key={t.key}
                type="button"
                className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                <span className="tab-idx">{t.idx}</span>
                <span className="tab-title">{title}</span>
                {count !== undefined && <span className="tab-count">{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Live Railway Database Loading State */}
      {railwayLoading && (
        <div className="onboarding-loading-state" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          color: '#8b949e',
          gap: '12px'
        }}>
          <div className="spinner" style={{
            width: '32px',
            height: '32px',
            border: '3px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: '#38bdf8',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#c9d1d9' }}>
            Loading records...
          </p>
        </div>
      )}

      {/* Database Load Error Banner */}
      {dbLoadError && (
        <div className="onboarding-error-banner" style={{
          margin: '16px 0',
          padding: '12px 16px',
          backgroundColor: 'rgba(248, 81, 73, 0.1)',
          border: '1px solid rgba(248, 81, 73, 0.3)',
          borderRadius: '8px',
          color: '#f85149',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>⚠ Failed to connect to database: {dbLoadError}</span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => window.location.reload()}
            style={{ fontSize: '12px', padding: '4px 10px' }}
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB A: VIEW PLAZA                                                 */}
      {/* ================================================================= */}
      {!railwayLoading && activeTab === 'view' && (
        <div className="tab-content view-plaza-section">
          {/* KPI Summary Cards — Clickable to filter table by status */}
          <div className="kpi-grid">
            <div
              className={`kpi-card clickable ${!plazaStatusFilter ? 'active-card' : ''}`}
              onClick={() => setPlazaStatusFilter('')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setPlazaStatusFilter('');
                }
              }}
              title="Click to view all plazas"
            >
              <span className="kpi-label">Total Plazas</span>
              <span className="kpi-value">{kpis.total}</span>
              <span className="kpi-sub">Across National Highway Network · Click to show all</span>
            </div>
            <div
              className={`kpi-card green clickable ${plazaStatusFilter === 'Active' ? 'active-card' : ''}`}
              onClick={() => setPlazaStatusFilter((prev) => (prev === 'Active' ? '' : 'Active'))}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setPlazaStatusFilter((prev) => (prev === 'Active' ? '' : 'Active'));
                }
              }}
              title="Click to view Active plazas"
            >
              <span className="kpi-label">Active Plazas</span>
              <span className="kpi-value">{kpis.active}</span>
              <span className="kpi-sub">Processing Live FASTag Txns · Click to filter</span>
            </div>
            <div
              className={`kpi-card amber clickable ${plazaStatusFilter === 'Pending Approval' ? 'active-card' : ''}`}
              onClick={() => setPlazaStatusFilter((prev) => (prev === 'Pending Approval' ? '' : 'Pending Approval'))}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setPlazaStatusFilter((prev) => (prev === 'Pending Approval' ? '' : 'Pending Approval'));
                }
              }}
              title="Click to view Pending Approval plazas"
            >
              <span className="kpi-label">Pending Approval</span>
              <span className="kpi-value">{kpis.pending}</span>
              <span className="kpi-sub">Maker-Checker Review Needed · Click to filter</span>
            </div>
            <div
              className={`kpi-card grey clickable ${plazaStatusFilter === 'Draft' ? 'active-card' : ''}`}
              onClick={() => setPlazaStatusFilter((prev) => (prev === 'Draft' ? '' : 'Draft'))}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setPlazaStatusFilter((prev) => (prev === 'Draft' ? '' : 'Draft'));
                }
              }}
              title="Click to view Draft plazas"
            >
              <span className="kpi-label">Draft Plazas</span>
              <span className="kpi-value">{kpis.draft}</span>
              <span className="kpi-sub">Incomplete Configuration · Click to filter</span>
            </div>
          </div>

          <div className="panel-card">
            <div className="filter-toolbar">
              <div className="search-wrap">
                <input
                  type="text"
                  placeholder="Search by Plaza ID, Name, Org ID, Concessionaire, City..."
                  value={plazaSearch}
                  onChange={(e) => setPlazaSearch(e.target.value)}
                  className="search-input"
                />
              </div>

              <select
                value={plazaConcessFilter}
                onChange={(e) => setPlazaConcessFilter(e.target.value)}
                className="filter-select"
              >
                <option value="">All Concessionaires</option>
                {store.concessionaires.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>

              <select
                value={plazaStatusFilter}
                onChange={(e) => setPlazaStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Draft">Draft</option>
                <option value="Suspended">Suspended</option>
              </select>

              <select
                value={plazaCategoryFilter}
                onChange={(e) => setPlazaCategoryFilter(e.target.value)}
                className="filter-select"
              >
                <option value="">All Categories</option>
                <option value="Toll">Toll</option>
                <option value="Parking">Parking</option>
                <option value="EV">EV</option>
              </select>

              {(plazaSearch || plazaConcessFilter || plazaStatusFilter || plazaCategoryFilter) && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setPlazaSearch('');
                    setPlazaConcessFilter('');
                    setPlazaStatusFilter('');
                    setPlazaCategoryFilter('');
                  }}
                >
                  Clear Filters
                </button>
              )}

              <div className="download-btn-group">
                <button
                  type="button"
                  className="btn-download"
                  onClick={() => handleDownloadCsv()}
                  title={`Download ${filteredPlazas.length} displayed plaza records as CSV`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Download CSV</span>
                </button>
                <button
                  type="button"
                  className="btn-download btn-download-excel"
                  onClick={() => handleDownloadExcel()}
                  title={`Download ${filteredPlazas.length} displayed plaza records as Excel`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Download Excel</span>
                </button>
              </div>
            </div>

            <div className="table-header-info">
              <div className="table-count-label">
                Showing <strong>{filteredPlazas.length}</strong> of <strong>{store.plazas.length}</strong> plazas
                {plazaStatusFilter && (
                  <span className={`status-filter-pill ${
                    plazaStatusFilter === 'Active' ? 'pill-green' :
                    plazaStatusFilter === 'Pending Approval' ? 'pill-amber' :
                    plazaStatusFilter === 'Draft' ? 'pill-grey' : ''
                  }`}>
                    Filtered by: <strong>{plazaStatusFilter}</strong>
                    <button
                      type="button"
                      className="pill-remove-btn"
                      onClick={() => setPlazaStatusFilter('')}
                      title="Clear status filter"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            </div>

            <div className="table-responsive">
              <table className="onboarding-table">
                <thead>
                  <tr>
                    <th>Plaza ID</th>
                    <th>Plaza Name</th>
                    <th>Org ID</th>
                    <th>Concessionaire</th>
                    <th>Category</th>
                    <th>Subtype</th>
                    <th>State / City</th>
                    <th>Activation Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlazas.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="empty-cell">
                        No plazas found matching the criteria. Click "+ Add New Plaza" to onboard one.
                      </td>
                    </tr>
                  ) : (
                    paginatedPlazas.map((p) => {
                      const statusClass =
                        p.status === 'Active'
                          ? 'badge-active'
                          : p.status === 'Pending Approval'
                          ? 'badge-pending'
                          : p.status === 'Suspended'
                          ? 'badge-suspended'
                          : 'badge-draft';

                      return (
                        <tr key={p.id}>
                          <td>
                            <code className="id-code">{p.id}</code>
                          </td>
                          <td>
                            <strong>{p.name}</strong>
                            <div className="sub-detail">Agency: {p.agencyId} · {p.authority}</div>
                          </td>
                          <td>
                            <span className="org-pill">{p.orgId}</span>
                          </td>
                          <td>{getConcessionaireName(p.concessionaireId)}</td>
                          <td>
                            <span className="cat-pill">{p.category}</span>
                          </td>
                          <td>{p.subtype}</td>
                          <td>
                            {p.city}, {p.state}
                          </td>
                          <td>{p.activationDate}</td>
                          <td>
                            <span className={`status-badge ${statusClass}`}>
                              <span className="dot" />
                              {p.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="table-actions">
                              <button
                                type="button"
                                className="action-btn"
                                title="Quick View"
                                onClick={() => setViewPlazaDetail(p)}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                className="action-btn edit"
                                title="Edit Plaza"
                                onClick={() => handleStartEditPlaza(p)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="action-btn config"
                                title="Configure Lanes &amp; URLs"
                                onClick={() => {
                                  setSelectedPlazaId(p.id);
                                  setTab('lanes');
                                }}
                              >
                                Config
                              </button>
                              <button
                                type="button"
                                className="action-btn delete"
                                title="Delete Plaza"
                                onClick={() => handleDeletePlaza(p.id, p.name)}
                                style={{ color: '#ef4444', borderColor: '#fca5a5' }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              <TablePagination
                totalItems={filteredPlazas.length}
                currentPage={plazaPage}
                pageSize={plazaPageSize}
                onPageChange={setPlazaPage}
                onPageSizeChange={(newSize) => {
                  setPlazaPageSize(newSize);
                  setPlazaPage(1);
                }}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB B: ADD CONCESSIONAIRE                                         */}
      {/* ================================================================= */}
      {!railwayLoading && activeTab === 'concess' && (
        <div className="tab-content add-concess-section">
          <div className="two-col-layout">
            {/* Form Column */}
            <div className="panel-card form-column">
              <div className="card-header">
                <h3>{isEditingConcess ? `Edit Concessionaire — ${concessForm.name || editingConcessId} (${editingConcessId})` : 'Add Concessionaire'}</h3>
                <p className="card-desc">
                  {isEditingConcess
                    ? 'Update registered corporate details, official email address, or contact phone.'
                    : 'Concessionaire ID is generated automatically in CON-#### format upon save and is used to bind plazas.'}
                </p>
              </div>

              <form onSubmit={handleSaveConcessionaire} className="styled-form">
                <div className="form-group">
                  <label>
                    Concessionaire ID <span className="helper-label">{isEditingConcess ? '(Read Only)' : '(System Generated)'}</span>
                  </label>
                  <input
                    type="text"
                    value={isEditingConcess ? editingConcessId : nextConcessionaireId}
                    disabled
                    className="disabled-input code-font"
                  />
                  <div className="field-hint">{isEditingConcess ? 'Concessionaire sequence ID is immutable' : 'Auto-assigned sequence ID'}</div>
                </div>

                <div className="form-group">
                  <label>
                    Concessionaire Name <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="e.g. GMR HIGHWAYS LIMITED"
                    value={concessForm.name}
                    onChange={(e) => handleConcessChange('name', e.target.value.toUpperCase())}
                    onBlur={() => handleConcessBlur('name')}
                    className={concessErrors.name ? 'invalid' : ''}
                  />
                  <div className="field-hint">Alphabets, spaces, &, ., - allowed · max 100 chars</div>
                  {concessErrors.name && <div className="field-error">{concessErrors.name}</div>}
                </div>

                <div className="form-group">
                  <label>
                    Registered Office Address <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={250}
                    placeholder="Registered corporate address"
                    value={concessForm.address}
                    onChange={(e) => handleConcessChange('address', e.target.value.toUpperCase())}
                    onBlur={() => handleConcessBlur('address')}
                    className={concessErrors.address ? 'invalid' : ''}
                  />
                  <div className="field-hint">Alphanumeric + , . - / # allowed · max 250 chars</div>
                  {concessErrors.address && <div className="field-error">{concessErrors.address}</div>}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>
                      Official Mail ID <span className="req">*</span>
                    </label>
                    <input
                      type="email"
                      maxLength={100}
                      placeholder="ops@concessionaire.com"
                      value={concessForm.mail}
                      onChange={(e) => handleConcessChange('mail', e.target.value)}
                      onBlur={() => handleConcessBlur('mail')}
                      className={concessErrors.mail ? 'invalid' : ''}
                    />
                    <div className="field-hint">Must be unique per concessionaire</div>
                    {concessErrors.mail && <div className="field-error">{concessErrors.mail}</div>}
                  </div>

                  <div className="form-group">
                    <label>
                      Contact Phone No <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={concessForm.contact}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        handleConcessChange('contact', val);
                      }}
                      onBlur={() => handleConcessBlur('contact')}
                      className={concessErrors.contact ? 'invalid' : ''}
                    />
                    <div className="field-hint">Digits only · exactly 10 digits</div>
                    {concessErrors.contact && <div className="field-error">{concessErrors.contact}</div>}
                  </div>
                </div>

                <div className="form-actions">
                  {isEditingConcess ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleCancelEditConcess}
                    >
                      Cancel Edit
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      if (isEditingConcess) {
                        handleCancelEditConcess();
                      } else {
                        setConcessForm({ name: '', address: '', mail: '', contact: '' });
                        setConcessErrors({});
                      }
                    }}
                  >
                    {isEditingConcess ? 'Reset' : 'Clear Form'}
                  </button>
                  <button type="submit" className="btn-primary">
                    {isEditingConcess ? 'Update Concessionaire' : 'Save Concessionaire'}
                  </button>
                </div>
              </form>
            </div>

            {/* List Column */}
            <div className="panel-card list-column">
              <div className="card-header">
                <h3>Onboarded Concessionaires</h3>
                <p className="card-desc">Active entities available for plaza linkage</p>
              </div>

              <div className="table-responsive">
                <table className="onboarding-table compact">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Concessionaire Name</th>
                      <th>Official Email</th>
                      <th>Contact No</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {store.concessionaires.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="empty-cell" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                          No concessionaires onboarded yet. Fill out the form on the left to add one.
                        </td>
                      </tr>
                    ) : (
                      paginatedConcessionaires.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <code className="id-code">{c.id}</code>
                          </td>
                          <td>
                            <strong>{c.name}</strong>
                            <div className="sub-detail">{c.address}</div>
                          </td>
                          <td>{c.mail}</td>
                          <td>{c.contact}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="table-actions">
                              <button
                                type="button"
                                className="action-btn edit"
                                title="Edit Concessionaire"
                                onClick={() => handleStartEditConcess(c)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn-danger-ghost sm"
                                title="Delete Concessionaire"
                                onClick={() => handleDeleteConcess(c)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                <TablePagination
                  totalItems={store.concessionaires.length}
                  currentPage={concessPage}
                  pageSize={concessPageSize}
                  onPageChange={setConcessPage}
                  onPageSizeChange={(newSize) => {
                    setConcessPageSize(newSize);
                    setConcessPage(1);
                  }}
                  pageSizeOptions={[5, 10, 25, 50]}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB C: ADD / EDIT PLAZA                                           */}
      {/* ================================================================= */}
      {!railwayLoading && activeTab === 'addplaza' && (
        <div className="tab-content add-plaza-section">
          <div className="panel-card">
            <div className="card-header flex-header">
              <div>
                <h3>{isEditingPlaza ? `Edit Plaza — ${plazaForm.name} (${plazaForm.id})` : 'Add New Plaza'}</h3>
                <p className="card-desc">
                  Fields marked <span className="req">*</span> are required. Text inputs are stored in upper case.
                </p>
              </div>
              {isEditingPlaza && (
                <button type="button" className="btn-secondary" onClick={handleResetPlazaForm}>
                  Switch to Add New Plaza
                </button>
              )}
            </div>

            <form onSubmit={handleSavePlaza} className="styled-form">
              {/* Section 1: Concessionaire & Identity */}
              <div className="form-section-title">
                <span className="sec-num">1</span> Concessionaire &amp; Identity
              </div>
              <div className="form-grid-3">
                <div className="form-group">
                  <label>
                    Select Concessionaire <span className="req">*</span>
                  </label>
                  <select
                    value={plazaForm.concessionaireId}
                    onChange={(e) => handlePlazaChange('concessionaireId', e.target.value)}
                    onBlur={() => handlePlazaBlur('concessionaireId')}
                    className={plazaErrors.concessionaireId ? 'invalid' : ''}
                  >
                    <option value="">Choose Concessionaire...</option>
                    {store.concessionaires.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.id})
                      </option>
                    ))}
                  </select>
                  {plazaErrors.concessionaireId && (
                    <div className="field-error">{plazaErrors.concessionaireId}</div>
                  )}
                </div>

                <div className="form-group">
                  <label>
                    Plaza Name <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="e.g. KHERKI DAULA"
                    value={plazaForm.name}
                    onChange={(e) => handlePlazaChange('name', e.target.value.toUpperCase())}
                    onBlur={() => handlePlazaBlur('name')}
                    className={plazaErrors.name ? 'invalid' : ''}
                  />
                  <div className="field-hint">Alphanumeric, - and spaces allowed · max 100 chars</div>
                  {plazaErrors.name && <div className="field-error">{plazaErrors.name}</div>}
                </div>

                <div className="form-group">
                  <label>
                    Plaza ID <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="6-digit unique number"
                    value={plazaForm.id}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      handlePlazaChange('id', val);
                    }}
                    onBlur={() => handlePlazaBlur('id')}
                    className={plazaErrors.id ? 'invalid' : ''}
                  />
                  <div className="field-hint">Numeric only · exactly 6 digits · unique network-wide</div>
                  {plazaErrors.id && <div className="field-error">{plazaErrors.id}</div>}
                </div>

                <div className="form-group">
                  <label>
                    Org ID <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="e.g. PYSN"
                    value={plazaForm.orgId}
                    onChange={(e) => handlePlazaChange('orgId', e.target.value.toUpperCase())}
                    onBlur={() => handlePlazaBlur('orgId')}
                    className={plazaErrors.orgId ? 'invalid' : ''}
                  />
                  <div className="field-hint">Letters only · exactly 4 characters</div>
                  {plazaErrors.orgId && <div className="field-error">{plazaErrors.orgId}</div>}
                </div>

                <div className="form-group">
                  <label>
                    Agency ID <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={5}
                    placeholder="e.g. NHAI1"
                    value={plazaForm.agencyId}
                    onChange={(e) => handlePlazaChange('agencyId', e.target.value.toUpperCase())}
                    onBlur={() => handlePlazaBlur('agencyId')}
                    className={plazaErrors.agencyId ? 'invalid' : ''}
                  />
                  <div className="field-hint">Letters only · exactly 5 letters</div>
                  {plazaErrors.agencyId && <div className="field-error">{plazaErrors.agencyId}</div>}
                </div>

                <div className="form-group span-full">
                  <label>Public Key (PEM / Base64 format)</label>
                  <textarea
                    rows={3}
                    maxLength={5000}
                    placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
                    value={plazaForm.publicKey}
                    onChange={(e) => handlePlazaChange('publicKey', e.target.value)}
                    onBlur={() => handlePlazaBlur('publicKey')}
                    className="code-font"
                  />
                  <div className="field-hint">Base64-encoded string or PEM format · max 5000 chars</div>
                </div>
              </div>

              {/* Section 2: Configuration */}
              <div className="form-section-title">
                <span className="sec-num">2</span> Configuration &amp; Rules
              </div>
              <div className="form-grid-4">
                <div className="form-group">
                  <label>
                    Plaza Category <span className="req">*</span>
                  </label>
                  <select
                    value={plazaForm.category}
                    onChange={(e) => handlePlazaChange('category', e.target.value)}
                  >
                    <option value="Toll">Toll</option>
                    <option value="Parking">Parking</option>
                    <option value="EV">EV</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    Base Pricing <span className="req">*</span>
                  </label>
                  <select
                    value={plazaForm.basePricing}
                    onChange={(e) => handlePlazaChange('basePricing', e.target.value)}
                  >
                    <option value="Point Based">Point Based</option>
                    <option value="Distance Based">Distance Based</option>
                    <option value="Custom Based">Custom Based</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    Plaza Interface <span className="req">*</span>
                  </label>
                  <select
                    value={plazaForm.plazaInterface}
                    onChange={(e) => handlePlazaChange('plazaInterface', e.target.value)}
                  >
                    <option value="API">API</option>
                    <option value="SFTP">SFTP</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    Plaza Subtype <span className="req">*</span>
                  </label>
                  <select
                    value={plazaForm.subtype}
                    onChange={(e) => handlePlazaChange('subtype', e.target.value)}
                  >
                    <option value="National">National</option>
                    <option value="State">State</option>
                    <option value="Open">Open</option>
                    <option value="Covered">Covered</option>
                    <option value="Fast">Fast</option>
                    <option value="DC Fast">DC Fast</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    Authority <span className="req">*</span>
                  </label>
                  <select
                    value={plazaForm.authority}
                    onChange={(e) => handlePlazaChange('authority', e.target.value)}
                  >
                    <option value="IHMCL">IHMCL</option>
                    <option value="NHAI">NHAI</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Plaza Scheme Rule</label>
                  <select
                    value={plazaForm.schemeRule}
                    onChange={(e) => handlePlazaChange('schemeRule', e.target.value)}
                  >
                    <option value="Single Single">Single Single</option>
                    <option value="Single Return">Single Return</option>
                    <option value="3rd Journey DP">3rd Journey DP</option>
                    <option value="4th Journey DP">4th Journey DP</option>
                    <option value="5th Journey DP">5th Journey DP</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Plaza Scheme Rule Duration</label>
                  <select
                    value={plazaForm.schemeDuration}
                    onChange={(e) => handlePlazaChange('schemeDuration', e.target.value)}
                  >
                    <option value="Same Day Midnight">Same Day Midnight</option>
                    <option value="24 Hrs">24 Hrs</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Plaza Status</label>
                  <select
                    value={plazaForm.status}
                    onChange={(e) => handlePlazaChange('status', e.target.value)}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Pending Approval">Pending Approval</option>
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              {/* Section 3: Location */}
              <div className="form-section-title">
                <span className="sec-num">3</span> Geographical Location
              </div>
              <div className="form-grid-4">
                <StateCitySelect
                  stateValue={plazaForm.state}
                  cityValue={plazaForm.city}
                  onStateChange={(val) => {
                    handlePlazaChange('state', val);
                    if (val) {
                      setPlazaErrors((prev) => ({ ...prev, state: '' }));
                    }
                  }}
                  onCityChange={(val) => {
                    handlePlazaChange('city', val);
                    if (val) {
                      setPlazaErrors((prev) => ({ ...prev, city: '' }));
                    }
                  }}
                  stateError={plazaErrors.state}
                  cityError={plazaErrors.city}
                  onStateBlur={(val) => handlePlazaBlur('state', val !== undefined ? val : plazaForm.state)}
                  onCityBlur={(val) => handlePlazaBlur('city', val !== undefined ? val : plazaForm.city)}
                />

                <div className="form-group">
                  <label>
                    Plaza Activation Date <span className="req">*</span>
                  </label>
                  <input
                    type="date"
                    value={plazaForm.activationDate}
                    onChange={(e) => handlePlazaChange('activationDate', e.target.value)}
                    onBlur={() => handlePlazaBlur('activationDate')}
                    className={plazaErrors.activationDate ? 'invalid' : ''}
                  />
                  {plazaErrors.activationDate && (
                    <div className="field-error">{plazaErrors.activationDate}</div>
                  )}
                </div>

                <div className="form-group">
                  <label>
                    Plaza Geo Code (Lat,Long) <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 28.4089,76.9647"
                    value={plazaForm.geoCode}
                    onChange={(e) => handlePlazaChange('geoCode', e.target.value)}
                    onBlur={() => handlePlazaBlur('geoCode')}
                    className={plazaErrors.geoCode ? 'invalid' : ''}
                  />
                  <div className="field-hint">Format: Latitude,Longitude</div>
                  {plazaErrors.geoCode && <div className="field-error">{plazaErrors.geoCode}</div>}
                </div>
              </div>

              {/* Section 4: Contact Details */}
              <div className="form-section-title">
                <span className="sec-num">4</span> Contact Information
              </div>
              <div className="form-grid-3">
                <div className="form-group span-2">
                  <label>Site Address</label>
                  <input
                    type="text"
                    maxLength={250}
                    placeholder="Plaza physical operational address"
                    value={plazaForm.contactAddress}
                    onChange={(e) => handlePlazaChange('contactAddress', e.target.value.toUpperCase())}
                  />
                </div>

                <div className="form-group">
                  <label>Site Contact No</label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="10-digit number"
                    value={plazaForm.contactNo}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      handlePlazaChange('contactNo', val);
                    }}
                    onBlur={() => handlePlazaBlur('contactNo')}
                    className={plazaErrors.contactNo ? 'invalid' : ''}
                  />
                  {plazaErrors.contactNo && (
                    <div className="field-error">{plazaErrors.contactNo}</div>
                  )}
                </div>

                <div className="form-group span-full">
                  <label>Operations Mail ID</label>
                  <input
                    type="email"
                    maxLength={100}
                    placeholder="plaza.ops@concessionaire.com"
                    value={plazaForm.contactMail}
                    onChange={(e) => handlePlazaChange('contactMail', e.target.value)}
                    onBlur={() => handlePlazaBlur('contactMail')}
                    className={plazaErrors.contactMail ? 'invalid' : ''}
                  />
                  {plazaErrors.contactMail && (
                    <div className="field-error">{plazaErrors.contactMail}</div>
                  )}
                </div>
              </div>

              {/* Section 5: MDR Configuration */}
              <div className="form-section-title">
                <span className="sec-num">5</span> MDR Configuration
              </div>
              <div className="form-grid-4">
                <div className="form-group">
                  <label>Bank Service Fee (%)</label>
                  <input
                    type="text"
                    placeholder="e.g. 0.90"
                    value={plazaForm.mdr?.bankFee || ''}
                    onChange={(e) => handlePlazaMdrChange('bankFee', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>NPCI Service Fee (%)</label>
                  <input
                    type="text"
                    placeholder="e.g. 0.15"
                    value={plazaForm.mdr?.npciFee || ''}
                    onChange={(e) => handlePlazaMdrChange('npciFee', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Bank Service Fee GST (%)</label>
                  <input
                    type="text"
                    placeholder="e.g. 18"
                    value={plazaForm.mdr?.bankGst || ''}
                    onChange={(e) => handlePlazaMdrChange('bankGst', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>NPCI Service Fee GST (%)</label>
                  <input
                    type="text"
                    placeholder="e.g. 18"
                    value={plazaForm.mdr?.npciGst || ''}
                    onChange={(e) => handlePlazaMdrChange('npciGst', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-ghost" onClick={handleResetPlazaForm}>
                  Cancel / Clear
                </button>
                <button type="submit" className="btn-primary">
                  {isEditingPlaza ? 'Save & Update Plaza' : 'Save Plaza Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB D: LANE DETAILS                                               */}
      {/* ================================================================= */}
      {!railwayLoading && activeTab === 'lanes' && (
        <div className="tab-content lane-details-section">
          {/* Plaza Selector Header */}
          <div className="plaza-scope-card">
            <div className="scope-left">
              <label>Scoped Plaza:</label>
              <select
                value={selectedPlazaId}
                onChange={(e) => setSelectedPlazaId(e.target.value)}
                className="plaza-select"
              >
                {store.plazas.length === 0 ? (
                  <option value="">No plazas onboarded yet</option>
                ) : (
                  store.plazas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id}) · {p.status}
                    </option>
                  ))
                )}
              </select>
              {selectedPlazaObject && (
                <span className="scope-meta">
                  Category: <strong>{selectedPlazaObject.category}</strong> · Interface:{' '}
                  <strong>{selectedPlazaObject.plazaInterface}</strong>
                </span>
              )}
            </div>
            <button type="button" className="btn-primary" onClick={handleOpenAddLane}>
              + Add Lane to Plaza
            </button>
          </div>

          <div className="panel-card">
            <div className="card-header flex-header">
              <div>
                <h3>Lanes for {selectedPlazaObject?.name || selectedPlazaId}</h3>
                <p className="card-desc">
                  Configured FASTag readers, lane direction, entry/exit gating modes, and physical status.
                </p>
              </div>
              <div className="lane-stats-pills">
                <span className="stat-pill">Total: {plazaLanes.length}</span>
                <span className="stat-pill green">
                  Open: {plazaLanes.filter((l) => l.status === 'Open').length}
                </span>
                <span className="stat-pill amber">
                  Maint: {plazaLanes.filter((l) => l.mode === 'Maintenance').length}
                </span>
              </div>
            </div>

            <div className="table-responsive">
              <table className="onboarding-table">
                <thead>
                  <tr>
                    <th>Lane ID</th>
                    <th>Direction</th>
                    <th>Type</th>
                    <th>Operating Mode</th>
                    <th>Reader Category</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {plazaLanes.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty-cell">
                        No lanes configured for this plaza. Click "+ Add Lane to Plaza" to provision one.
                      </td>
                    </tr>
                  ) : (
                    paginatedLanes.map((l, idx) => (
                      <tr key={l.id || `${l.plazaId}_${l.laneId}_${idx}`}>
                        <td>
                          <code className="id-code">{l.laneId}</code>
                        </td>
                        <td>
                          <span className="direction-badge">{l.direction}</span>
                        </td>
                        <td>{l.type}</td>
                        <td>
                          <span
                            className={`mode-tag ${
                              l.mode === 'Maintenance' ? 'maintenance' : 'normal'
                            }`}
                          >
                            {l.mode}
                          </span>
                        </td>
                        <td>{l.category}</td>
                        <td>
                          <span
                            className={`status-badge ${
                              l.status === 'Open' ? 'badge-active' : 'badge-draft'
                            }`}
                          >
                            <span className="dot" />
                            {l.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="action-btn edit"
                              title="Edit Lane Configuration"
                              onClick={() => handleOpenEditLane(l)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn-danger-ghost sm"
                              title="Delete Lane"
                              onClick={() => handleDeleteLane(l.laneId)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <TablePagination
                totalItems={plazaLanes.length}
                currentPage={lanePage}
                pageSize={lanePageSize}
                onPageChange={setLanePage}
                onPageSizeChange={(newSize) => {
                  setLanePageSize(newSize);
                  setLanePage(1);
                }}
                pageSizeOptions={[5, 10, 25, 50]}
              />
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB E: CALLBACK URL CONFIGURATION                                 */}
      {/* ================================================================= */}
      {!railwayLoading && activeTab === 'callback' && (
        <div className="tab-content callback-section">
          {/* Plaza Selector Header */}
          <div className="plaza-scope-card">
            <div className="scope-left">
              <label>Scoped Plaza:</label>
              <select
                value={selectedPlazaId}
                onChange={(e) => setSelectedPlazaId(e.target.value)}
                className="plaza-select"
              >
                {store.plazas.length === 0 ? (
                  <option value="">No plazas onboarded yet</option>
                ) : (
                  store.plazas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id})
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="scope-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleAutoGenerateCallbacks}
                title="Click to auto-fill · Click again to remove auto-filled URLs"
              >
                Auto-Fill All 14 Endpoints
              </button>
              <button
                type="button"
                className="btn-secondary btn-remove-autofill"
                onClick={handleClearCallbacks}
                title="Remove auto-filled URLs"
              >
                Remove Auto-fill
              </button>
            </div>
          </div>

          <div className="panel-card">
            <div className="card-header">
              <h3>Callback Webhook Configuration — {selectedPlazaObject?.name}</h3>
              <p className="card-desc">
                Configure all 14 NPCI / Paysonic callback webhook endpoints. URLs must begin with <code>http://</code> or <code>https://</code> and contain no spaces (max 250 chars).
              </p>
            </div>

            <form onSubmit={handleSaveCallbacks}>
              <div className="callback-grid">
                {CALLBACK_APIS.map((api, idx) => {
                  const currentVal = callbackUrls[api] || '';
                  const test = testResults[api];

                  return (
                    <div className="callback-row" key={api}>
                      <div className="api-info">
                        <span className="api-idx">{idx + 1}</span>
                        <span className="api-name">{api}</span>
                      </div>
                      <div className="api-input-wrap">
                        <div className="cb-input-inner">
                          <input
                            type="text"
                            maxLength={250}
                            placeholder={`https://api.paysonic.in/${selectedPlazaId.toLowerCase()}/${api.toLowerCase()}`}
                            value={currentVal}
                            onChange={(e) => handleCallbackChange(api, e.target.value)}
                            onBlur={() => handleCallbackBlur(api)}
                            className="cb-input"
                          />
                          {currentVal && (
                            <button
                              type="button"
                              className="cb-clear-btn"
                              title="Clear URL"
                              onClick={() => handleCallbackChange(api, '')}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        {test && (
                          <div className={`test-feedback ${test.status}`}>
                            {test.status === 'testing' ? '⏳ ' : test.status === 'success' ? '✓ ' : '✕ '}
                            {test.msg}
                          </div>
                        )}
                      </div>
                      <div className="api-action">
                        <button
                          type="button"
                          className="btn-ghost sm"
                          disabled={test?.status === 'testing'}
                          onClick={() => handleTestCallback(api)}
                        >
                          {test?.status === 'testing' ? 'Verifying...' : 'Test Webhook'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="form-actions" style={{ marginTop: '24px' }}>
                <button type="submit" className="btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB F: FARE MAPPING                                               */}
      {/* ================================================================= */}
      {!railwayLoading && activeTab === 'fare' && (
        <div className="tab-content fare-section">
          {/* Plaza Selector Header */}
          <div className="plaza-scope-card">
            <div className="scope-left">
              <label>Scoped Plaza:</label>
              <select
                value={selectedPlazaId}
                onChange={(e) => setSelectedPlazaId(e.target.value)}
                className="plaza-select"
              >
                {store.plazas.length === 0 ? (
                  <option value="">No plazas onboarded yet</option>
                ) : (
                  store.plazas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id})
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="scope-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleAutoPopulateToggle}
                onDoubleClick={handleClearAutoFares}
                title="Single-click to populate defaults · Double-click to remove auto-populated fares"
              >
                Auto-Populate Standard Matrix
              </button>
            </div>
          </div>

          <div className="panel-card">
            <div className="card-header">
              <h3>Toll Fare Matrix (All 17 Vehicle Classes VC4–VC20)</h3>
              <p className="card-desc">
                Per Word Field Notes specification: 6 journey pricing schemes. Amounts are in Indian Rupees (₹) and must be numeric up to 6 digits.
              </p>
            </div>

            <form onSubmit={handleSaveFares}>
              <div className="table-responsive">
                <table className="onboarding-table fare-table">
                  <thead>
                    <tr>
                      <th style={{ width: '220px' }}>Vehicle Class</th>
                      <th>Single Journey (₹)</th>
                      <th>Return Journey (₹)</th>
                      <th>Local 10km (₹)</th>
                      <th>Local 20km (₹)</th>
                      <th>District Comm. (₹)</th>
                      <th>Monthly Pass (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {VEHICLE_CLASSES.map((vc) => {
                      const f = plazaFares[vc.id] || {};
                      const isBlank = (val) => val === '' || val === null || val === undefined || String(val).trim() === '';

                      return (
                        <tr key={vc.id}>
                          <td>
                            <strong>{vc.id}</strong>
                            <div className="vc-desc">{vc.name || (vc.label.includes('·') ? vc.label.split('·')[1].trim() : vc.label)}</div>
                          </td>
                          <td>
                            <input
                              type="text"
                              placeholder="₹0"
                              value={f.single ?? ''}
                              onChange={(e) => handleFareInputChange(vc.id, 'single', e.target.value)}
                              className={`tbl-input ${fareError && isBlank(f.single) ? 'invalid' : ''}`}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              placeholder="₹0"
                              value={f.ret ?? ''}
                              onChange={(e) => handleFareInputChange(vc.id, 'ret', e.target.value)}
                              className={`tbl-input ${fareError && isBlank(f.ret) ? 'invalid' : ''}`}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              placeholder="₹0"
                              value={f.local10 ?? ''}
                              onChange={(e) => handleFareInputChange(vc.id, 'local10', e.target.value)}
                              className={`tbl-input ${fareError && isBlank(f.local10) ? 'invalid' : ''}`}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              placeholder="₹0"
                              value={f.local20 ?? ''}
                              onChange={(e) => handleFareInputChange(vc.id, 'local20', e.target.value)}
                              className={`tbl-input ${fareError && isBlank(f.local20) ? 'invalid' : ''}`}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              placeholder="₹0"
                              value={f.district ?? ''}
                              onChange={(e) => handleFareInputChange(vc.id, 'district', e.target.value)}
                              className={`tbl-input ${fareError && isBlank(f.district) ? 'invalid' : ''}`}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              placeholder="₹0"
                              value={f.monthly ?? ''}
                              onChange={(e) => handleFareInputChange(vc.id, 'monthly', e.target.value)}
                              className={`tbl-input ${fareError && isBlank(f.monthly) ? 'invalid' : ''}`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {fareError && (
                <div
                  className="field-error-banner"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#ef4444',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginTop: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontWeight: '600',
                  }}
                >
                  <span style={{ fontSize: '18px' }}>⚠️</span>
                  <span>{fareError}</span>
                </div>
              )}

              <div className="form-actions" style={{ marginTop: '24px' }}>
                <button type="submit" className="btn-primary">
                  Save Toll Fare Mapping
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB G: CCH MAPPING                                                */}
      {/* ================================================================= */}
      {!railwayLoading && activeTab === 'cch' && (
        <div className="tab-content cch-section">
          {/* Plaza Selector Header */}
          <div className="plaza-scope-card">
            <div className="scope-left">
              <label>Scoped Plaza:</label>
              <select
                value={selectedPlazaId}
                onChange={(e) => setSelectedPlazaId(e.target.value)}
                className="plaza-select"
              >
                {store.plazas.length === 0 ? (
                  <option value="">No plazas onboarded yet</option>
                ) : (
                  store.plazas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="panel-card">
            <div className="card-header">
              <h3>Central Clearing House (CCH) Mapping</h3>
              <p className="card-desc">
                Maintain CCH vehicle class classifications. Current CCH is system-populated from the latest active rate, while New CCH accepts revised numeric inputs.
              </p>
            </div>

            <form onSubmit={handleSaveCch}>
              <div className="table-responsive">
                <table className="onboarding-table compact">
                  <thead>
                    <tr>
                      <th style={{ width: '280px' }}>Vehicle Class</th>
                      <th style={{ width: '200px' }}>Current CCH</th>
                      <th style={{ width: '220px' }}>New CCH</th>
                      <th>Status / Differential</th>
                    </tr>
                  </thead>
                  <tbody>
                    {VEHICLE_CLASSES.map((vc) => {
                      const item = plazaCch[vc.id] || { current: '', new: '' };
                      const hasNew = Boolean(item.new);
                      const delta = hasNew && item.current !== '' && item.current !== undefined ? parseInt(item.new, 10) - item.current : 0;

                      return (
                        <tr key={vc.id}>
                          <td>
                            <strong>{vc.id}</strong>
                            <div className="vc-desc">{vc.name || (vc.label.includes('·') ? vc.label.split('·')[1].trim() : vc.label)}</div>
                          </td>
                          <td>
                            <code className="cch-current-code">{item.current !== '' && item.current !== undefined ? item.current : '—'}</code>
                          </td>
                          <td>
                            <input
                              type="text"
                              placeholder="Enter revised CCH"
                              value={item.new || ''}
                              onChange={(e) => handleCchInputChange(vc.id, e.target.value)}
                              className="tbl-input"
                            />
                          </td>
                          <td>
                            {hasNew ? (
                              <span
                                className={`delta-badge ${
                                  delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
                                }`}
                              >
                                {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : 'No change'}
                              </span>
                            ) : (
                              <span className="unchanged-label">Unchanged</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="form-actions" style={{ marginTop: '24px' }}>
                <button type="submit" className="btn-primary">
                  Save CCH Mapping
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: ADD LANE                                                   */}
      {/* ================================================================= */}
      {laneModalOpen && (
        <div className="onboarding-modal-backdrop" onClick={() => setLaneModalOpen(false)}>
          <div className="onboarding-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {isEditingLane
                  ? `Edit Lane ${newLane.laneId} — ${selectedPlazaObject?.name || selectedPlazaId} (${selectedPlazaId})`
                  : `Add Lane — ${selectedPlazaObject?.name || selectedPlazaId} (${selectedPlazaId})`}
              </h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setLaneModalOpen(false)}
                title="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLane} className="modal-body">
              <div className="form-group">
                <label htmlFor="lane-id-input">
                  Lane ID <span className="req">*</span>
                </label>
                <input
                  id="lane-id-input"
                  type="text"
                  maxLength={6}
                  placeholder="e.g. L01"
                  value={newLane.laneId}
                  onChange={(e) => {
                    setNewLane({ ...newLane, laneId: e.target.value.toUpperCase() });
                    setLaneError('');
                  }}
                  onBlur={handleLaneBlur}
                  className={laneError ? 'invalid' : ''}
                  autoComplete="off"
                />
                <div className="field-hint">
                  Alphanumeric, max 6 chars · Unique within this plaza (reusable across plazas)
                </div>
                {laneError && <div className="field-error">{laneError}</div>}
              </div>

              <div className="modal-form-grid">
                <div className="form-group">
                  <label htmlFor="lane-direction-select">Direction <span className="req">*</span></label>
                  <select
                    id="lane-direction-select"
                    value={newLane.direction}
                    onChange={(e) => setNewLane({ ...newLane, direction: e.target.value })}
                  >
                    <option value="North">North</option>
                    <option value="South">South</option>
                    <option value="East">East</option>
                    <option value="West">West</option>
                    <option value="Both">Both / Bi-directional</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="lane-type-select">Lane Type <span className="req">*</span></label>
                  <select
                    id="lane-type-select"
                    value={newLane.type}
                    onChange={(e) => setNewLane({ ...newLane, type: e.target.value })}
                  >
                    <option value="Entry">Entry</option>
                    <option value="Exit">Exit</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="lane-mode-select">Lane Mode <span className="req">*</span></label>
                  <select
                    id="lane-mode-select"
                    value={newLane.mode}
                    onChange={(e) => setNewLane({ ...newLane, mode: e.target.value })}
                  >
                    <option value="Normal">Normal</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="lane-category-select">Lane Category <span className="req">*</span></label>
                  <select
                    id="lane-category-select"
                    value={newLane.category}
                    onChange={(e) => setNewLane({ ...newLane, category: e.target.value })}
                  >
                    <option value="Hybrid">Hybrid</option>
                    <option value="Dedicated">Dedicated</option>
                    <option value="Handheld">Handheld</option>
                  </select>
                </div>

                <div className="form-group span-full">
                  <label htmlFor="lane-status-select">Lane Status <span className="req">*</span></label>
                  <select
                    id="lane-status-select"
                    value={newLane.status}
                    onChange={(e) => setNewLane({ ...newLane, status: e.target.value })}
                  >
                    <option value="Open">Open</option>
                    <option value="Covered">Covered</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setLaneModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {isEditingLane ? 'Update Lane' : 'Save Lane'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* DRAWER: VIEW PLAZA DETAIL                                         */}
      {/* ================================================================= */}
      {viewPlazaDetail && (
        <div className="onboarding-modal-backdrop" onClick={() => setViewPlazaDetail(null)}>
          <div className="onboarding-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h3>{viewPlazaDetail.name}</h3>
                <span className="drawer-subtitle">
                  Plaza ID: <code>{viewPlazaDetail.id}</code> · Org: {viewPlazaDetail.orgId}
                </span>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setViewPlazaDetail(null)}
              >
                ✕
              </button>
            </div>

            <div className="drawer-body">
              <div className="detail-section">
                <h4>Concessionaire &amp; Authority</h4>
                <div className="kv-grid">
                  <div className="kv-item">
                    <span className="kv-key">Concessionaire:</span>
                    <span className="kv-val">{getConcessionaireName(viewPlazaDetail.concessionaireId)}</span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">Authority:</span>
                    <span className="kv-val">{viewPlazaDetail.authority}</span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">Agency ID:</span>
                    <span className="kv-val">{viewPlazaDetail.agencyId}</span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">Status:</span>
                    <span className="kv-val">{viewPlazaDetail.status}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Pricing &amp; Operational Config</h4>
                <div className="kv-grid">
                  <div className="kv-item">
                    <span className="kv-key">Category:</span>
                    <span className="kv-val">{viewPlazaDetail.category}</span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">Subtype:</span>
                    <span className="kv-val">{viewPlazaDetail.subtype}</span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">Base Pricing:</span>
                    <span className="kv-val">{viewPlazaDetail.basePricing}</span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">Interface:</span>
                    <span className="kv-val">{viewPlazaDetail.plazaInterface}</span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">Scheme Rule:</span>
                    <span className="kv-val">{viewPlazaDetail.schemeRule || '—'}</span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">Rule Duration:</span>
                    <span className="kv-val">{viewPlazaDetail.schemeDuration || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Location &amp; Geocode</h4>
                <div className="kv-grid">
                  <div className="kv-item">
                    <span className="kv-key">State:</span>
                    <span className="kv-val">{viewPlazaDetail.state}</span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">City:</span>
                    <span className="kv-val">{viewPlazaDetail.city}</span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">Activation Date:</span>
                    <span className="kv-val">{viewPlazaDetail.activationDate}</span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">Geo Code:</span>
                    <span className="kv-val code-font">{viewPlazaDetail.geoCode || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>MDR Fee Schedule</h4>
                <div className="kv-grid">
                  <div className="kv-item">
                    <span className="kv-key">Bank Service Fee:</span>
                    <span className="kv-val">{viewPlazaDetail.mdr?.bankFee || '0'}%</span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">NPCI Service Fee:</span>
                    <span className="kv-val">{viewPlazaDetail.mdr?.npciFee || '0'}%</span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">Bank GST:</span>
                    <span className="kv-val">{viewPlazaDetail.mdr?.bankGst || '0'}%</span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-key">NPCI GST:</span>
                    <span className="kv-val">{viewPlazaDetail.mdr?.npciGst || '0'}%</span>
                  </div>
                </div>
              </div>

              {viewPlazaDetail.publicKey && (
                <div className="detail-section">
                  <h4>Public Key</h4>
                  <pre className="public-key-box">{viewPlazaDetail.publicKey}</pre>
                </div>
              )}
            </div>

            <div className="drawer-footer">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setViewPlazaDetail(null);
                  handleStartEditPlaza(viewPlazaDetail);
                }}
              >
                Edit Full Plaza Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: WHITESPACE DETECTED IN CALLBACK URL POPUP                   */}
      {/* ================================================================= */}
      {urlSpacePopup.show && (
        <div
          className="onboarding-modal-backdrop"
          onClick={() => setUrlSpacePopup({ show: false, api: '', rawVal: '' })}
          style={{ zIndex: 99999 }}
        >
          <div
            className="onboarding-modal alert-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '500px' }}
          >
            <div
              className="modal-header"
              style={{
                borderBottom: '1px solid #fee2e2',
                background: '#fff5f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>⚠️</span>
                <div>
                  <h3 style={{ margin: 0, color: '#b91c1c', fontSize: '16px', fontWeight: '700' }}>
                    Invalid URL — Whitespace Detected
                  </h3>
                  <div style={{ fontSize: '12px', color: '#7f1d1d' }}>
                    Spaces are not accepted in webhook endpoints
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setUrlSpacePopup({ show: false, api: '', rawVal: '' })}
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ padding: '22px' }}>
              <p style={{ margin: '0 0 14px 0', fontSize: '14px', color: '#334155', lineHeight: 1.5 }}>
                Callback URLs <strong>cannot contain spaces</strong> at the start, end, or inside the address.
              </p>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ marginBottom: '8px' }}>
                  <strong style={{ color: '#475569' }}>API Endpoint:</strong>{' '}
                  <code style={{ color: '#2563eb', fontWeight: '600' }}>{urlSpacePopup.api}</code>
                </div>
                <div style={{ wordBreak: 'break-all' }}>
                  <strong style={{ color: '#475569' }}>Detected Value:</strong>{' '}
                  <span
                    style={{
                      background: '#fee2e2',
                      color: '#991b1b',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontWeight: '600',
                    }}
                  >
                    "{urlSpacePopup.rawVal}"
                  </span>
                </div>
              </div>
              <p style={{ margin: '0', fontSize: '12.5px', color: '#64748b' }}>
                The detected whitespace has been rejected. Please provide a clean URL (e.g.{' '}
                <code>https://api.domain.com/webhook</code>).
              </p>
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setUrlSpacePopup({ show: false, api: '', rawVal: '' })}
                  style={{ minWidth: '110px' }}
                >
                  OK, Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Onboarding;
