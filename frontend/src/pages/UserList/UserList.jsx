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
  MENU_TREE,
  getRoleMenuDefaults,
  getAllMenuIds,
  parseUserTypeWithPermissions,
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

  // Extract Concessionaire or Plaza Admin plazas as individual items
  const concessionairePlazas = useMemo(() => {
    if (!isConcessionaire) return [];
    const list = [];
    if (Array.isArray(currentUser?.plazas) && currentUser.plazas.length > 0) {
      currentUser.plazas.forEach((p) => {
        if (typeof p === 'string') {
          p.split(',').forEach((sub) => {
            const trimmed = sub.trim();
            if (trimmed) list.push(trimmed);
          });
        }
      });
    }
    const plazaString = currentUser?.assignedPlaza || currentUser?.plaza || '';
    if (plazaString) {
      plazaString.split(',').forEach((p) => {
        const trimmed = p.trim();
        if (trimmed) list.push(trimmed);
      });
    }
    const unique = [...new Set(list)];
    return unique.length > 0
      ? unique
      : ['Mumbai Plaza NH-04', 'Pune Bypass Plaza', 'Nashik Toll Plaza', 'Solapur Plaza NH-65'];
  }, [currentUser, isConcessionaire]);

  const plazaAdminPlaza = currentUser?.assignedPlaza || '';

  // Operational permissions based on currentUser.menuAccess
  const currentUserPerms = useMemo(() => {
    if (isMasterAdmin) return null; // full system authority
    if (Array.isArray(currentUser?.menuAccess) && currentUser.menuAccess.length > 0) {
      return new Set(currentUser.menuAccess);
    }
    return new Set(getRoleMenuDefaults(currentUser?.role));
  }, [isMasterAdmin, currentUser]);

  const hasMenuPerm = (permId) => {
    if (isMasterAdmin) return true;
    if (!currentUserPerms) return true;
    return currentUserPerms.has(permId);
  };

  // Sub-action permissions under User Management
  const hasCreateUserPerm = hasMenuPerm('user_management_create_user');
  const hasApproveUserPerm = hasMenuPerm('user_management_approve_user');
  const hasAssignUserPerm = hasMenuPerm('user_management_assign_user');
  const hasLockUnlockPerm = hasMenuPerm('user_management_lock_unlock_user');

  // Creation & approval permissions: role allowed AND actor possesses specific permission
  const canCreate = (isMasterAdmin || isAdmin || isConcessionaire || isPlazaAdmin) && hasCreateUserPerm;
  const canApprove = (isMasterAdmin || isAdmin) && hasApproveUserPerm;
  const canBulkUpload = (isMasterAdmin || isAdmin) && hasCreateUserPerm;

  // Available menu tree that this actor is permitted to delegate
  // Master Admin can delegate all modules.
  // Other roles can ONLY delegate modules and sub-items that they themselves possess!
  const delegatableMenuTree = useMemo(() => {
    if (isMasterAdmin) return MENU_TREE;

    const actorPerms = currentUserPerms || new Set(getRoleMenuDefaults(currentUser?.role));

    return MENU_TREE.map((group) => {
      // Leaf module (no sub-items)
      if (!group.subs || group.subs.length === 0) {
        return actorPerms.has(group.id) ? group : null;
      }

      // Group module: actor must possess the group permission
      if (!actorPerms.has(group.id)) {
        return null;
      }

      // Only show sub-items that the actor has permission for
      const availableSubs = group.subs.filter((s) => actorPerms.has(s.id));
      if (availableSubs.length === 0) {
        return null;
      }

      return {
        ...group,
        subs: availableSubs,
      };
    }).filter(Boolean);
  }, [isMasterAdmin, currentUserPerms, currentUser?.role]);

  // Set of all menu IDs that this actor is authorized to delegate
  const delegatableIdSet = useMemo(() => {
    const ids = new Set();
    delegatableMenuTree.forEach((m) => {
      ids.add(m.id);
      (m.subs || []).forEach((s) => ids.add(s.id));
    });
    return ids;
  }, [delegatableMenuTree]);

  // Allowed roles when creating a new user (Image 1 & 3: Hierarchy Matrix)
  const allowedCreationRoles = useMemo(() => {
    if (isMasterAdmin) {
      return ['Master Admin', 'Admin', 'Bank', 'Concessionaire', 'Plaza Admin', 'Plaza POS', 'Request Tag Details'];
    }
    if (isAdmin) {
      return ['Bank', 'Concessionaire', 'Plaza Admin', 'Plaza POS', 'Request Tag Details'];
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
      const list = [];
      const plazaString = plazaAdminPlaza || currentUser?.assignedPlaza || currentUser?.plaza || '';
      plazaString.split(',').forEach((p) => {
        const trimmed = p.trim();
        if (trimmed) list.push(trimmed);
      });
      return list.length > 0 ? [...new Set(list)] : ALL_PLAZAS;
    }
    return [];
  }, [isMasterAdmin, isAdmin, isConcessionaire, concessionairePlazas, isPlazaAdmin, plazaAdminPlaza, currentUser]);

  // Strict hierarchy level map
  // Level 1: Master Admin
  // Level 2: Admin
  // Level 3: Bank, Concessionaire
  // Level 4: Plaza Admin
  // Level 5: Plaza POS, Request Tag Details
  const ROLE_HIERARCHY_LEVEL = {
    'Master Admin': 1,
    'Admin': 2,
    'Bank': 3,
    'Concessionaire': 3,
    'Plaza Admin': 4,
    'Plaza POS': 5,
    'Request Tag Details': 5,
  };

  // Check if target user is on same level or upper level in hierarchy
  const isSameOrUpperLevel = (targetUser) => {
    if (!targetUser) return false;
    // For non-Master Admin, enforce same or upper level view-only protection
    if (!isMasterAdmin) {
      const myLevel = ROLE_HIERARCHY_LEVEL[currentUser?.role] ?? 99;
      const targetLevel = ROLE_HIERARCHY_LEVEL[targetUser.role] ?? 99;
      return targetLevel <= myLevel;
    }
    // Master Admin can edit and manage all users. Show info icon for own profile or for viewing
    return targetUser.id === currentUser?.id;
  };

  // Hierarchy check: can actor edit/disable this target user?
  // Master Admin has full management authority across all roles & plazas
  const canManageTargetUser = (targetUser) => {
    if (!targetUser) return false;
    // Cannot manage yourself in User Management
    if (targetUser.id === currentUser?.id) return false;

    // Master Admin can edit and configure any user in the system (including other Master Admins)
    if (isMasterAdmin) return true;

    const myLevel = ROLE_HIERARCHY_LEVEL[currentUser?.role] ?? 99;
    const targetLevel = ROLE_HIERARCHY_LEVEL[targetUser.role] ?? 99;

    // Must be strictly lower level (higher number = lower in hierarchy)
    if (targetLevel <= myLevel) return false;

    if (isAdmin) return true;

    if (isConcessionaire) {
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

  // Strict hierarchy rule: CANNOT delete same level or higher level users
  const canDeleteTargetUser = (targetUser) => {
    if (!targetUser) return false;
    if (targetUser.id === currentUser?.id) return false;

    // Master Admin can delete any user except themselves and peer Master Admins
    if (isMasterAdmin) {
      return targetUser.role !== 'Master Admin';
    }

    const myLevel = ROLE_HIERARCHY_LEVEL[currentUser?.role] ?? 99;
    const targetLevel = ROLE_HIERARCHY_LEVEL[targetUser.role] ?? 99;

    // Must be strictly lower level (higher number = lower in hierarchy)
    if (targetLevel <= myLevel) return false;

    // Also apply the existing canManageTargetUser scope checks
    return canManageTargetUser(targetUser);
  };

  // Hierarchy check: can current actor approve this target user?
  const canApproveTargetUser = (targetUser) => {
    if (!targetUser) return false;
    // Must possess 'user_management_approve_user' permission
    if (!hasApproveUserPerm) return false;
    // Already approved users do not need approval
    if (targetUser.approval === 'Approved' && targetUser.status === 'Active') return false;

    // Cannot approve own account
    if (targetUser.id === currentUser?.id || (targetUser.email && targetUser.email.toLowerCase() === currentUser?.email?.toLowerCase())) {
      return false;
    }

    // Master Admin authority:
    // Master Admin CAN approve any pending user in the system, INCLUDING newly created Master Admins!
    if (isMasterAdmin) {
      return targetUser.approval === 'Pending' || targetUser.status === 'Pending';
    }

    // Strict hierarchy: cannot approve same or higher level users
    const myLevel = ROLE_HIERARCHY_LEVEL[currentUser?.role] ?? 99;
    const targetLevel = ROLE_HIERARCHY_LEVEL[targetUser.role] ?? 99;
    if (targetLevel <= myLevel) return false;

    // Maker-Checker Rule: Account creator CANNOT approve their own onboarding request (for subordinate roles)
    const isCreator =
      targetUser.createdBy &&
      (targetUser.createdBy.toLowerCase() === currentUser?.id?.toLowerCase() ||
        targetUser.createdBy.toLowerCase() === currentUser?.username?.toLowerCase() ||
        targetUser.createdBy.toLowerCase() === currentUser?.email?.toLowerCase());
    if (isCreator) return false;

    // Admin can approve subordinate roles below Level 2
    if (isAdmin) {
      return targetLevel > 2;
    }

    // Concessionaire can approve Plaza Admin, Request Tag Details, and Plaza POS within their plazas
    if (isConcessionaire) {
      if (!['Plaza Admin', 'Request Tag Details', 'Plaza POS'].includes(targetUser.role)) {
        return false;
      }
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

    // Plaza Admin can approve Request Tag Details and Plaza POS within their plaza
    if (isPlazaAdmin) {
      if (!['Request Tag Details', 'Plaza POS'].includes(targetUser.role)) {
        return false;
      }
      const myPlaza = (currentUser?.assignedPlaza || '').toLowerCase();
      if (!myPlaza) return false;
      const targetPlaza = (targetUser.plaza || targetUser.assignedPlaza || '').toLowerCase();
      return targetPlaza.includes(myPlaza) || myPlaza.includes(targetPlaza);
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
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name } of user to delete
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [viewingUser, setViewingUser] = useState(null); // (i) Hierarchy Protected View-Only Modal

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
    setIsDeleting(true);
    setDeleteError('');
    try {
      await UserService.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to delete user. Please try again.';
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Modal Open Handlers
  const handleOpenAdd = () => {
    if (!canCreate) return;
    setEditingId(null);
    const initialRole = allowedCreationRoles[0] || 'Plaza POS';
    const initialPlaza = isPlazaAdmin
      ? (plazaAdminPlaza ? plazaAdminPlaza.split(',')[0].trim() : '')
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
    const initialDefaults = getRoleMenuDefaults(initialRole);
    const initialSubset = isMasterAdmin ? initialDefaults : initialDefaults.filter((id) => delegatableIdSet.has(id));
    setSelectedMenuIds(initialSubset);
    setOpenGroupIds({});
    setIsModalOpen(true);
  };

  useEffect(() => {
    const action = searchParams.get('action');
    const tab = searchParams.get('tab');
    if (action === 'create' && canCreate) {
      handleOpenAdd();
    } else if (tab === 'pending') {
      setStatusFilter('Pending');
    } else if (tab === 'locked') {
      setStatusFilter('Locked');
    }
  }, [searchParams, canCreate]);

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
      userType: parseUserTypeWithPermissions(u.userType).cleanUserType !== '—'
        ? parseUserTypeWithPermissions(u.userType).cleanUserType
        : '',
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

    const parsedPerms = parseUserTypeWithPermissions(u.userType);
    const currentMenu =
      u.menuAccess !== null && u.menuAccess !== undefined
        ? u.menuAccess
        : parsedPerms.menuAccess !== null && parsedPerms.menuAccess !== undefined
        ? parsedPerms.menuAccess
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
    const defaults = getRoleMenuDefaults(newRole);
    const filtered = isMasterAdmin ? defaults : defaults.filter((id) => delegatableIdSet.has(id));
    setSelectedMenuIds(filtered);
  };

  const togglePlazaChip = (plaza) => {
    setSelectedPlazas((prev) =>
      prev.includes(plaza) ? prev.filter((p) => p !== plaza) : [...prev, plaza]
    );
  };

  // Menu Access Toggles & Quick Actions
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
    const subIds = (group.subs || []).map((s) => s.id);
    const allIds = [group.id, ...subIds];
    setSelectedMenuIds((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, ...allIds]));
      } else {
        return prev.filter((item) => !allIds.includes(item));
      }
    });
  };

  const handleToggleSubItem = (group, subId, checked) => {
    setSelectedMenuIds((prev) => {
      let next = checked
        ? (prev.includes(subId) ? prev : [...prev, subId])
        : prev.filter((item) => item !== subId);

      const subIds = (group.subs || []).map((s) => s.id);
      const anySubChecked = subIds.some((sId) => next.includes(sId));
      if (anySubChecked) {
        if (!next.includes(group.id)) next = [...next, group.id];
      } else {
        next = next.filter((item) => item !== group.id);
      }
      return next;
    });
  };

  const handleSelectAllMenus = () => {
    setSelectedMenuIds(Array.from(delegatableIdSet));
  };

  const handleDeselectAllMenus = () => {
    setSelectedMenuIds([]);
  };

  const handleResetToRoleDefaults = () => {
    if (formValues.role) {
      const defaults = getRoleMenuDefaults(formValues.role);
      const filtered = isMasterAdmin ? defaults : defaults.filter((id) => delegatableIdSet.has(id));
      setSelectedMenuIds(filtered);
    }
  };

  const handleToggleAllExpand = () => {
    const anyClosed = delegatableMenuTree.some((m) => m.subs && m.subs.length > 0 && !openGroupIds[m.id]);
    const nextState = {};
    delegatableMenuTree.forEach((m) => {
      if (m.subs && m.subs.length > 0) {
        nextState[m.id] = anyClosed;
      }
    });
    setOpenGroupIds(nextState);
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
      // Enforce delegation authority: actor can only grant permissions they hold
      let finalMenuAccess = selectedMenuIds;
      if (!isMasterAdmin) {
        if (editingId) {
          const existingUser = users.find((u) => u.id === editingId);
          // Preserve any existing permissions that actor cannot manage (e.g. granted by higher admin)
          const existingUnmanaged = (existingUser?.menuAccess || []).filter((id) => !delegatableIdSet.has(id));
          const actorManagedPicks = selectedMenuIds.filter((id) => delegatableIdSet.has(id));
          finalMenuAccess = Array.from(new Set([...existingUnmanaged, ...actorManagedPicks]));
        } else {
          finalMenuAccess = selectedMenuIds.filter((id) => delegatableIdSet.has(id));
        }
      }

      // Plaza assignment authority: if actor doesn't hold 'Assign User', preserve existing plaza
      const existingUser = editingId ? users.find((u) => u.id === editingId) : null;
      const finalPlazaLabel = (editingId && !hasAssignUserPerm && existingUser)
        ? (existingUser.assignedPlaza || existingUser.plaza || plazaLabel)
        : plazaLabel;
      const finalPlazas = (editingId && !hasAssignUserPerm && existingUser)
        ? (existingUser.plazas || [finalPlazaLabel])
        : (isConcessionaire ? selectedPlazas : [finalPlazaLabel]);

      if (editingId) {
        const isCurrentlyPending = existingUser && existingUser.approval !== 'Approved';
        const finalStatus = isCurrentlyPending ? 'Pending' : (formValues.status || 'Active');

        const updated = await UserService.updateUser(editingId, {
          name: formValues.name || 'Updated User',
          username: formValues.username || 'user',
          email: formValues.email,
          mobile: formValues.contact || '+91 9876543210',
          contact: formValues.contact,
          role: role || 'Plaza Admin',
          userType,
          assignedPlaza: finalPlazaLabel,
          plaza: finalPlazaLabel,
          plazas: finalPlazas,
          status: finalStatus,
          password: formValues.password || 'Paysonic@2026',
          menuAccess: finalMenuAccess,
        });
        setUsers((prev) => prev.map((u) => (u.id === editingId ? { ...u, ...updated, status: finalStatus, menuAccess: finalMenuAccess } : u)));
      } else {
        const initialStatus = isMasterAdmin && formValues.status === 'Active' ? 'Active' : 'Pending';
        const initialApproval = isMasterAdmin && formValues.status === 'Active' ? 'Approved' : 'Pending';
        const created = await UserService.createUser({
          id: nextUserId(),
          name: formValues.name || 'New user',
          username: formValues.username || 'new.user',
          email: formValues.email,
          mobile: formValues.contact || '+91 9876543210',
          contact: formValues.contact,
          role: role || 'Plaza Admin',
          userType,
          assignedPlaza: finalPlazaLabel,
          plaza: finalPlazaLabel,
          plazas: finalPlazas,
          status: initialStatus,
          approval: initialApproval,
          password: formValues.password || 'Paysonic@2026',
          locked: false,
          avatarBg: '#3762F2',
          menuAccess: finalMenuAccess,
          createdBy: currentUser?.id || 'PSN0001',
        });
        setUsers((prev) => [{ ...created, status: initialStatus, approval: initialApproval, menuAccess: finalMenuAccess }, ...prev]);
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

  const roleDefaults = useMemo(() => {
    const raw = getRoleMenuDefaults(role);
    return isMasterAdmin ? raw : raw.filter((id) => delegatableIdSet.has(id));
  }, [role, isMasterAdmin, delegatableIdSet]);
  const defaultSet = useMemo(() => new Set(roleDefaults), [roleDefaults]);

  const totalAvailableMenus = useMemo(() => {
    let count = 0;
    delegatableMenuTree.forEach((m) => {
      count += m.subs && m.subs.length > 0 ? m.subs.length : 1;
    });
    return count;
  }, [delegatableMenuTree]);

  const selectedCount = useMemo(() => {
    let count = 0;
    delegatableMenuTree.forEach((m) => {
      if (!m.subs || m.subs.length === 0) {
        if (selectedMenuIds.includes(m.id)) count++;
      } else {
        m.subs.forEach((s) => {
          if (selectedMenuIds.includes(s.id)) count++;
        });
      }
    });
    return count;
  }, [delegatableMenuTree, selectedMenuIds]);

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
            const statusLabel = isApproved ? (u.status === 'Inactive' ? 'Inactive' : 'Active') : 'Pending';
            const statusActive = statusLabel === 'Active';
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
                    {parseUserTypeWithPermissions(u.userType).cleanUserType} · {getMenuAccessCount(u)} menu items
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
                    {approved ? 'Approved' : 'Pending'}
                  </span>
                </div>

                <div className="row-actions">
                  {/* (i) Info icon: Shown for users on the SAME LEVEL or UPPER LEVEL in hierarchy */}
                  {isSameOrUpperLevel(u) && (
                    <button
                      type="button"
                      className="icon-btn"
                      title="View user details (Hierarchy protected: Same/Upper level - View only)"
                      onClick={() => setViewingUser(u)}
                      style={{
                        color: '#2563eb',
                        background: '#eff6ff',
                        borderColor: '#bfdbfe',
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4M12 8h.01" />
                      </svg>
                    </button>
                  )}

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

                  {canApproveTargetUser(u) && (
                    <button
                      type="button"
                      className="icon-btn"
                      title="Approve user (hierarchy approval)"
                      onClick={() => handleApproveUser(u.id)}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#067647" strokeWidth="2.2">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </button>
                  )}

                  {canManageTargetUser(u) && hasLockUnlockPerm && (
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

                  {canDeleteTargetUser(u) && (
                    <button
                      type="button"
                      className="icon-btn"
                      title="Delete user"
                      onClick={() => setDeleteConfirm({ id: u.id, name: u.name || u.username })}
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
                      {editingId && users.find((x) => x.id === editingId)?.approval !== 'Approved' ? (
                        <div style={{ display: 'flex', alignItems: 'center', height: '40px', gap: '10px' }}>
                          <span className="badge badge-pending">Pending Approval</span>
                          {canApproveTargetUser(users.find((x) => x.id === editingId)) ? (
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={async (e) => {
                                e.preventDefault();
                                await handleApproveUser(editingId);
                                setFormValues((prev) => ({ ...prev, status: 'Active' }));
                              }}
                              style={{
                                background: '#ecfdf5',
                                color: '#047857',
                                border: '1px solid #a7f3d0',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              ✓ Approve &amp; Activate Now
                            </button>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#667085' }}>
                              (Requires hierarchy approval to activate)
                            </span>
                          )}
                        </div>
                      ) : editingId ? (
                        <select
                          value={formValues.status}
                          onChange={(e) =>
                            setFormValues({ ...formValues, status: e.target.value })
                          }
                        >
                          <option>Active</option>
                          <option>Inactive</option>
                        </select>
                      ) : isMasterAdmin ? (
                        <select
                          value={formValues.status}
                          onChange={(e) =>
                            setFormValues({ ...formValues, status: e.target.value })
                          }
                        >
                          <option value="Active">Active (Auto-Approved by Master Admin)</option>
                          <option value="Pending">Pending Approval</option>
                        </select>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', height: '40px', gap: '8px' }}>
                          <span className="badge badge-pending">Pending Approval</span>
                          <span style={{ fontSize: '12px', color: '#667085' }}>
                            (Requires hierarchy approval before activation)
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
                        {!hasAssignUserPerm && (
                          <span style={{ fontSize: '11px', color: '#b45309', marginLeft: '6px', fontWeight: 400 }}>
                            🔒 (Requires 'Assign User' permission to modify)
                          </span>
                        )}
                      </label>
                      <select
                        value={formValues.plaza}
                        onChange={(e) => {
                          if (!hasAssignUserPerm) return;
                          setFormValues({ ...formValues, plaza: e.target.value });
                          setFormErrors((prev) => ({ ...prev, plaza: '' }));
                        }}
                        onBlur={() => handleBlur('plaza')}
                        disabled={isPlazaAdmin || !hasAssignUserPerm}
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
                        {!hasAssignUserPerm && (
                          <span style={{ fontSize: '11px', color: '#b45309', marginLeft: '6px', fontWeight: 400 }}>
                            🔒 (Requires 'Assign User' permission to modify)
                          </span>
                        )}
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
                              disabled={!hasAssignUserPerm}
                              onClick={() => {
                                if (!hasAssignUserPerm) return;
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
                      Auto-selected from the role permission matrix. Customize access for this user by ticking or unticking modules and sub-features.
                    </div>

                    {/* Quick action bar */}
                    <div className="access-actions-bar">
                      <div className="access-actions-left">
                        <button
                          type="button"
                          className="access-quick-btn primary"
                          onClick={handleResetToRoleDefaults}
                          title="Restore default permissions for this role"
                        >
                          Reset to Role Defaults
                        </button>
                        <button
                          type="button"
                          className="access-quick-btn"
                          onClick={handleSelectAllMenus}
                          title="Grant full access to all modules and sub-items"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          className="access-quick-btn"
                          onClick={handleDeselectAllMenus}
                          title="Deselect all modules"
                        >
                          Clear All
                        </button>
                        <button
                          type="button"
                          className="access-quick-btn"
                          onClick={handleToggleAllExpand}
                          title="Expand or collapse all modules"
                        >
                          {delegatableMenuTree.some((m) => m.subs && m.subs.length > 0 && !openGroupIds[m.id])
                            ? 'Expand All'
                            : 'Collapse All'}
                        </button>
                      </div>
                      <div className="access-count-summary">
                        <strong>{selectedCount}</strong> of <strong>{totalAvailableMenus}</strong> items enabled
                      </div>
                    </div>

                    {/* Unified Access Tree */}
                    <div className="access-tree">
                      {delegatableMenuTree.map((m) => {
                        if (!m.subs || m.subs.length === 0) {
                          const isChecked = selectedMenuIds.includes(m.id);
                          const isDefault = defaultSet.has(m.id);
                          return (
                            <label key={m.id} className="access-leaf">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => handleToggleMenuId(m.id, e.target.checked)}
                              />
                              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{m.label}</span>
                              <span className={`access-pill ${isDefault ? 'default' : 'extra'}`}>
                                {isDefault ? 'Default' : '+ Extra'}
                              </span>
                            </label>
                          );
                        }

                        const subCount = m.subs.length;
                        const checkedSubs = m.subs.filter((s) => selectedMenuIds.includes(s.id));
                        const allChecked = checkedSubs.length === subCount;
                        const noneChecked = checkedSubs.length === 0;
                        const isPartiallyChecked = !allChecked && !noneChecked;
                        const isOpen = !!openGroupIds[m.id];

                        return (
                          <div key={m.id} className={`access-group ${isOpen ? 'open' : ''}`}>
                            <div
                              className="access-group-head"
                              onClick={() => toggleGroupOpen(m.id)}
                            >
                              <input
                                type="checkbox"
                                checked={allChecked}
                                ref={(el) => {
                                  if (el) el.indeterminate = isPartiallyChecked;
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => handleToggleGroupAll(m, e.target.checked)}
                              />
                              <span>{m.label}</span>
                              <span
                                className={`access-status-badge ${
                                  allChecked ? 'full' : noneChecked ? 'none' : 'partial'
                                }`}
                              >
                                {allChecked
                                  ? 'Full Access'
                                  : noneChecked
                                  ? 'No Access'
                                  : `${checkedSubs.length}/${subCount} Enabled`}
                              </span>
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
                              {m.subs.map((s) => {
                                const isSubChecked = selectedMenuIds.includes(s.id);
                                const isSubDefault = defaultSet.has(s.id);
                                return (
                                  <label key={s.id} className="access-subrow">
                                    <input
                                      type="checkbox"
                                      checked={isSubChecked}
                                      onChange={(e) => handleToggleSubItem(m, s.id, e.target.checked)}
                                    />
                                    <span>{s.label}</span>
                                    <span className={`access-pill ${isSubDefault ? 'default' : 'extra'}`}>
                                      {isSubDefault ? 'Default' : '+ Extra'}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="overlay open" style={{ zIndex: 9999 }}>
          <div className="modal" style={{ maxWidth: '420px', padding: '0' }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid #fee2e2',
              background: 'linear-gradient(135deg, #fff5f5 0%, #fff 100%)',
              borderRadius: '12px 12px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B42318" strokeWidth="2">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
                </svg>
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>Delete User</h2>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#6b7280' }}>This action cannot be undone</p>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>
                Are you sure you want to delete{' '}
                <strong style={{ color: '#111827' }}>{deleteConfirm.name}</strong>?
                <br />
                <span style={{ color: '#9ca3af', fontSize: '13px' }}>All data associated with this user will be permanently removed.</span>
              </p>
            </div>

            {/* Error message */}
            {deleteError && (
              <div style={{ padding: '0 24px 8px', color: '#b91c1c', fontSize: '13px', background: '#fff5f5', borderTop: '1px solid #fecaca', paddingTop: '10px' }}>
                ⚠️ {deleteError}
              </div>
            )}

            {/* Footer */}
            <div style={{
              padding: '12px 24px 20px',
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end',
            }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setDeleteConfirm(null); setDeleteError(''); }}
                disabled={isDeleting}
                style={{ minWidth: '90px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => handleDeleteUser(deleteConfirm.id)}
                disabled={isDeleting}
                style={{
                  minWidth: '110px',
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(185,28,28,0.3)',
                  opacity: isDeleting ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isDeleting ? (
                  <><span className="btn-spinner" style={{ borderTopColor: '#fff' }} /> Deleting...</>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
                    </svg>
                    Yes, Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View User Details (Hierarchy Protected View-Only Modal) */}
      {viewingUser && (
        <div
          className="overlay open"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingUser(null);
          }}
        >
          <div
            className="modal"
            style={{
              maxWidth: '560px',
              width: '100%',
              borderRadius: '16px',
              background: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            <div
              className="modal-head"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 24px',
                borderBottom: '1px solid #e5e7eb',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                  </svg>
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' }}>User Details</h2>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    User ID: <strong>{viewingUser.id}</strong> · View-Only Mode
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setViewingUser(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  color: '#6b7280',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div style={{ padding: '20px 24px', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Hierarchy Notice Banner */}
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                  marginBottom: '20px',
                }}
              >
                <span style={{ fontSize: '18px', lineHeight: 1 }}>🛡️</span>
                <div style={{ fontSize: '12.5px', color: '#1e40af', lineHeight: 1.5 }}>
                  <strong>Hierarchy Protected:</strong> This user holds the role of <strong>{viewingUser.role}</strong> (Level {ROLE_HIERARCHY_LEVEL[viewingUser.role] || '—'}), which is at the same or upper level compared to your role (<strong>{currentUser?.role}</strong>, Level {ROLE_HIERARCHY_LEVEL[currentUser?.role] || '—'}). Under organizational governance rules, modifications and deletion are restricted.
                </div>
              </div>

              {/* User Fields Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '16px',
                  fontSize: '13px',
                }}
              >
                <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
                  <div style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Full Name</div>
                  <div style={{ fontWeight: 600, color: '#111827' }}>{viewingUser.name || '—'}</div>
                </div>

                <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
                  <div style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Username</div>
                  <div style={{ fontWeight: 600, color: '#111827' }}>{viewingUser.username || '—'}</div>
                </div>

                <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
                  <div style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Role & Level</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{viewingUser.role}</span>
                    <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      Level {ROLE_HIERARCHY_LEVEL[viewingUser.role] || '—'}
                    </span>
                  </div>
                </div>

                <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
                  <div style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Email Address</div>
                  <div style={{ color: '#111827' }}>{viewingUser.email || (viewingUser.username ? `${viewingUser.username}@paysonic.com` : '—')}</div>
                </div>

                <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
                  <div style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Contact Number</div>
                  <div style={{ color: '#111827' }}>{viewingUser.contact || viewingUser.mobile || '+91 98234 56789'}</div>
                </div>

                <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
                  <div style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Plaza Assignment</div>
                  <div style={{ color: '#111827' }}>{viewingUser.assignedPlaza || viewingUser.plaza || 'All Plazas (National)'}</div>
                </div>

                <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
                  <div style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Status</div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: viewingUser.status === 'Active' ? '#ecfdf5' : '#fef2f2',
                      color: viewingUser.status === 'Active' ? '#047857' : '#b91c1c',
                    }}
                  >
                    {viewingUser.status || 'Active'}
                  </span>
                </div>

                <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
                  <div style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Approval Status</div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: viewingUser.approval === 'Approved' ? '#ecfdf5' : '#fffbeb',
                      color: viewingUser.approval === 'Approved' ? '#047857' : '#b45309',
                    }}
                  >
                    {viewingUser.approval || 'Approved'}
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '14px 24px',
                background: '#f8fafc',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: canApproveTargetUser(viewingUser) ? 'space-between' : 'flex-end',
                alignItems: 'center',
              }}
            >
              {canApproveTargetUser(viewingUser) && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    await handleApproveUser(viewingUser.id);
                    setViewingUser(null);
                  }}
                  style={{
                    background: '#059669',
                    borderColor: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Approve User
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewingUser(null)}
                style={{ minWidth: '90px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserList;
