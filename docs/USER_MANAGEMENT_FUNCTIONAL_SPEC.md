# User Management — Functional Design Specification (v1.1)

**Module:** Admin Console → Access Control → User Management  
**Prepared for:** Paysonic Technologies Private Limited  
**Status:** Approved Reference Specification  
**Source input:** Original notes and reference wireframe supplied by the product/business team  
**v1.1 changes:** Master Admin / Admin now auto-assigned all plazas by default (Section 6); User Type sub-types defined as Toll Plaza, EV, Parking, Fuel, Other (Sections 5–6)  

---

## 1. Overview
User management today is split across three separate sub-pages — *Create User*, *Approve User*, and *Lock / Unlock User*. An administrator handling a single user account has to jump between three screens to onboard, verify and then control that account, which slows down routine admin work and makes the audit trail harder to follow.

This document specifies the redesigned module: **one consolidated User Management page** where creating, editing, approving, locking/unlocking and deleting a user are all available inline, together with the field-level, role-based and data-handling corrections called out in the original notes.

---

## 2. Current State vs. Redesign Objective
- **Current State:** Create User, Approve User, and Lock / Unlock User exist as three independent sub-pages.
- **Redesign Objective:** Consolidate Create, Edit, Approve, Lock / Unlock and Delete into one User Management page, so that:
  - Every user-facing action lives in one place — a searchable, filterable list with inline row actions.
  - Approval and lock state are visible at a glance as status badges, not separate pages.
  - The Add / Edit form reuses the same field set and validation rules for both creating a new user and editing an existing one.

---

## 3. Page Structure
The redesigned page is organized top to bottom as:
1. **Page Header:** Title (*User management*), description, *"Bulk upload"* secondary action, *"Add user"* primary action.
2. **Summary Strip (KPIs):** Total users, pending approvals, locked accounts, active plazas covered.
3. **Filter Bar:** Search by name / username / User ID, plus Role, Status and Plaza filters.
4. **User Table:** One row per user: identity, role & user type, assigned plaza(s), status badge, approval badge, and inline actions (Edit, Approve, Lock/Unlock, Delete).
5. **Add / Edit User Panel:** Opens over the table; same unified form for create and edit.
6. **Bulk Upload Panel:** CSV template download plus drag-and-drop upload.

---

## 4. Field-Level Specification & Validation Rules

| Field | Validation / Business Rule |
|---|---|
| **Username** | User-defined at creation; used for login. Must be unique across all accounts — checked on blur and submit. |
| **Email ID** | Validated against standard email format on the client and server-side. Duplicate emails return *"This email is already registered"* rather than a generic error. |
| **Contact number** | Standard 10-digit mobile validation (`^\d{10}$`). The same number may be reused across more than one user account (e.g., a shared plaza helpdesk line). |
| **Role** | Master Admin, Admin, Bank, Plaza Admin, Concessionaire, Plaza POS, Request Tag Details. Selecting *Master Admin*, *Admin*, or *Bank* hides the User Type field entirely. |
| **User Type** | Shown only for *Plaza Admin*, *Concessionaire*, *Plaza POS*, and *Request Tag Details*. Dropdown contains 5 sub-type values: **Toll Plaza**, **EV**, **Parking**, **Fuel**, and **Other**. |
| **Active Status** | *Active* / *Inactive* selector. |
| **Set Password** | Minimum 8 characters with at least one uppercase letter, one number, and one special character. Show/hide toggle provided. |
| **Confirm Password** | Must match Set Password; form blocks submission until both match. Show/hide toggle provided. |

---

## 5. Role-Based Access Logic (Conditional Matrix)

| Role | User Type Field | Plaza Assignment |
|---|---|---|
| **Master Admin** | Hidden — not applicable | **All plazas** — auto-assigned by default, no manual selection |
| **Admin** | Hidden — not applicable | **All plazas** — auto-assigned by default, no manual selection |
| **Bank** | Hidden — not applicable | **Not applicable** (bank-level view) |
| **Plaza Admin** | Shown (Toll Plaza / EV / Parking / Fuel / Other) | **Single plaza selector** |
| **Concessionaire** | Shown (Toll Plaza / EV / Parking / Fuel / Other) | **Multiple plazas** — multi-select interactive chips |
| **Plaza POS** | Shown (Toll Plaza / EV / Parking / Fuel / Other) | **Single plaza selector** |
| **Request Tag Details** | Shown (Toll Plaza / EV / Parking / Fuel / Other) | **Single plaza selector** |

---

## 6. Bulk User Upload Specification

Required CSV columns:
`username, email, contact, role, user_type, plaza, name, password`

- **Validation Rules:**
  - `username`: unique alphanumeric string.
  - `email`: standard email format; duplicate check.
  - `contact`: 10-digit number.
  - `role`: exact match with one of the 7 supported roles.
  - `user_type`: required if role is Plaza Admin, Concessionaire, Plaza POS, or Request Tag Details; blank otherwise.
  - `plaza`: plaza name, or semicolon-separated list for Concessionaire rows.
  - `name`: display name up to 100 characters.
  - `password`: satisfies the 8+ char, 1 upper, 1 digit, 1 symbol rule.
- **Error Handling:** All-or-nothing validation; row-level failures report row number and reason before any row is committed.
