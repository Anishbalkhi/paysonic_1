import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import OnboardingService from '../../services/onboarding/OnboardingService';
import './Onboarding.scss';

// Vehicle classes VC4 through VC20
const VEHICLE_CLASSES = [
  { id: 'VC4', label: 'VC4 · Car / Jeep / Van' },
  { id: 'VC5', label: 'VC5 · Light Commercial Vehicle (LCV)' },
  { id: 'VC6', label: 'VC6 · Bus 2-Axle' },
  { id: 'VC7', label: 'VC7 · Truck 2-Axle' },
  { id: 'VC8', label: 'VC8 · 3-Axle Commercial' },
  { id: 'VC9', label: 'VC9 · Multi Axle (4-6 Axle)' },
  { id: 'VC10', label: 'VC10 · Oversized (7+ Axle)' },
  { id: 'VC11', label: 'VC11 · Heavy Construction Equipment' },
  { id: 'VC12', label: 'VC12 · Earth Moving Machinery' },
  { id: 'VC13', label: 'VC13 · Specialized Multi-Axle' },
  { id: 'VC14', label: 'VC14 · Tractor with Trailer' },
  { id: 'VC15', label: 'VC15 · Emergency & Escort Class' },
  { id: 'VC16', label: 'VC16 · Commercial Passenger Maxi' },
  { id: 'VC17', label: 'VC17 · Mini Bus / Shuttle' },
  { id: 'VC18', label: 'VC18 · Auto Rickshaw (Commercial)' },
  { id: 'VC19', label: 'VC19 · Two Wheeler (Exempt/Spec)' },
  { id: 'VC20', label: 'VC20 · Defense & Exempt Protocol' },
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

const STORAGE_KEY = 'paysonic_onboarding_data_v2';

// Clean initial data structure — stores only original data created or fetched
const getInitialData = () => ({
  concessionaires: [],
  plazas: [],
  lanes: [],
  callbacks: {},
  fares: {},
  cch: {},
});

export const Onboarding = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Tab management
  const activeTab = searchParams.get('tab') || 'view';
  const setTab = (tab) => {
    setSearchParams({ tab });
  };

  // Main persistent state — seeded from localStorage, then hydrated from Railway
  const [store, setStore] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse onboarding storage:', e);
    }
    return getInitialData();
  });

  // ── Railway hydration on mount ─────────────────────────────────────────────
  // Load plazas & concessionaires from Railway backend, merge with local seed data.
  const [railwayLoading, setRailwayLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setRailwayLoading(true);
    OnboardingService.loadFullStore(store)
      .then((hydrated) => {
        if (!isMounted) return;
        if (hydrated && hydrated.plazas && hydrated.plazas.length > 0) {
          setStore((prev) => ({
            ...prev,
            ...hydrated,
            source: hydrated.source || 'LIVE_BACKEND_DB',
            _liveDb: true,
          }));
        }
      })
      .catch((err) => {
        console.warn('[Onboarding] Railway hydration failed, using localStorage:', err?.message);
      })
      .finally(() => {
        if (isMounted) setRailwayLoading(false);
      });
    return () => { isMounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync store to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
      console.error('Failed to save onboarding store:', e);
    }
  }, [store]);

  // Toast notifications
  const [toast, setToast] = useState({ show: false, msg: '', type: 'info' });
  const showToast = (msg, type = 'info') => {
    setToast({ show: true, msg, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3200);
  };

  // Plaza scoped selectors (shared for Lanes, Callback, Fare, CCH)
  const [selectedPlazaId, setSelectedPlazaId] = useState(() => {
    return store.plazas[0]?.id || '';
  });

  useEffect(() => {
    if (!selectedPlazaId && store.plazas.length > 0) {
      setSelectedPlazaId(store.plazas[0].id);
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

  const kpis = useMemo(() => {
    const total = store.plazas.length;
    const active = store.plazas.filter((p) => p.status === 'Active').length;
    const pending = store.plazas.filter((p) => p.status === 'Pending Approval').length;
    const draft = store.plazas.filter((p) => p.status === 'Draft').length;
    const suspended = store.plazas.filter((p) => p.status === 'Suspended').length;
    return { total, active, pending, draft, suspended };
  }, [store.plazas]);

  // =========================================================================
  // SUBMODULE 2: ADD CONCESSIONAIRE
  // =========================================================================
  const [concessForm, setConcessForm] = useState({
    name: '',
    address: '',
    mail: '',
    contact: '',
  });
  const [concessErrors, setConcessErrors] = useState({});

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

  const handleConcessChange = (field, val) => {
    setConcessForm((prev) => ({ ...prev, [field]: val }));
    if (concessErrors[field]) {
      setConcessErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleSaveConcessionaire = (e) => {
    e.preventDefault();
    const errors = {};
    const name = concessForm.name.trim().toUpperCase();
    const address = concessForm.address.trim().toUpperCase();
    const mail = concessForm.mail.trim();
    const contact = concessForm.contact.trim();

    if (!name) errors.name = 'Concessionaire Name is required';
    else if (!/^[A-Z0-9 &.,-]{1,100}$/.test(name)) {
      errors.name = 'Alphabets, numbers, spaces, &, ., - allowed · max 100 chars';
    }

    if (!address) errors.address = 'Address is required';
    else if (!/^[A-Z0-9 ,.\-/#]{1,250}$/.test(address)) {
      errors.address = 'Alphanumeric + , . - / # allowed · max 250 chars';
    }

    if (!mail) errors.mail = 'Mail ID is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      errors.mail = 'Enter a valid email address';
    } else if (store.concessionaires.some((c) => c.mail.toLowerCase() === mail.toLowerCase())) {
      errors.mail = 'This mail ID is already registered for another concessionaire';
    }

    if (!contact) errors.contact = 'Contact No is required';
    else if (!/^\d{10}$/.test(contact)) {
      errors.contact = 'Contact No must be exactly 10 digits';
    }

    if (Object.keys(errors).length > 0) {
      setConcessErrors(errors);
      showToast('Please fix the highlighted errors', 'error');
      return;
    }

    const newConcess = {
      id: nextConcessionaireId,
      name,
      address,
      mail,
      contact,
    };

    // Optimistic update
    setStore((prev) => ({
      ...prev,
      concessionaires: [...prev.concessionaires, newConcess],
    }));

    setConcessForm({ name: '', address: '', mail: '', contact: '' });
    setConcessErrors({});
    showToast(`Concessionaire ${newConcess.name} (${newConcess.id}) successfully created!`, 'success');

    // Railway API + audit (fire-and-forget — UI already updated)
    OnboardingService.saveConcessionaire(newConcess, {
      actor: currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role, ipAddress: '127.0.0.1' } : undefined,
    }).then((res) => {
      if (res._savedOnRailway) {
        showToast(`✓ ${newConcess.name} synced to Railway backend`, 'success');
      }
    }).catch(() => {
      // localStorage already saved — fail silently
    });
  };

  // =========================================================================
  // SUBMODULE 3: ADD / EDIT PLAZA
  // =========================================================================
  const [isEditingPlaza, setIsEditingPlaza] = useState(false);
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
    setPlazaForm({
      ...p,
      mdr: p.mdr || { bankFee: '0.90', npciFee: '0.15', bankGst: '18', npciGst: '18' },
    });
    setPlazaErrors({});
    setTab('addplaza');
  };

  const handleResetPlazaForm = () => {
    setIsEditingPlaza(false);
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

  const handlePlazaChange = (field, val) => {
    setPlazaForm((prev) => ({ ...prev, [field]: val }));
    if (plazaErrors[field]) {
      setPlazaErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handlePlazaMdrChange = (field, val) => {
    setPlazaForm((prev) => ({
      ...prev,
      mdr: { ...prev.mdr, [field]: val },
    }));
  };

  const handleSavePlaza = (e) => {
    e.preventDefault();
    const errors = {};

    const concess = plazaForm.concessionaireId;
    const name = (plazaForm.name || '').trim().toUpperCase();
    const id = (plazaForm.id || '').trim();
    const orgId = (plazaForm.orgId || '').trim().toUpperCase();
    const agencyId = (plazaForm.agencyId || '').trim().toUpperCase();
    const state = (plazaForm.state || '').trim().toUpperCase();
    const city = (plazaForm.city || '').trim().toUpperCase();
    const activationDate = plazaForm.activationDate;
    const geoCode = (plazaForm.geoCode || '').trim();
    const pubKey = (plazaForm.publicKey || '').trim();
    const contactNo = (plazaForm.contactNo || '').trim();
    const contactMail = (plazaForm.contactMail || '').trim();

    if (!concess) errors.concessionaireId = 'Please select a Concessionaire';
    if (!name) errors.name = 'Plaza Name is required';
    else if (!/^[A-Z0-9 -]{1,100}$/.test(name)) {
      errors.name = 'Alphanumeric, - and spaces only · max 100 chars';
    }

    if (!id) errors.id = 'Plaza ID is required';
    else if (!/^\d{6}$/.test(id)) {
      errors.id = 'Plaza ID must be exactly 6 digits';
    } else if (!isEditingPlaza && store.plazas.some((p) => p.id === id)) {
      errors.id = 'This Plaza ID is already onboarded on the network';
    }

    if (!orgId) errors.orgId = 'Org ID is required';
    else if (!/^[A-Z]{4}$/.test(orgId)) {
      errors.orgId = 'Alphabetical only · exactly 4 letters';
    }

    if (!agencyId) errors.agencyId = 'Agency ID is required';
    else if (!/^[A-Z0-9]{5}$/.test(agencyId)) {
      errors.agencyId = 'Alphabetical/Alphanumeric only · exactly 5 characters';
    }

    if (!state) errors.state = 'State is required';
    if (!city) errors.city = 'City is required';
    if (!activationDate) errors.activationDate = 'Plaza Activation Date is required';

    if (geoCode && !/^-?\d{1,3}\.\d+,-?\d{1,3}\.\d+$/.test(geoCode)) {
      errors.geoCode = 'Format must be Latitude,Longitude (e.g. 19.9975,73.7898)';
    }

    if (pubKey.length > 5000) {
      errors.publicKey = 'Max 5000 characters allowed';
    }

    if (contactNo && !/^\d{10}$/.test(contactNo)) {
      errors.contactNo = 'Contact number must be 10 digits';
    }

    if (contactMail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactMail)) {
      errors.contactMail = 'Enter a valid email address';
    }

    if (Object.keys(errors).length > 0) {
      setPlazaErrors(errors);
      showToast('Please fix the highlighted plaza errors', 'error');
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

    // Optimistic store update
    setStore((prev) => {
      let updatedPlazas = [...prev.plazas];
      const existingIdx = updatedPlazas.findIndex((p) => p.id === id);

      if (existingIdx >= 0) {
        updatedPlazas[existingIdx] = savedPlaza;
      } else {
        updatedPlazas.push(savedPlaza);
      }

      // Initialize callbacks, fares, and cch if not present
      const newCallbacks = { ...prev.callbacks };
      if (!newCallbacks[id]) {
        newCallbacks[id] = {};
        CALLBACK_APIS.forEach((api) => {
          newCallbacks[id][api] = `https://api.paysonic.in/${id.toLowerCase()}/${api.toLowerCase()}`;
        });
      }

      const newFares = { ...prev.fares };
      if (!newFares[id]) {
        newFares[id] = {};
        VEHICLE_CLASSES.forEach((vc, i) => {
          const base = 50 + i * 25;
          newFares[id][vc.id] = {
            single: base,
            ret: Math.round(base * 1.5),
            local10: Math.round(base * 0.4),
            local20: Math.round(base * 0.6),
            district: Math.round(base * 20),
            monthly: Math.round(base * 40),
          };
        });
      }

      const newCch = { ...prev.cch };
      if (!newCch[id]) {
        newCch[id] = {};
        VEHICLE_CLASSES.forEach((vc, i) => {
          newCch[id][vc.id] = { current: 100 + i * 5, new: '' };
        });
      }

      return {
        ...prev,
        plazas: updatedPlazas,
        callbacks: newCallbacks,
        fares: newFares,
        cch: newCch,
      };
    });

    showToast(`Plaza ${savedPlaza.name} (${savedPlaza.id}) saved with status ${savedPlaza.status}`, 'success');
    handleResetPlazaForm();
    setTab('view');

    // Railway API + audit (fire-and-forget)
    OnboardingService.savePlaza(savedPlaza, {
      isEdit: isEditingPlaza,
      actor: currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role, ipAddress: '127.0.0.1' } : undefined,
    }).then((res) => {
      if (res._savedOnRailway) {
        showToast(`✓ Plaza ${savedPlaza.name} synced to Railway backend`, 'success');
      }
    }).catch(() => {});
  };

  // =========================================================================
  // SUBMODULE 4: LANE DETAILS
  // =========================================================================
  const [laneModalOpen, setLaneModalOpen] = useState(false);
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

  const handleOpenAddLane = () => {
    if (!selectedPlazaId) {
      showToast('Please select a plaza first', 'error');
      return;
    }
    const defaultSuffix = String(plazaLanes.length + 1).padStart(2, '0');
    setNewLane({
      laneId: `L${selectedPlazaId.slice(-3)}${defaultSuffix}`,
      direction: 'North',
      type: 'Entry',
      mode: 'Normal',
      category: 'Hybrid',
      status: 'Open',
    });
    setLaneError('');
    setLaneModalOpen(true);
  };

  const handleSaveLane = (e) => {
    e.preventDefault();
    const laneId = newLane.laneId.trim().toUpperCase();

    if (!laneId) {
      setLaneError('Lane ID is required');
      return;
    }
    if (!/^[A-Z0-9]{1,6}$/.test(laneId)) {
      setLaneError('Alphanumeric only, no spaces · max 6 characters');
      return;
    }
    if (store.lanes.some((l) => l.laneId === laneId)) {
      setLaneError(`Lane ID ${laneId} already exists across the network`);
      return;
    }

    const laneRecord = {
      ...newLane,
      plazaId: selectedPlazaId,
      laneId,
    };

    // Optimistic update
    setStore((prev) => ({
      ...prev,
      lanes: [...prev.lanes, laneRecord],
    }));

    setLaneModalOpen(false);
    showToast(`Lane ${laneId} added to Plaza ${selectedPlazaId}`, 'success');

    // Railway API + audit
    OnboardingService.saveLane(laneRecord, {
      actor: currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role, ipAddress: '127.0.0.1' } : undefined,
    }).then((res) => {
      if (res._savedOnRailway) {
        showToast(`✓ Lane ${laneId} synced to Railway backend`, 'success');
      }
    }).catch(() => {});
  };

  const handleDeleteLane = (laneId) => {
    if (window.confirm(`Are you sure you want to remove Lane ${laneId}?`)) {
      // Optimistic update
      setStore((prev) => ({
        ...prev,
        lanes: prev.lanes.filter((l) => l.laneId !== laneId),
      }));
      showToast(`Lane ${laneId} removed`, 'info');

      // Railway API + audit
      OnboardingService.deleteLane(laneId, selectedPlazaId, {
        actor: currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role, ipAddress: '127.0.0.1' } : undefined,
      }).catch(() => {});
    }
  };

  // =========================================================================
  // SUBMODULE 5: CALLBACK URL CONFIGURATION
  // =========================================================================
  const [callbackUrls, setCallbackUrls] = useState({});
  const [testResults, setTestResults] = useState({});

  useEffect(() => {
    if (selectedPlazaId && store.callbacks[selectedPlazaId]) {
      setCallbackUrls({ ...store.callbacks[selectedPlazaId] });
      setTestResults({});
    } else {
      setCallbackUrls({});
      setTestResults({});
    }
  }, [selectedPlazaId, store.callbacks]);

  const handleCallbackChange = (api, val) => {
    setCallbackUrls((prev) => ({ ...prev, [api]: val }));
  };

  const handleTestCallback = (api) => {
    const url = (callbackUrls[api] || '').trim();
    if (!url) {
      setTestResults((prev) => ({ ...prev, [api]: { status: 'error', msg: 'Empty URL' } }));
      showToast(`${api}: No URL provided to test`, 'error');
      return;
    }
    if (!/^https?:\/\/\S{3,250}$/.test(url)) {
      setTestResults((prev) => ({ ...prev, [api]: { status: 'error', msg: 'Invalid URL format' } }));
      showToast(`${api}: Must start with http:// or https:// and contain no spaces`, 'error');
      return;
    }

    setTestResults((prev) => ({ ...prev, [api]: { status: 'testing', msg: 'Pinging...' } }));
    setTimeout(() => {
      setTestResults((prev) => ({
        ...prev,
        [api]: { status: 'success', msg: '200 OK · Handshake Verified' },
      }));
      showToast(`${api}: Connection handshake verified (Mock 200 OK)`, 'success');
    }, 450);
  };

  const handleAutoGenerateCallbacks = () => {
    if (!selectedPlazaId) return;
    const generated = {};
    CALLBACK_APIS.forEach((api) => {
      generated[api] = `https://api.paysonic.in/v1/plazas/${selectedPlazaId.toLowerCase()}/${api.toLowerCase()}`;
    });
    setCallbackUrls(generated);
    showToast('Auto-generated endpoint paths for all 14 APIs', 'info');
  };

  const handleSaveCallbacks = (e) => {
    e.preventDefault();
    if (!selectedPlazaId) {
      showToast('Select a plaza first', 'error');
      return;
    }

    let invalidCount = 0;
    Object.entries(callbackUrls).forEach(([api, url]) => {
      const u = (url || '').trim();
      if (u && !/^https?:\/\/\S{3,250}$/.test(u)) {
        invalidCount++;
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

    showToast(`Saved 14 Callback URLs for Plaza ${selectedPlazaId}`, 'success');

    // Railway API + audit
    OnboardingService.saveCallbacks(selectedPlazaId, callbackUrls, {
      actor: currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role, ipAddress: '127.0.0.1' } : undefined,
    }).then((res) => {
      if (res._savedOnRailway) {
        showToast(`✓ Callback URLs for Plaza ${selectedPlazaId} synced to Railway`, 'success');
      }
    }).catch(() => {});
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

  const handleFareInputChange = (vcId, journeyType, val) => {
    // Only numbers allowed, max 6 digits
    if (val && !/^\d{0,6}$/.test(val)) return;
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

    // Optimistic update
    setStore((prev) => ({
      ...prev,
      fares: {
        ...prev.fares,
        [selectedPlazaId]: plazaFares,
      },
    }));

    showToast(`Fare mapping successfully saved for Plaza ${selectedPlazaId}`, 'success');

    // Railway API + audit
    OnboardingService.saveFares(selectedPlazaId, plazaFares, {
      actor: currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role, ipAddress: '127.0.0.1' } : undefined,
    }).then((res) => {
      if (res._savedOnRailway) {
        showToast(`✓ Fare mapping for Plaza ${selectedPlazaId} synced to Railway`, 'success');
      }
    }).catch(() => {});
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
        ...(prev[vcId] || { current: 100, new: '' }),
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
      const item = plazaCch[vc.id] || { current: 100, new: '' };
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

    showToast(`CCH mapping saved and applied for Plaza ${selectedPlazaId}`, 'success');

    // Railway API + audit
    OnboardingService.saveCch(selectedPlazaId, updated, {
      actor: currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role, ipAddress: '127.0.0.1' } : undefined,
    }).then((res) => {
      if (res._savedOnRailway) {
        showToast(`✓ CCH mapping for Plaza ${selectedPlazaId} synced to Railway`, 'success');
      }
    }).catch(() => {});
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
          <span className="toast-msg">{toast.msg}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="onboarding-header">
        <div className="header-left">
          <div className="badge-row">
            <span className="header-badge">
              <span className="dot" />
              Toll Ops Network Engine
            </span>
            <span className="spec-badge">BRD &amp; Field Spec v1.0</span>
            <span
              className="spec-badge"
              style={{
                background: store.source === 'LIVE_BACKEND_DB' || store._liveDb ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                color: store.source === 'LIVE_BACKEND_DB' || store._liveDb ? '#10b981' : '#3b82f6',
                borderColor: store.source === 'LIVE_BACKEND_DB' || store._liveDb ? 'rgba(16, 185, 129, 0.35)' : 'rgba(59, 130, 246, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: store.source === 'LIVE_BACKEND_DB' || store._liveDb ? '#10b981' : '#3b82f6',
                  display: 'inline-block',
                }}
              />
              {store.source === 'LIVE_BACKEND_DB' || store._liveDb ? 'Source: Real Database (Backend Sync)' : 'Source: Local Storage'}
            </span>
          </div>
          <h1>Plaza Onboarding Module</h1>
          <p className="subtext">
            End-to-end network onboarding: concessionaires, plazas, lane hardware, callback webhooks, fare structures, and CCH matrix.
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              if (window.confirm('Clear all local onboarding records? Only original data will remain.')) {
                const fresh = getInitialData();
                setStore(fresh);
                setSelectedPlazaId('');
                showToast('Cleared all local onboarding records', 'info');
              }
            }}
          >
            ↺ Clear Local Data
          </button>
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
        </div>
      </div>

      {/* BRD Notice Banner */}
      <div className="spec-notice-banner">
        <div className="notice-icon">📋</div>
        <div className="notice-content">
          <strong>Field Specification &amp; Global Rules:</strong> All text inputs are automatically converted and stored in UPPER CASE. Concessionaire IDs (<code>CON-####</code>) and unique 6-digit numeric Plaza IDs are strictly validated. Lane Details, Callback URLs, Fare Mapping, and CCH Mapping are plaza-scoped.
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="module-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'view' ? 'active' : ''}`}
          onClick={() => setTab('view')}
        >
          <span className="tab-idx">A</span>
          <span className="tab-title">View Plaza</span>
          <span className="tab-count">{store.plazas.length}</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'concess' ? 'active' : ''}`}
          onClick={() => setTab('concess')}
        >
          <span className="tab-idx">B</span>
          <span className="tab-title">Add Concessionaire</span>
          <span className="tab-count">{store.concessionaires.length}</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'addplaza' ? 'active' : ''}`}
          onClick={() => setTab('addplaza')}
        >
          <span className="tab-idx">C</span>
          <span className="tab-title">{isEditingPlaza ? 'Edit Plaza' : 'Add Plaza'}</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'lanes' ? 'active' : ''}`}
          onClick={() => setTab('lanes')}
        >
          <span className="tab-idx">D</span>
          <span className="tab-title">Lane Details</span>
          <span className="tab-count">{plazaLanes.length}</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'callback' ? 'active' : ''}`}
          onClick={() => setTab('callback')}
        >
          <span className="tab-idx">E</span>
          <span className="tab-title">Callback URLs</span>
          <span className="tab-count">14</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'fare' ? 'active' : ''}`}
          onClick={() => setTab('fare')}
        >
          <span className="tab-idx">F</span>
          <span className="tab-title">Fare Mapping</span>
          <span className="tab-count">17 Classes</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'cch' ? 'active' : ''}`}
          onClick={() => setTab('cch')}
        >
          <span className="tab-idx">G</span>
          <span className="tab-title">CCH Mapping</span>
          <span className="tab-count">17 Classes</span>
        </button>
      </div>

      {/* ================================================================= */}
      {/* TAB A: VIEW PLAZA                                                 */}
      {/* ================================================================= */}
      {activeTab === 'view' && (
        <div className="tab-content view-plaza-section">
          {/* KPI Summary Cards */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <span className="kpi-label">Total Plazas</span>
              <span className="kpi-value">{kpis.total}</span>
              <span className="kpi-sub">Across National Highway Network</span>
            </div>
            <div className="kpi-card green">
              <span className="kpi-label">Active Plazas</span>
              <span className="kpi-value">{kpis.active}</span>
              <span className="kpi-sub">Processing Live FASTag Txns</span>
            </div>
            <div className="kpi-card amber">
              <span className="kpi-label">Pending Approval</span>
              <span className="kpi-value">{kpis.pending}</span>
              <span className="kpi-sub">Maker-Checker Review Needed</span>
            </div>
            <div className="kpi-card grey">
              <span className="kpi-label">Draft Plazas</span>
              <span className="kpi-value">{kpis.draft}</span>
              <span className="kpi-sub">Incomplete Configuration</span>
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
                    filteredPlazas.map((p) => {
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
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB B: ADD CONCESSIONAIRE                                         */}
      {/* ================================================================= */}
      {activeTab === 'concess' && (
        <div className="tab-content add-concess-section">
          <div className="two-col-layout">
            {/* Form Column */}
            <div className="panel-card form-column">
              <div className="card-header">
                <h3>Add Concessionaire</h3>
                <p className="card-desc">
                  Concessionaire ID is generated automatically in <code>CON-####</code> format upon save and is used to bind plazas.
                </p>
              </div>

              <form onSubmit={handleSaveConcessionaire} className="styled-form">
                <div className="form-group">
                  <label>
                    Concessionaire ID <span className="helper-label">(System Generated)</span>
                  </label>
                  <input
                    type="text"
                    value={nextConcessionaireId}
                    disabled
                    className="disabled-input code-font"
                  />
                  <div className="field-hint">Auto-assigned sequence ID</div>
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
                    className={concessErrors.name ? 'invalid' : ''}
                  />
                  <div className="field-hint">Alphabets, numbers, spaces, &, ., - allowed · max 100 chars</div>
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
                      className={concessErrors.contact ? 'invalid' : ''}
                    />
                    <div className="field-hint">Digits only · exactly 10 digits</div>
                    {concessErrors.contact && <div className="field-error">{concessErrors.contact}</div>}
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setConcessForm({ name: '', address: '', mail: '', contact: '' });
                      setConcessErrors({});
                    }}
                  >
                    Clear Form
                  </button>
                  <button type="submit" className="btn-primary">
                    Save Concessionaire
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
                    </tr>
                  </thead>
                  <tbody>
                    {store.concessionaires.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="empty-cell" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                          No concessionaires onboarded yet. Fill out the form on the left to add one.
                        </td>
                      </tr>
                    ) : (
                      store.concessionaires.map((c) => (
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
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB C: ADD / EDIT PLAZA                                           */}
      {/* ================================================================= */}
      {activeTab === 'addplaza' && (
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
                    disabled={isEditingPlaza}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      handlePlazaChange('id', val);
                    }}
                    className={`${plazaErrors.id ? 'invalid' : ''} ${isEditingPlaza ? 'disabled-input' : ''}`}
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
                    className={plazaErrors.agencyId ? 'invalid' : ''}
                  />
                  <div className="field-hint">Letters/alphanumeric · exactly 5 characters</div>
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
                <div className="form-group">
                  <label>
                    State <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HARYANA"
                    value={plazaForm.state}
                    onChange={(e) => handlePlazaChange('state', e.target.value.toUpperCase())}
                    className={plazaErrors.state ? 'invalid' : ''}
                  />
                  {plazaErrors.state && <div className="field-error">{plazaErrors.state}</div>}
                </div>

                <div className="form-group">
                  <label>
                    City <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GURUGRAM"
                    value={plazaForm.city}
                    onChange={(e) => handlePlazaChange('city', e.target.value.toUpperCase())}
                    className={plazaErrors.city ? 'invalid' : ''}
                  />
                  {plazaErrors.city && <div className="field-error">{plazaErrors.city}</div>}
                </div>

                <div className="form-group">
                  <label>
                    Plaza Activation Date <span className="req">*</span>
                  </label>
                  <input
                    type="date"
                    value={plazaForm.activationDate}
                    onChange={(e) => handlePlazaChange('activationDate', e.target.value)}
                    className={plazaErrors.activationDate ? 'invalid' : ''}
                  />
                  {plazaErrors.activationDate && (
                    <div className="field-error">{plazaErrors.activationDate}</div>
                  )}
                </div>

                <div className="form-group">
                  <label>Plaza Geo Code (Lat,Long)</label>
                  <input
                    type="text"
                    placeholder="e.g. 28.4089,76.9647"
                    value={plazaForm.geoCode}
                    onChange={(e) => handlePlazaChange('geoCode', e.target.value)}
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
      {activeTab === 'lanes' && (
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
                    plazaLanes.map((l) => (
                      <tr key={l.laneId}>
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
                          <button
                            type="button"
                            className="btn-danger-ghost sm"
                            onClick={() => handleDeleteLane(l.laneId)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB E: CALLBACK URL CONFIGURATION                                 */}
      {/* ================================================================= */}
      {activeTab === 'callback' && (
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
              >
                Auto-Fill All 14 Endpoints
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
                        <input
                          type="text"
                          maxLength={250}
                          placeholder={`https://api.paysonic.in/${selectedPlazaId.toLowerCase()}/${api.toLowerCase()}`}
                          value={currentVal}
                          onChange={(e) => handleCallbackChange(api, e.target.value)}
                          className="cb-input"
                        />
                        {test && (
                          <div className={`test-feedback ${test.status}`}>
                            {test.status === 'success' ? '✓ ' : '✕ '}
                            {test.msg}
                          </div>
                        )}
                      </div>
                      <div className="api-action">
                        <button
                          type="button"
                          className="btn-ghost sm"
                          onClick={() => handleTestCallback(api)}
                        >
                          Test Webhook
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="form-actions" style={{ marginTop: '24px' }}>
                <button type="submit" className="btn-primary">
                  Save All 14 Callback URLs
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB F: FARE MAPPING                                               */}
      {/* ================================================================= */}
      {activeTab === 'fare' && (
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
                onClick={() => {
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
                  showToast('Populated standard NHAI fare matrix defaults', 'info');
                }}
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
                      const f = plazaFares[vc.id] || {
                        single: 0,
                        ret: 0,
                        local10: 0,
                        local20: 0,
                        district: 0,
                        monthly: 0,
                      };

                      return (
                        <tr key={vc.id}>
                          <td>
                            <strong>{vc.id}</strong>
                            <div className="vc-desc">{vc.label.split('·')[1]}</div>
                          </td>
                          <td>
                            <input
                              type="text"
                              value={f.single ?? ''}
                              onChange={(e) => handleFareInputChange(vc.id, 'single', e.target.value)}
                              className="tbl-input"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={f.ret ?? ''}
                              onChange={(e) => handleFareInputChange(vc.id, 'ret', e.target.value)}
                              className="tbl-input"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={f.local10 ?? ''}
                              onChange={(e) => handleFareInputChange(vc.id, 'local10', e.target.value)}
                              className="tbl-input"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={f.local20 ?? ''}
                              onChange={(e) => handleFareInputChange(vc.id, 'local20', e.target.value)}
                              className="tbl-input"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={f.district ?? ''}
                              onChange={(e) => handleFareInputChange(vc.id, 'district', e.target.value)}
                              className="tbl-input"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={f.monthly ?? ''}
                              onChange={(e) => handleFareInputChange(vc.id, 'monthly', e.target.value)}
                              className="tbl-input"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

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
      {activeTab === 'cch' && (
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
                      const item = plazaCch[vc.id] || { current: 100, new: '' };
                      const hasNew = Boolean(item.new);
                      const delta = hasNew ? parseInt(item.new, 10) - item.current : 0;

                      return (
                        <tr key={vc.id}>
                          <td>
                            <strong>{vc.id}</strong>
                            <div className="vc-desc">{vc.label.split('·')[1]}</div>
                          </td>
                          <td>
                            <code className="cch-current-code">{item.current}</code>
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
              <h3>Add Lane — {selectedPlazaObject?.name} ({selectedPlazaId})</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setLaneModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLane} className="modal-body">
              <div className="form-group">
                <label>
                  Lane ID <span className="req">*</span>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. L45101"
                  value={newLane.laneId}
                  onChange={(e) => {
                    setNewLane({ ...newLane, laneId: e.target.value.toUpperCase() });
                    setLaneError('');
                  }}
                  className={laneError ? 'invalid' : ''}
                />
                <div className="field-hint">Alphanumeric, no spaces · max 6 chars · unique</div>
                {laneError && <div className="field-error">{laneError}</div>}
              </div>

              <div className="modal-form-grid">
                <div className="form-group">
                  <label>Direction <span className="req">*</span></label>
                  <select
                    value={newLane.direction}
                    onChange={(e) => setNewLane({ ...newLane, direction: e.target.value })}
                  >
                    <option value="North">North</option>
                    <option value="South">South</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Lane Type <span className="req">*</span></label>
                  <select
                    value={newLane.type}
                    onChange={(e) => setNewLane({ ...newLane, type: e.target.value })}
                  >
                    <option value="Entry">Entry</option>
                    <option value="Exit">Exit</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Lane Mode <span className="req">*</span></label>
                  <select
                    value={newLane.mode}
                    onChange={(e) => setNewLane({ ...newLane, mode: e.target.value })}
                  >
                    <option value="Normal">Normal</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Lane Category <span className="req">*</span></label>
                  <select
                    value={newLane.category}
                    onChange={(e) => setNewLane({ ...newLane, category: e.target.value })}
                  >
                    <option value="Hybrid">Hybrid</option>
                    <option value="Dedicated">Dedicated</option>
                    <option value="Handheld">Handheld</option>
                  </select>
                </div>

                <div className="form-group span-full">
                  <label>Lane Status <span className="req">*</span></label>
                  <select
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
                  Save Lane
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
    </div>
  );
};

export default Onboarding;
