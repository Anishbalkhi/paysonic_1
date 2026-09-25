-- ==============================================================================
-- Paysonic Toll Ops Platform - MySQL 8.x Database Schema
-- Modules: User Management (v1.1) & User Activity / Audit Trail (v1.0)
-- ==============================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
    `id` VARCHAR(32) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(120) NOT NULL UNIQUE,
    `mobile` VARCHAR(20) NOT NULL,
    `role` VARCHAR(50) NOT NULL,
    `user_type` VARCHAR(50) NOT NULL DEFAULT 'Toll Plaza',
    `assigned_plaza` VARCHAR(100) NULL,
    `plazas_json` TEXT NULL,
    `menu_access_json` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Pending',
    `approval` VARCHAR(20) NOT NULL DEFAULT 'Pending',
    `locked` BOOLEAN NOT NULL DEFAULT FALSE,
    `password` VARCHAR(120) NOT NULL DEFAULT 'Paysonic@2026',
    `avatar` VARCHAR(255) NULL,
    `last_active` DATETIME NULL,
    `created_by` VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
    `approved_by` VARCHAR(50) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_users_role` (`role`),
    INDEX `idx_users_status` (`status`),
    INDEX `idx_users_approval` (`approval`),
    INDEX `idx_users_locked` (`locked`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. User Active Sessions Table (UAM-FR-005)
CREATE TABLE IF NOT EXISTS `user_sessions` (
    `session_id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(32) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `role` VARCHAR(50) NOT NULL,
    `plaza` VARCHAR(100) NOT NULL DEFAULT 'All plazas',
    `ip_address` VARCHAR(45) NOT NULL,
    `device` VARCHAR(100) NOT NULL,
    `login_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `last_active` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Active',
    PRIMARY KEY (`session_id`),
    INDEX `idx_sessions_user_id` (`user_id`),
    INDEX `idx_sessions_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Login History Table (UAM-FR-008, UAM-FR-009)
CREATE TABLE IF NOT EXISTS `login_history` (
    `id` BIGINT AUTO_INCREMENT NOT NULL,
    `user_id` VARCHAR(32) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `role` VARCHAR(50) NOT NULL,
    `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `ip_address` VARCHAR(45) NOT NULL,
    `device` VARCHAR(100) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'Success',
    `failure_reason` VARCHAR(255) NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_login_user_id` (`user_id`),
    INDEX `idx_login_timestamp` (`timestamp`),
    INDEX `idx_login_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Audit Ledger Table (UAM-FR-010 to UAM-FR-016)
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` VARCHAR(32) NOT NULL,
    `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `module` VARCHAR(80) NOT NULL,
    `action` VARCHAR(80) NOT NULL,
    `action_label` VARCHAR(120) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    `actor_id` VARCHAR(32) NOT NULL,
    `actor_name` VARCHAR(100) NOT NULL,
    `actor_role` VARCHAR(50) NOT NULL,
    `actor_ip` VARCHAR(45) NOT NULL,
    `plaza` VARCHAR(100) NOT NULL DEFAULT 'All plazas',
    `target` VARCHAR(150) NOT NULL,
    `reference_id` VARCHAR(64) NULL,
    `correlation_id` VARCHAR(64) NULL,
    `details` TEXT NOT NULL,
    `before_json` LONGTEXT NULL,
    `after_json` LONGTEXT NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_audit_module` (`module`),
    INDEX `idx_audit_status` (`status`),
    INDEX `idx_audit_plaza` (`plaza`),
    INDEX `idx_audit_timestamp` (`timestamp`),
    INDEX `idx_audit_actor_id` (`actor_id`),
    INDEX `idx_audit_reference_id` (`reference_id`),
    INDEX `idx_audit_correlation_id` (`correlation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Concessionaires Table
CREATE TABLE IF NOT EXISTS `concessionaires` (
    `id` VARCHAR(32) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `address` VARCHAR(255) NULL,
    `mail` VARCHAR(120) NULL,
    `contact` VARCHAR(30) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Plazas Table
CREATE TABLE IF NOT EXISTS `plazas` (
    `id` VARCHAR(32) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `org_id` VARCHAR(50) NULL,
    `agency_id` VARCHAR(50) NULL,
    `concessionaire_id` VARCHAR(32) NULL,
    `category` VARCHAR(50) NOT NULL DEFAULT 'Toll',
    `base_pricing` VARCHAR(50) NOT NULL DEFAULT 'Distance Based',
    `plaza_interface` VARCHAR(50) NOT NULL DEFAULT 'API',
    `subtype` VARCHAR(50) NOT NULL DEFAULT 'National',
    `authority` VARCHAR(50) NOT NULL DEFAULT 'NHAI',
    `state` VARCHAR(80) NULL,
    `city` VARCHAR(80) NULL,
    `activation_date` VARCHAR(30) NULL,
    `geo_code` VARCHAR(80) NULL,
    `scheme_rule` VARCHAR(50) NULL,
    `scheme_duration` VARCHAR(50) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'Active',
    `public_key` TEXT NULL,
    `contact_address` VARCHAR(255) NULL,
    `contact_no` VARCHAR(30) NULL,
    `contact_mail` VARCHAR(120) NULL,
    `mdr_json` TEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_plazas_concessionaire` (`concessionaire_id`),
    INDEX `idx_plazas_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Lanes Table
CREATE TABLE IF NOT EXISTS `lanes` (
    `id` VARCHAR(64) NOT NULL,
    `plaza_id` VARCHAR(32) NOT NULL,
    `lane_id` VARCHAR(32) NOT NULL,
    `direction` VARCHAR(20) NOT NULL DEFAULT 'North',
    `type` VARCHAR(20) NOT NULL DEFAULT 'Entry',
    `mode` VARCHAR(30) NOT NULL DEFAULT 'Normal',
    `category` VARCHAR(30) NOT NULL DEFAULT 'Hybrid',
    `status` VARCHAR(30) NOT NULL DEFAULT 'Open',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_lanes_plaza_id` (`plaza_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Plaza Callbacks Table
CREATE TABLE IF NOT EXISTS `plaza_callbacks` (
    `plaza_id` VARCHAR(32) NOT NULL,
    `callbacks_json` LONGTEXT NOT NULL,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`plaza_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Plaza Toll Fare Matrix Table
CREATE TABLE IF NOT EXISTS `plaza_fares` (
    `plaza_id` VARCHAR(32) NOT NULL,
    `fares_json` LONGTEXT NOT NULL,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`plaza_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Plaza CCH Mapping Table
CREATE TABLE IF NOT EXISTS `plaza_cch` (
    `plaza_id` VARCHAR(32) NOT NULL,
    `cch_json` LONGTEXT NOT NULL,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`plaza_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
