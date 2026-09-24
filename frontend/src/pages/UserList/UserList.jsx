import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import UserService from '../../services/user/UserService';
import { useAuth } from '../../context/AuthContext';
import { getDefaultRouteForUser } from '../../config/roleMenus';
import {
  ROLE_NO_USER_TYPE,
  ALL_PLAZAS,
  ROLE_AUTO_ALL_PLAZA,
  ROLE_NO_PLAZA,
  ROLE_MENU_DEFAULTS,
  buildAccessGroups,
  getRoleMenuDefaults,
} from './menuConfig';
import './UserList.scss';

const VALID_ROLES = [
  'Master Admin',
  'Admin',
  'Bank',
  'Plaza Admin',
  'Concessionaire',
  'Plaza POS',
  'Request Tag Details'
];

export const UserList = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isMasterAdmin = currentUser?.role === 'Master Admin';
  const isAdmin = currentUser?.role === 'Admin';
  const isConcessionaire = currentUser?.role === 'Concessionaire';
  const isPlazaAdmin = currentUser?.role === 'Plaza Admin';
  const isPosOrTag = currentUser?.role === 'Plaza POS' || currentUser?.role === 'Request Tag Details';

  // Extract Concessionaire or Plaza Admin plazas
  const concessionairePlazas = useMemo(() => {
    if (!isConcessionaire) return [];
    if (Array.isArray(currentUser?.plazas) && currentUser.plazas.length > 0) {
      return currentUser.plazas;
    }
    if (currentUser?.assignedPlaza) {
      return currentUser.assignedPlaza.split(',').map((p) => p.trim()).filter(Boolean);
    }
    return ['Mumbai-Pune Corridor (3 Plazas)', 'Vashi Creek Bridge', 'Airoli Bridge', 'Khed Shivapur'];
  }, [currentUser, isConcessionaire]);

  const plazaAdminPlaza = currentUser?.assignedPlaza || '';

  // Creation permission (Image 1: Master Admin, Admin, Concessionaire, Plaza Admin)
  const canCreate = isMasterAdmin || isAdmin || isConcessionaire || isPlazaAdmin;
  const canApprove = isMasterAdmin || isAdmin;
  const canBulkUpload = isMasterAdmin || isAdmin;

  // Allowed roles when creating a new user (Image 1 & 3: Hierarchy Matrix)
  const allowedCreationRoles = useMemo(() => {
    if (isMasterAdmin) {
      return ['Master Admin', 'Admin', 'Bank', 'Concessionaire', 'Plaza Admin', 'Plaza POS', 'Request Tag Details'];
    }
    if (isAdmin) {
      return ['Admin', 'Bank', 'Concessionaire', 'Plaza Admin', 'Plaza POS', 'Request Tag Details'];
    }
    if (isConcessionaire) {
      return ['Plaza Admin', 'Request Tag Details', 'Plaza POS'];
    }
    if (isPlazaAdmin) {
      return ['Request Tag Details', 'Plaza POS'];
    }
    return [];
  }, [isMasterAdmin, isAdmin, isConcessionaire, isPlazaAdmin]);

  // Allowed plaza options when creating/assigning
  const allowedPlazasForActor = useMemo(() => {
    if (isMasterAdmin || isAdmin) {
      return ALL_PLAZAS;
    }
    if (isConcessionaire) {
      return concessionairePlazas.length > 0 ? concessionairePlazas : ALL_PLAZAS;
    }
    if (isPlazaAdmin) {
      return plazaAdminPlaza ? [plazaAdminPlaza] : ALL_PLAZAS;
    }
    return [];
  }, [isMasterAdmin, isAdmin, isConcessionaire, concessionairePlazas, isPlazaAdmin, plazaAdminPlaza]);

  // Hierarchy check: can actor edit/disable/delete this target user? (Image 1 & 3)
  const canManageTargetUser = (targetUser) => {
    if (!targetUser) return false;
    if (isMasterAdmin) return true;
    if (isAdmin) {
      return targetUser.role !== 'Master Admin';
    }
    if (isConcessionaire) {
      // Cannot manage Master Admin, Admin, or peer Concessionaires
      if (['Master Admin', 'Admin', 'Concessionaire'].includes(targetUser.role)) {
        return false;
      }
      // Must belong to one of the Concessionaire's plazas
      const targetPlaza = (targetUser.plaza || targetUser.assignedPlaza || '').toLowerCase();
      const targetPlazasList = (targetUser.plazas || []).map((p) => p.toLowerCase());
      return concessionairePlazas.some((cp) => {
        const cpLower = cp.toLowerCase();
        return (
          targetPlaza.includes(cpLower) ||
          cpLower.includes(targetPlaza) ||
          targetPlazasList.some((tp) => tp.includes(cpLower) || cpLower.includes(tp))
        );
      });
    }
    if (isPlazaAdmin) {
      // Image 1: "Request tag and POS users it created"
      const isAllowedRole = ['Request Tag Details', 'Plaza POS'].includes(targetUser.role);
      const isCreator =
        targetUser.createdBy &&
        (targetUser.createdBy.toLowerCase() === currentUser?.id?.toLowerCase() ||
          targetUser.createdBy.toLowerCase() === currentUser?.username?.toLowerCase());
      return isAllowedRole && isCreator;
    }
    return false;
  };

  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All roles');
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get('tab') === 'pending' ? 'Pending' : 'All statuses'
  );
  const [plazaFilter, setPlazaFilter] = useState('All plazas');

  useEffect(() => {
    if (searchParams.get('tab') === 'pending') {
      setStatusFilter('Pending');
    }
  }, [searchParams]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [formValues, setFormValues] = useState({
    username: '',
    email: '',
    contact: '',
    name: '',
    role: '',
    userType: '',
    status: 'Active',
    plaza: '',
    password: '',
    confirmPassword: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [selectedPlazas, setSelectedPlazas] = useState([]);
  const [selectedMenuIds, setSelectedMenuIds] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [openGroupIds, setOpenGroupIds] = useState({});

  // Bulk Upload State
  const [bulkErrors, setBulkErrors] = useState([]);
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFileSize, setUploadedFileSize] = useState('');
  const [parsedCsvRows, setParsedCsvRows] = useState([]);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    UserService.getUsers().then(setUsers);
  }, []);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    return ((parts[0] || '')[0] || '') + ((parts[1] || '')[0] || '');
  };

  const getMenuAccessCount = (u) => {
    if (u.menuAccess !== null && u.menuAccess !== undefined) {
      return u.menuAccess.length;
    }
    const defaults = ROLE_MENU_DEFAULTS[u.role] || [];
    return defaults.length;
  };

  const nextUserId = () => {
    return 'PSN' + String(users.length + 1007).padStart(4, '0');
  };

  // Actions
  const handleToggleLock = async (id) => {
    const updated = await UserService.toggleLock(id);
    setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
  };

  const handleApproveUser = async (id) => {
    try {
      const updated = await UserService.approveUser(id);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === id ? { ...u, ...updated, approval: 'Approved', status: 'Active' } : u
        )
      );
    } catch (err) {
      console.error('Approval failed:', err);
      alert(err?.response?.data?.message || err?.message || 'Failed to approve user.');
    }
  };

  const handleDeleteUser = async (id) => {
    await UserService.deleteUser(id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  // Modal Open Handlers
  const handleOpenAdd = () => {
    setEditingId(null);
    const initialRole = allowedCreationRoles[0] || 'Plaza POS';
    const initialPlaza = isPlazaAdmin
      ? plazaAdminPlaza
      : isConcessionaire
      ? (concessionairePlazas[0] || '')
      : '';

    setFormValues({
      username: '',
      email: '',
      contact: '',
      name: '',
      role: initialRole,
      userType: ROLE_NO_USER_TYPE.includes(initialRole) ? '—' : 'Toll Plaza',
      status: 'Pending',
      plaza: initialPlaza,
      password: '',
      confirmPassword: '',
    });
    setFormErrors({});
    setSelectedPlazas(isConcessionaire ? [initialPlaza] : []);
    setSelectedMenuIds(getRoleMenuDefaults(initialRole));
    setOpenGroupIds({});
    setIsModalOpen(true);
  };

  useEffect(() => {
    const action = searchParams.get('action');
    const tab = searchParams.get('tab');
    if (action === 'create') {
      handleOpenAdd();
    } else if (tab === 'pending') {
      setStatusFilter('Pending');
    } else if (tab === 'locked') {
      setStatusFilter('Locked');
    }
  }, [searchParams]);

  const handleOpenEdit = (id) => {
    const u = users.find((x) => x.id === id);
    if (!u) return;
    setEditingId(id);
    setFormValues({
      username: u.username || '',
      email: u.email || (u.username ? `${u.username}@paysonic.com` : ''),
      contact: u.contact || '9823456789',
      name: u.name || '',
      role: u.role || '',
      userType: u.userType && u.userType !== '—' ? u.userType : '',
      status: u.status || 'Active',
      plaza: u.role !== 'Concessionaire' ? u.plaza : '',
      password: u.password || 'Paysonic@2026',
      confirmPassword: u.password || 'Paysonic@2026',
    });
    setFormErrors({});

    if (u.role === 'Concessionaire' && u.plaza) {
      setSelectedPlazas(u.plaza.split(', ').map((p) => p.trim()));
    } else {
      setSelectedPlazas([]);
    }

    const currentMenu =
      u.menuAccess !== null && u.menuAccess !== undefined
        ? u.menuAccess
        : getRoleMenuDefaults(u.role);
    setSelectedMenuIds([...currentMenu]);
    setOpenGroupIds({});
    setIsModalOpen(true);
  };

  // Validation Rules (Section 5)
  const validateField = (name, value) => {
    let error = '';

    if (name === 'username') {
      if (!value || !value.trim()) {
        error = 'Username is required';
      } else {
        const isDuplicate = users.some(
          (u) => u.id !== editingId && u.username?.toLowerCase() === value.trim().toLowerCase()
        );
        if (isDuplicate) {
          error = 'Username is already taken';
        }
      }
    }

    if (name === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value || !value.trim()) {
        error = 'Email ID is required';
      } else if (!emailRegex.test(value)) {
        error = 'Please enter a valid email address';
      } else {
        const isDuplicate = users.some(
          (u) =>
            u.id !== editingId &&
            ((u.email && u.email.toLowerCase() === value.trim().toLowerCase()) ||
              (u.username && `${u.username}@paysonic.com`.toLowerCase() === value.trim().toLowerCase()))
        );
        if (isDuplicate) {
          error = 'This email is already registered';
        }
      }
    }

    if (name === 'contact') {
      const contactRegex = /^[0-9]{10}$/;
      if (!value || !value.trim()) {
        error = 'Contact number is required';
      } else if (!contactRegex.test(value.trim())) {
        error = 'Please enter a valid 10-digit mobile number';
      }
    }

    if (name === 'password' && (!editingId || value)) {
      const pwRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
      if (!value) {
        error = 'Password is required';
      } else if (!pwRegex.test(value)) {
        error = 'Min 8 chars, 1 uppercase, 1 number, 1 special character required';
      }
    }

    if (name === 'confirmPassword' && (!editingId || formValues.password)) {
      if (!value) {
        error = 'Please confirm your password';
      } else if (value !== formValues.password) {
        error = 'Passwords do not match';
      }
    }

    if (name === 'name') {
      if (!value || !value.trim()) {
        error = 'Display name is required';
      } else if (value.trim().length > 100) {
        error = 'Display name must not exceed 100 characters';
      }
    }

    if (name === 'role') {
      if (!value) {
        error = 'Role is required';
      }
    }

    if (name === 'userType' && formValues.role && !ROLE_NO_USER_TYPE.includes(formValues.role)) {
      if (!value) {
        error = 'User type is required';
      }
    }

    if (
      name === 'plaza' &&
      formValues.role &&
      !ROLE_AUTO_ALL_PLAZA.includes(formValues.role) &&
      !ROLE_NO_PLAZA.includes(formValues.role) &&
      formValues.role !== 'Concessionaire'
    ) {
      if (!value) {
        error = 'Plaza is required';
      }
    }

    return error;
  };

  const handleBlur = (field) => {
    const error = validateField(field, formValues[field]);
    setFormErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleRoleChange = (newRole) => {
    setFormValues((prev) => ({ ...prev, role: newRole }));
    setSelectedMenuIds([...getRoleMenuDefaults(newRole)]);
  };

  const togglePlazaChip = (plaza) => {
    setSelectedPlazas((prev) =>
      prev.includes(plaza) ? prev.filter((p) => p !== plaza) : [...prev, plaza]
    );
  };

  // Menu Access Toggles
  const handleToggleMenuId = (id, checked) => {
    setSelectedMenuIds((prev) => {
      if (checked) {
        return prev.includes(id) ? prev : [...prev, id];
      } else {
        return prev.filter((item) => item !== id);
      }
    });
  };

  const handleToggleGroupAll = (group, checked) => {
    const allIds = [group.id, ...group.subs.map((s) => s.id)];
    setSelectedMenuIds((prev) => {
      if (checked) {
        const next = new Set([...prev, ...allIds]);
        return Array.from(next);
      } else {
        return prev.filter((item) => !allIds.includes(item));
      }
    });
  };

  const handleToggleSubItem = (group, subId, checked) => {
    setSelectedMenuIds((prev) => {
      let next = checked ? (prev.includes(subId) ? prev : [...prev, subId]) : prev.filter((item) => item !== subId);
      const subIds = group.subs.map((s) => s.id);
      const anySubChecked = subIds.some((sId) => next.includes(sId));
      if (anySubChecked) {
        if (!next.includes(group.id)) next.push(group.id);
      } else {
        next = next.filter((item) => item !== group.id);
      }
      return next;
    });
  };

  const toggleGroupOpen = (groupId) => {
    setOpenGroupIds((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();

    // Validate all fields
    const errors = {
      username: validateField('username', formValues.username),
      email: validateField('email', formValues.email),
      contact: validateField('contact', formValues.contact),
      name: validateField('name', formValues.name),
      role: validateField('role', formValues.role),
      userType: validateField('userType', formValues.userType),
      plaza: formValues.role === 'Concessionaire'
        ? (selectedPlazas.length === 0 ? 'Please select at least one plaza' : '')
        : validateField('plaza', formValues.plaza),
      password: validateField('password', formValues.password),
      confirmPassword: validateField('confirmPassword', formValues.confirmPassword),
    };

    const hasError = Object.values(errors).some(Boolean);
    if (hasError) {
      setFormErrors(errors);
      setTimeout(() => {
        const errorEl = document.querySelector('.modal-body .field-error');
        if (errorEl) {
          errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      return;
    }

    const role = formValues.role;
    const isConcessionaire = role === 'Concessionaire';
    const isAutoAll = ROLE_AUTO_ALL_PLAZA.includes(role);
    const isNoPlaza = ROLE_NO_PLAZA.includes(role);

    const plazaLabel = isConcessionaire
      ? selectedPlazas.join(', ')
      : isAutoAll
      ? 'All plazas'
      : isNoPlaza
      ? 'Not applicable'
      : formValues.plaza || 'Unassigned';

    const userType = ROLE_NO_USER_TYPE.includes(role)
      ? '—'
      : formValues.userType || 'Toll Plaza';

    try {
      if (editingId) {
        const updated = await UserService.updateUser(editingId, {
          name: formValues.name || 'Updated User',
          username: formValues.username || 'user',
          email: formValues.email,
          mobile: formValues.contact || '+91 9876543210',
          contact: formValues.contact,
          role: role || 'Plaza Admin',
          userType,
          assignedPlaza: plazaLabel,
          plaza: plazaLabel,
          plazas: isConcessionaire ? selectedPlazas : [plazaLabel],
          status: formValues.status,
          password: formValues.password || 'Paysonic@2026',
          menuAccess: selectedMenuIds,
        });
        setUsers((prev) => prev.map((u) => (u.id === editingId ? { ...u, ...updated, menuAccess: selectedMenuIds } : u)));
      } else {
        const created = await UserService.createUser({
          id: nextUserId(),
          name: formValues.name || 'New user',
          username: formValues.username || 'new.user',
          email: formValues.email,
          mobile: formValues.contact || '+91 9876543210',
          contact: formValues.contact,
          role: role || 'Plaza Admin',
          userType,
          assignedPlaza: plazaLabel,
          plaza: plazaLabel,
          plazas: isConcessionaire ? selectedPlazas : [plazaLabel],
          status: 'Pending',
          approval: 'Pending',
          password: formValues.password || 'Paysonic@2026',
          locked: false,
          avatarBg: '#3762F2',
          menuAccess: selectedMenuIds,
        });
        setUsers((prev) => [{ ...created, status: 'Pending', approval: 'Pending', menuAccess: selectedMenuIds }, ...prev]);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save user:', err);
      alert(err?.response?.data?.message || err.message || 'Failed to save user. Please try again.');
    }
  };

  // Bulk Upload Functions (Section 8)
  const handleDownloadTemplate = (e) => {
    e.preventDefault();
    const csvContent =
      'username,email,contact,role,user_type,plaza,name,password\n' +
      'vikram.singh,vikram.singh@paysonic.com,9823456789,Plaza Admin,Toll Plaza,Mumbai Plaza NH-04,Vikram Singh,Pass@2026\n' +
      'ananya.das,ananya.das@paysonic.com,9876543210,Concessionaire,EV,Pune Bypass Plaza;Nashik Toll Plaza,Ananya Das,Pass@2026\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'paysonic_users_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setBulkErrors([]);
    setBulkSuccessMsg('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      parseAndValidateCsv(text);
    };
    reader.readAsText(file);
  };

  const parseAndValidateCsv = (csvText) => {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length <= 1) {
      setBulkErrors(['CSV file is empty or missing data rows.']);
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const expected = ['username', 'email', 'contact', 'role', 'user_type', 'plaza', 'name', 'password'];
    const hasAllHeaders = expected.every((h) => headers.includes(h));

    if (!hasAllHeaders) {
      setBulkErrors([
        `Invalid header format. Expected columns: ${expected.join(', ')}`,
      ]);
      return;
    }

    const errors = [];
    const newUsers = [];
    const seenUsernames = new Set(users.map((u) => u.username?.toLowerCase()));
    const seenEmails = new Set(users.map((u) => u.email?.toLowerCase()));

    for (let i = 1; i < lines.length; i++) {
      const rowNum = i + 1;
      const values = lines[i].split(',').map((v) => v.trim());
      if (values.length < expected.length) {
        errors.push(`Row ${rowNum}: Incomplete data columns.`);
        continue;
      }

      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });

      // Validations
      if (!row.username) {
        errors.push(`Row ${rowNum}: Username is required.`);
      } else if (seenUsernames.has(row.username.toLowerCase())) {
        errors.push(`Row ${rowNum}: Username '${row.username}' is already taken.`);
      } else {
        seenUsernames.add(row.username.toLowerCase());
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!row.email || !emailRegex.test(row.email)) {
        errors.push(`Row ${rowNum}: Invalid email format for '${row.email}'.`);
      } else if (seenEmails.has(row.email.toLowerCase())) {
        errors.push(`Row ${rowNum}: Email '${row.email}' is already registered.`);
      } else {
        seenEmails.add(row.email.toLowerCase());
      }

      if (!row.contact || !/^[0-9]{10}$/.test(row.contact)) {
        errors.push(`Row ${rowNum}: Contact '${row.contact}' must be a 10-digit mobile number.`);
      }

      if (!VALID_ROLES.includes(row.role)) {
        errors.push(
          `Row ${rowNum}: Role '${row.role}' is invalid. Must match: ${VALID_ROLES.join(', ')}`
        );
      }

      const pwRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
      if (!row.password || !pwRegex.test(row.password)) {
        errors.push(`Row ${rowNum}: Password does not meet security requirements.`);
      }

      if (errors.length === 0) {
        newUsers.push({
          id: 'PSN' + String(users.length + newUsers.length + 1007).padStart(4, '0'),
          name: row.name || row.username,
          username: row.username,
          email: row.email,
          role: row.role,
          userType: ROLE_NO_USER_TYPE.includes(row.role) ? '—' : row.user_type || 'Toll Plaza',
          plaza: ROLE_AUTO_ALL_PLAZA.includes(row.role)
            ? 'All plazas'
            : ROLE_NO_PLAZA.includes(row.role)
            ? 'Not applicable'
            : row.plaza.replace(/;/g, ', ') || 'Unassigned',
          status: 'Pending',
          approval: 'Pending',
          locked: false,
          avatarBg: '#3762F2',
          menuAccess: getRoleMenuDefaults(row.role),
        });
      }
    }

    if (errors.length > 0) {
      setBulkErrors(errors);
      setParsedCsvRows([]);
    } else {
      setBulkErrors([]);
      setParsedCsvRows(newUsers);
    }
  };

  const handleCommitBulkUpload = async () => {
    if (parsedCsvRows.length === 0) {
      setBulkErrors(['Please select and validate a CSV file before committing.']);
      return;
    }

    setIsBulkUploading(true);
    setBulkUploadProgress(0);
    setBulkErrors([]);
    setBulkSuccessMsg('');

    const savedUsers = [];
    const commitErrors = [];

    for (let i = 0; i < parsedCsvRows.length; i++) {
      const u = parsedCsvRows[i];
      try {
        const created = await UserService.createUser({
          ...u,
          password: u.password || 'Paysonic@2026',
        });
        savedUsers.push(created);
      } catch (err) {
        commitErrors.push(`Failed to import ${u.name || u.username}: ${err?.message || 'Server error'}`);
      }
      setBulkUploadProgress(Math.round(((i + 1) / parsedCsvRows.length) * 100));
    }

    setIsBulkUploading(false);

    if (commitErrors.length > 0) {
      setBulkErrors(commitErrors);
    }

    // Refresh live users directly from Railway backend database
    const freshUsers = await UserService.getUsers();
    setUsers(freshUsers);

    setBulkSuccessMsg(
      `✓ Successfully saved ${savedUsers.length} user accounts to live Railway database!`
    );
    setParsedCsvRows([]);
    setTimeout(() => {
      setIsBulkOpen(false);
      setBulkSuccessMsg('');
      setUploadedFileName('');
      setUploadedFileSize('');
      setBulkUploadProgress(0);
    }, 2200);
  };

  // Hierarchy Data Scoping (Image 1 & 2):
  // Master Admin / Admin -> Any plaza (all users)
  // Concessionaire -> Its own plazas only + users it created
  // Plaza Admin -> Its one assigned plaza only + users it created (to catch newly created pending users)
  // Request Tag / Plaza POS -> None (no access to user management)
  const hierarchyScopedUsers = useMemo(() => {
    if (isMasterAdmin || isAdmin) {
      return users;
    }
    if (isConcessionaire) {
      return users.filter((u) => {
        // Always include own profile
        if (u.id === currentUser?.id) return true;
        // Never show Master Admin or Admin to Concessionaire
        if (['Master Admin', 'Admin'].includes(u.role)) return false;
        // Never show peer Concessionaires
        if (u.role === 'Concessionaire' && u.id !== currentUser?.id) return false;
        // Show users created by this Concessionaire
        if (u.createdBy && (
          u.createdBy === currentUser?.id ||
          u.createdBy?.toLowerCase() === currentUser?.email?.toLowerCase()
        )) return true;
        // Show users in their assigned plazas
        const targetPlaza = (u.plaza || u.assignedPlaza || '').toLowerCase();
        const targetPlazasList = (u.plazas || []).map((p) => p.toLowerCase());
        return concessionairePlazas.some((cp) => {
          const cpLower = cp.toLowerCase();
          return (
            targetPlaza.includes(cpLower) ||
            cpLower.includes(targetPlaza) ||
            targetPlazasList.some((tp) => tp.includes(cpLower) || cpLower.includes(tp))
          );
        });
      });
    }
    if (isPlazaAdmin) {
      const myPlaza = (currentUser?.assignedPlaza || '').toLowerCase();
      return users.filter((u) => {
        // Always include own profile
        if (u.id === currentUser?.id) return true;
        // Never show Master Admin, Admin, or Concessionaire to Plaza Admin
        if (['Master Admin', 'Admin', 'Concessionaire', 'Plaza Admin'].includes(u.role) && u.id !== currentUser?.id) return false;
        // Show users the Plaza Admin created (important for pending approval cases)
        if (u.createdBy && (
          u.createdBy === currentUser?.id ||
          u.createdBy?.toLowerCase() === currentUser?.email?.toLowerCase()
        )) return true;
        // Show users in their assigned plaza (if plaza is set)
        if (myPlaza) {
          const targetPlaza = (u.plaza || u.assignedPlaza || '').toLowerCase();
          return (
            targetPlaza.includes(myPlaza) ||
            myPlaza.includes(targetPlaza) ||
            (u.plazas || []).some((p) => p.toLowerCase().includes(myPlaza) || myPlaza.includes(p.toLowerCase()))
          );
        }
        return false;
      });
    }
    // Plaza POS and Request Tag Details have no user management access
    return [];
  }, [users, isMasterAdmin, isAdmin, isConcessionaire, isPlazaAdmin, concessionairePlazas, currentUser]);

  // Filtered Users
  const filteredUsers = hierarchyScopedUsers.filter((u) => {
    const matchesSearch =
      !searchQuery ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole =
      roleFilter === 'All roles' || u.role.toLowerCase() === roleFilter.toLowerCase();

    const matchesStatus =
      statusFilter === 'All statuses' ||
      (statusFilter === 'Pending' && (u.approval === 'Pending' || u.status === 'Pending')) ||
      (statusFilter === 'Locked' && u.locked) ||
      (statusFilter === 'Active' && u.status === 'Active' && u.approval === 'Approved') ||
      (statusFilter === 'Inactive' && u.status === 'Inactive') ||
      u.status.toLowerCase() === statusFilter.toLowerCase();

    const matchesPlaza =
      plazaFilter === 'All plazas' ||
      u.plaza.toLowerCase().includes(plazaFilter.toLowerCase());

    return matchesSearch && matchesRole && matchesStatus && matchesPlaza;
  });

  const activePlazasCoveredCount = useMemo(() => {
    const plazaSet = new Set();
    hierarchyScopedUsers.forEach((u) => {
      if ((u.status === 'Active' || u.approval === 'Approved') && !u.locked) {
        if (Array.isArray(u.plazas) && u.plazas.length > 0) {
          u.plazas.forEach((p) => {
            if (p && !['All plazas', 'Not applicable', 'Unassigned'].includes(p)) {
              plazaSet.add(p.trim());
            }
          });
        }
        const plazaStr = u.assignedPlaza || u.plaza;
        if (plazaStr && !['All plazas', 'Not applicable', 'Unassigned'].includes(plazaStr)) {
          plazaStr.split(',').forEach((p) => {
            const trimmed = p.trim();
            if (trimmed && !['All plazas', 'Not applicable', 'Unassigned'].includes(trimmed)) {
              plazaSet.add(trimmed);
            }
          });
        }
      }
    });
    return plazaSet.size;
  }, [hierarchyScopedUsers]);

  // Role Dependent Computed Flags
  const role = formValues.role;
  const showUserType = role && !ROLE_NO_USER_TYPE.includes(role);
  const isFormConcessionaire = role === 'Concessionaire';
  const isAutoAllPlaza = ROLE_AUTO_ALL_PLAZA.includes(role);
  const isNoPlaza = ROLE_NO_PLAZA.includes(role);
  const isSinglePlaza = role && !isFormConcessionaire && !isAutoAllPlaza && !isNoPlaza;

  const defaultAccessGroups = role ? buildAccessGroups(role, true, selectedMenuIds) : [];
  const extraAccessGroups = role ? buildAccessGroups(role, false, selectedMenuIds) : [];

  return (
    <div className="user-management-content">
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1>User management</h1>
          <p>
            Create, approve, lock and manage every plaza and admin user from a single consolidated view.
          </p>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/activity')}
            title="View User Activity, Live Sessions & Audit Trail"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#344054" strokeWidth="2">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Activity &amp; Audit Trail
          </button>
          {canBulkUpload && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setBulkErrors([]);
                setBulkSuccessMsg('');
                setUploadedFileName('');
                setParsedCsvRows([]);
                setIsBulkOpen(true);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#344054" strokeWidth="2">
                <path d="M12 3v12M7 8l5-5 5 5M5 21h14" />
              </svg>
              Bulk upload
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenAdd}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add user
            </button>
          )}
        </div>
      </div>

      {/* Role Operational Scope Banner */}
      <div style={{
        margin: '0 0 20px 0',
        padding: '12px 18px',
        borderRadius: '10px',
        background: isPlazaAdmin ? '#f8fafc' : isConcessionaire ? '#f5f3ff' : '#f0fdf4',
        border: `1px solid ${isPlazaAdmin ? '#cbd5e1' : isConcessionaire ? '#ddd6fe' : '#bbf7d0'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>{isPlazaAdmin ? '🛡️' : isConcessionaire ? '🏢' : '👑'}</span>
          <span style={{
            fontSize: '11px',
            fontWeight: '700',
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: '6px',
            background: isPlazaAdmin ? '#0284c7' : isConcessionaire ? '#7c3aed' : '#16a34a',
            color: '#ffffff',
          }}>
            {currentUser?.role || 'Admin'} Scope
          </span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
            {isPlazaAdmin
              ? `Managing POS & Tag personnel for ${currentUser?.assignedPlaza || 'assigned plaza'}.`
              : isConcessionaire
              ? `Managing personnel across assigned plazas: ${concessionairePlazas.length > 0 ? concessionairePlazas.join(', ') : (currentUser?.assignedPlaza || 'None')}`
              : 'Central Governance Scope — Unrestricted access across all plazas, concessions & roles.'}
          </span>
        </div>
        {currentUser?.assignedPlaza && (
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
            📍 Jurisdiction: {currentUser.assignedPlaza}
          </span>
        )}
      </div>

      {/* Stats Cards */}
      <div className="stats">
        <div
          className="stat"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            setStatusFilter('All statuses');
            setRoleFilter('All roles');
          }}
          title="Filter: All users"
        >
          <span>Total users</span>
          <strong>{hierarchyScopedUsers.length}</strong>
        </div>
        <div
          className="stat"
          style={{ cursor: 'pointer' }}
          onClick={() => setStatusFilter(statusFilter === 'Pending' ? 'All statuses' : 'Pending')}
          title="Filter: Pending approvals"
        >
          <span>Pending approval</span>
          <strong style={{ color: 'var(--warning-text)' }}>
            {hierarchyScopedUsers.filter((u) => u.approval === 'Pending').length}
          </strong>
        </div>
        <div
          className="stat"
          style={{ cursor: 'pointer' }}
          onClick={() => setStatusFilter(statusFilter === 'Locked' ? 'All statuses' : 'Locked')}
          title="Filter: Locked accounts"
        >
          <span>Locked accounts</span>
          <strong style={{ color: 'var(--danger-text)' }}>
            {hierarchyScopedUsers.filter((u) => u.locked).length}
          </strong>
        </div>
        <div className="stat">
          <span>Active plazas covered</span>
          <strong style={{ color: 'var(--success-text)' }}>{activePlazasCoveredCount}</strong>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="filters">
        <div className="search-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#98A2B3" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, username, user ID"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option>All roles</option>
          <option>Master Admin</option>
          <option>Admin</option>
          <option>Bank</option>
          <option>Plaza Admin</option>
          <option>Concessionaire</option>
          <option>Plaza POS</option>
          <option>Request Tag Details</option>
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="All statuses">All statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Pending">Pending Approval</option>
          <option value="Locked">Locked Accounts</option>
        </select>

        <select value={plazaFilter} onChange={(e) => setPlazaFilter(e.target.value)}>
          <option>All plazas</option>
          <option>Mumbai Plaza NH-04</option>
          <option>Pune Bypass Plaza</option>
          <option>Nashik Toll Plaza</option>
        </select>
      </div>

      {/* Table Card */}
      <div className="table-card">
        <div className="table-scroll">
          <div className="t-head">
          <span>User</span>
          <span>Role / type</span>
          <span>Plaza assigned</span>
          <span>Status</span>
          <span>Approval</span>
          <span style={{ textAlign: 'right' }}>Actions</span>
        </div>

        <div className="table-body">
          {filteredUsers.map((u) => {
            const isApproved = u.approval === 'Approved';
            const statusActive = u.status === 'Active' || (isApproved && u.status !== 'Inactive');
            const statusLabel = statusActive ? 'Active' : (u.status || 'Pending');
            const approved = isApproved;
            return (
              <div key={u.id} className="t-row">
                <div className="who">
                  <div className="avatar" style={{ background: u.avatarBg || '#3762F2' }}>
                    {getInitials(u.name)}
                  </div>
                  <div className="who-meta">
                    <strong>{u.name}</strong>
                    <span>
                      {u.id} · {u.username}
                    </span>
                  </div>
                </div>

                <div className="role-cell">
                  <strong>{u.role}</strong>
                  <span>
                    {u.userType} · {getMenuAccessCount(u)} menu items
                  </span>
                </div>

                <div className="plaza-cell">{u.plaza}</div>

                <div>
                  <span className={`badge ${statusActive ? 'badge-active' : (statusLabel === 'Pending' ? 'badge-pending' : 'badge-inactive')}`}>
                    {statusLabel}
                  </span>
                </div>

                <div>
                  <span className={`badge ${approved ? 'badge-approved' : 'badge-pending'}`}>
                    {u.approval}
                  </span>
                </div>

                <div className="row-actions">
                  {canManageTargetUser(u) && (
                    <button
                      type="button"
                      className="icon-btn"
                      title="Edit user"
                      onClick={() => handleOpenEdit(u.id)}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475467" strokeWidth="1.9">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                  )}

                  {!approved && canApprove && (
                    <button
                      type="button"
                      className="icon-btn"
                      title="Approve user"
                      onClick={() => handleApproveUser(u.id)}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#067647" strokeWidth="2.2">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </button>
                  )}

                  {canManageTargetUser(u) && (
                    <button
                      type="button"
                      className="icon-btn"
                      title="Lock or unlock user"
                      onClick={() => handleToggleLock(u.id)}
                    >
                      {u.locked ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B42318" strokeWidth="1.9">
                          <rect x="4" y="10" width="16" height="10" rx="2" />
                          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                        </svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475467" strokeWidth="1.9">
                          <rect x="4" y="10" width="16" height="10" rx="2" />
                          <path d="M8 10V7a4 4 0 0 1 7.4-2" />
                        </svg>
                      )}
                    </button>
                  )}

                  {canManageTargetUser(u) && !(isAdmin && u.role === 'Master Admin') && (
                    <button
                      type="button"
                      className="icon-btn"
                      title="Delete user"
                      onClick={() => handleDeleteUser(u.id)}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B42318" strokeWidth="1.9">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>

        <div className="table-foot">
          <span>
            Showing {filteredUsers.length} of {users.length} users
          </span>
          <div className="pager">
            <button type="button">‹</button>
            <button type="button" className="current">
              1
            </button>
            <button type="button">›</button>
          </div>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <div className="overlay open">
          <div className="modal">
            <div className="modal-head">
              <div>
                <h2>{editingId ? 'Edit user' : 'Add new user'}</h2>
                <span>
                  User ID {editingId || nextUserId()} · auto-generated, non-editable
                </span>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475467" strokeWidth="2.2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmitForm} noValidate>
              <div className="modal-body">
                {/* User Information */}
                <div>
                  <div className="section-label">User information</div>
                  <div className="form-grid" style={{ marginTop: '14px' }}>
                    <div className="field">
                      <label>
                        Username <span className="req">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Used for login"
                        required
                        value={formValues.username}
                        onChange={(e) =>
                          setFormValues({ ...formValues, username: e.target.value })
                        }
                        onBlur={() => handleBlur('username')}
                      />
                      {formErrors.username && (
                        <span className="field-error">{formErrors.username}</span>
                      )}
                    </div>

                    <div className="field">
                      <label>
                        Email ID <span className="req">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="name@paysonic.com"
                        required
                        value={formValues.email}
                        onChange={(e) =>
                          setFormValues({ ...formValues, email: e.target.value })
                        }
                        onBlur={() => handleBlur('email')}
                      />
                      {formErrors.email && (
                        <span className="field-error">{formErrors.email}</span>
                      )}
                    </div>

                    <div className="field">
                      <label>
                        Contact number <span className="req">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="10-digit mobile number"
                        required
                        maxLength={10}
                        value={formValues.contact}
                        onChange={(e) =>
                          setFormValues({ ...formValues, contact: e.target.value.replace(/\D/g, '') })
                        }
                        onBlur={() => handleBlur('contact')}
                      />
                      {formErrors.contact && (
                        <span className="field-error">{formErrors.contact}</span>
                      )}
                    </div>

                    <div className="field">
                      <label>
                        Display name <span className="req">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Mumbai Plaza NH 04"
                        required
                        maxLength={100}
                        value={formValues.name}
                        onChange={(e) =>
                          setFormValues({ ...formValues, name: e.target.value })
                        }
                        onBlur={() => handleBlur('name')}
                      />
                      {formErrors.name && (
                        <span className="field-error">{formErrors.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="hint" style={{ marginTop: '10px' }}>
                    Up to 100 alphanumeric characters. This is the name the user sees on the login screen.
                  </div>
                </div>

                {/* Role & Access */}
                <div className="section-divider">
                  <div className="section-label">Role &amp; access</div>
                  <div className="form-grid" style={{ marginTop: '14px' }}>
                    <div className="field">
                      <label>
                        Role <span className="req">*</span>
                      </label>
                      <select
                        required
                        value={formValues.role}
                        onChange={(e) => handleRoleChange(e.target.value)}
                        onBlur={() => handleBlur('role')}
                      >
                        <option value="">Select role</option>
                        {allowedCreationRoles.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                      {formErrors.role && (
                        <span className="field-error">{formErrors.role}</span>
                      )}
                    </div>

                    {showUserType && (
                      <div className="field">
                        <label>
                          User type <span className="req">*</span>
                        </label>
                        <select
                          value={formValues.userType}
                          onChange={(e) => {
                            setFormValues({ ...formValues, userType: e.target.value });
                            setFormErrors((prev) => ({ ...prev, userType: '' }));
                          }}
                          onBlur={() => handleBlur('userType')}
                        >
                          <option value="">Select type</option>
                          <option>Toll Plaza</option>
                          <option>EV</option>
                          <option>Parking</option>
                          <option>Fuel</option>
                          <option>Other</option>
                        </select>
                        {formErrors.userType && (
                          <span className="field-error">{formErrors.userType}</span>
                        )}
                      </div>
                    )}

                    <div className="field">
                      <label>
                        Active status <span className="req">*</span>
                      </label>
                      {editingId ? (
                        <select
                          value={formValues.status}
                          onChange={(e) =>
                            setFormValues({ ...formValues, status: e.target.value })
                          }
                        >
                          <option>Active</option>
                          <option>Inactive</option>
                          <option>Pending</option>
                        </select>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', height: '40px', gap: '8px' }}>
                          <span className="badge badge-pending">Pending Approval</span>
                          <span style={{ fontSize: '12px', color: '#667085' }}>
                            (Requires approval before activation)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Plaza Selection Conditions */}
                  {isSinglePlaza && (
                    <div className="field" style={{ marginTop: '16px', maxWidth: '340px' }}>
                      <label>
                        Assign plaza <span className="req">*</span>
                      </label>
                      <select
                        value={formValues.plaza}
                        onChange={(e) => {
                          setFormValues({ ...formValues, plaza: e.target.value });
                          setFormErrors((prev) => ({ ...prev, plaza: '' }));
                        }}
                        onBlur={() => handleBlur('plaza')}
                        disabled={isPlazaAdmin}
                      >
                        <option value="">Select plaza</option>
                        {allowedPlazasForActor.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      {formErrors.plaza && (
                        <span className="field-error">{formErrors.plaza}</span>
                      )}
                    </div>
                  )}

                  {isFormConcessionaire && (
                    <div style={{ marginTop: '16px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--body-text)' }}>
                        Assign plazas <span className="req">*</span>
                      </label>
                      <div className="hint" style={{ margin: '2px 0 8px' }}>
                        Concessionaire accounts can be assigned more than one plaza.
                      </div>
                      <div className="chips">
                        {ALL_PLAZAS.map((p) => {
                          const picked = selectedPlazas.includes(p);
                          return (
                            <button
                              key={p}
                              type="button"
                              className={`chip ${picked ? 'picked' : ''}`}
                              onClick={() => {
                                togglePlazaChip(p);
                                setFormErrors((prev) => ({ ...prev, plaza: '' }));
                              }}
                            >
                              {p}
                            </button>
                          );
                        })}
                      </div>
                      {formErrors.plaza && (
                        <span className="field-error" style={{ display: 'block', marginTop: '6px' }}>{formErrors.plaza}</span>
                      )}
                    </div>
                  )}

                  {isAutoAllPlaza && (
                    <div style={{ marginTop: '16px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--body-text)' }}>
                        Assign plaza
                      </label>
                      <div className="callout" style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#175CD3" strokeWidth="2" style={{ flexShrink: 0 }}>
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 16v-4M12 8h.01" />
                        </svg>
                        All plazas are assigned to this role automatically — no manual selection needed.
                      </div>
                    </div>
                  )}

                  {isNoPlaza && (
                    <div style={{ marginTop: '16px' }}>
                      <div className="hint">Plaza assignment is not applicable for this role.</div>
                    </div>
                  )}
                </div>

                {/* Menu & Module Access Tree */}
                {role && (
                  <div className="section-divider">
                    <div className="section-label">Menu &amp; module access</div>
                    <div className="hint" style={{ margin: '6px 0 4px' }}>
                      Auto-selected from the role permission matrix. Untick anything this user shouldn't have, or add extra access below.
                    </div>

                    {/* Default Access */}
                    <div className="access-block">
                      <div className="access-block-head">Default access for this role</div>
                      <div className="access-tree">
                        {defaultAccessGroups.map((g) => {
                          if (g.leaf) {
                            const isChecked = selectedMenuIds.includes(g.id);
                            return (
                              <label key={g.id} className="access-leaf">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => handleToggleMenuId(g.id, e.target.checked)}
                                />
                                <span>{g.label}</span>
                              </label>
                            );
                          }
                          const allChecked = g.subs.every((s) => selectedMenuIds.includes(s.id));
                          const isOpen = !!openGroupIds[g.id];
                          return (
                            <div key={g.id} className={`access-group ${isOpen ? 'open' : ''}`}>
                              <div
                                className="access-group-head"
                                onClick={() => toggleGroupOpen(g.id)}
                              >
                                <input
                                  type="checkbox"
                                  checked={allChecked}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleToggleGroupAll(g, e.target.checked)}
                                />
                                <span>{g.label}</span>
                                <svg
                                  className="caret"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M9 18l6-6-6-6" />
                                </svg>
                              </div>
                              <div className="access-group-subs">
                                {g.subs.map((s) => {
                                  const isSubChecked = selectedMenuIds.includes(s.id);
                                  return (
                                    <label key={s.id} className="access-subrow">
                                      <input
                                        type="checkbox"
                                        checked={isSubChecked}
                                        onChange={(e) => handleToggleSubItem(g, s.id, e.target.checked)}
                                      />
                                      <span>{s.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {defaultAccessGroups.length === 0 && (
                        <div className="hint" style={{ padding: '10px 0' }}>
                          No default menu items for this role yet.
                        </div>
                      )}
                    </div>

                    {/* Additional Access */}
                    <div className="access-block" style={{ marginTop: '16px' }}>
                      <div className="access-block-head">Additional access available</div>
                      <div className="hint" style={{ margin: '2px 0 10px' }}>
                        Not part of this role by default — tick any of these to grant extra access to this specific user.
                      </div>
                      <div className="access-tree">
                        {extraAccessGroups.map((g) => {
                          if (g.leaf) {
                            const isChecked = selectedMenuIds.includes(g.id);
                            return (
                              <label key={g.id} className="access-leaf">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => handleToggleMenuId(g.id, e.target.checked)}
                                />
                                <span>{g.label}</span>
                              </label>
                            );
                          }
                          const allChecked = g.subs.every((s) => selectedMenuIds.includes(s.id));
                          const isOpen = !!openGroupIds[g.id];
                          return (
                            <div key={g.id} className={`access-group ${isOpen ? 'open' : ''}`}>
                              <div
                                className="access-group-head"
                                onClick={() => toggleGroupOpen(g.id)}
                              >
                                <input
                                  type="checkbox"
                                  checked={allChecked}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleToggleGroupAll(g, e.target.checked)}
                                />
                                <span>{g.label}</span>
                                <svg
                                  className="caret"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M9 18l6-6-6-6" />
                                </svg>
                              </div>
                              <div className="access-group-subs">
                                {g.subs.map((s) => {
                                  const isSubChecked = selectedMenuIds.includes(s.id);
                                  return (
                                    <label key={s.id} className="access-subrow">
                                      <input
                                        type="checkbox"
                                        checked={isSubChecked}
                                        onChange={(e) => handleToggleSubItem(g, s.id, e.target.checked)}
                                      />
                                      <span>{s.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {extraAccessGroups.length === 0 && (
                        <div className="hint" style={{ padding: '10px 0' }}>
                          This role already has access to every module — nothing extra to add.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Security */}
                <div className="section-divider">
                  <div className="section-label">Security</div>
                  <div className="form-grid" style={{ marginTop: '14px' }}>
                    <div className="field">
                      <label>
                        Set password <span className="req">*</span>
                      </label>
                      <div className="pw-wrap">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Min 8 chars, 1 upper, 1 number, 1 symbol"
                          value={formValues.password}
                          onChange={(e) =>
                            setFormValues({ ...formValues, password: e.target.value })
                          }
                          onBlur={() => handleBlur('password')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label="Show or hide password"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                      </div>
                      {formErrors.password && (
                        <span className="field-error">{formErrors.password}</span>
                      )}
                    </div>

                    <div className="field">
                      <label>
                        Confirm password <span className="req">*</span>
                      </label>
                      <div className="pw-wrap">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Re-enter password"
                          value={formValues.confirmPassword}
                          onChange={(e) =>
                            setFormValues({ ...formValues, confirmPassword: e.target.value })
                          }
                          onBlur={() => handleBlur('confirmPassword')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          aria-label="Show or hide confirm password"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                      </div>
                      {formErrors.confirmPassword && (
                        <span className="field-error">{formErrors.confirmPassword}</span>
                      )}
                    </div>
                  </div>

                  <div className="note-box" style={{ marginTop: '14px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#667085" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4M12 8h.01" />
                    </svg>
                    Passwords need one uppercase letter, one number, one special character and 8+ characters.
                  </div>
                </div>
              </div>

              <div className="modal-foot">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Save changes' : 'Create user'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal (Section 8) */}
      {isBulkOpen && (
        <div className="overlay center open">
          <div className="modal modal-sm">
            <div className="modal-head">
              <h2>Bulk upload users</h2>
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsBulkOpen(false)}
                aria-label="Close"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#475467" strokeWidth="2.2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
                Upload a CSV of new users. Every column below must be present — download the template to get the exact headers.
              </p>
              <a
                href="#download-template"
                onClick={handleDownloadTemplate}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600 }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3762F2" strokeWidth="2">
                  <path d="M12 3v12M7 8l5-5 5 5M5 21h14" />
                </svg>
                Download CSV template
              </a>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />

              <div
                className={`dropzone ${uploadedFileName ? 'dropzone--has-file' : ''}`}
                style={{ cursor: isBulkUploading ? 'not-allowed' : 'pointer' }}
                onClick={() => !isBulkUploading && fileInputRef.current?.click()}
              >
                {uploadedFileName ? (
                  <div className="dropzone-file-card">
                    <div className="file-icon-wrap">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </div>
                    <div className="file-meta">
                      <strong className="file-name">{uploadedFileName}</strong>
                      <span className="file-specs">{uploadedFileSize} · CSV Data Sheet</span>
                    </div>
                    <span className="change-chip">Change file</span>
                  </div>
                ) : (
                  <>
                    <div className="dropzone-upload-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <strong>Drag and drop your .csv file here</strong>
                    <span>or click to browse from your computer</span>
                  </>
                )}
              </div>

              {/* Live Railway DB Upload Progress Indicator */}
              {isBulkUploading && (
                <div className="bulk-progress-panel">
                  <div className="progress-info">
                    <span>
                      <span className="live-pulsar" /> Writing users to Railway Live Database...
                    </span>
                    <strong>{bulkUploadProgress}%</strong>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${bulkUploadProgress}%` }} />
                  </div>
                </div>
              )}

              {bulkErrors.length > 0 && (
                <div className="csv-error-box">
                  <strong>Validation errors encountered (Batch blocked):</strong>
                  <ul>
                    {bulkErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {bulkSuccessMsg && (
                <div className="csv-success-box">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {bulkSuccessMsg}
                </div>
              )}

              {parsedCsvRows.length > 0 && !isBulkUploading && !bulkSuccessMsg && (
                <div className="csv-preview-box">
                  <span className="preview-pill">✓ Verified</span>
                  <span>{parsedCsvRows.length} user rows validated &amp; ready to commit to Railway database.</span>
                </div>
              )}

              <div className="callout">
                <strong>Required columns:</strong> username, email, contact, role, user_type, plaza, name, password
              </div>
            </div>

            <div className="modal-foot">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setIsBulkOpen(false)}
                disabled={isBulkUploading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCommitBulkUpload}
                disabled={isBulkUploading || parsedCsvRows.length === 0}
              >
                {isBulkUploading ? (
                  <>
                    <span className="btn-spinner" />
                    Committing to DB...
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Commit {parsedCsvRows.length > 0 ? `(${parsedCsvRows.length})` : ''} to Railway DB
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserList;
