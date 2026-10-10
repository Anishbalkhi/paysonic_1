-- ==============================================================================
-- Paysonic Toll Ops Platform - MySQL 8.x Database Schema
-- Modules: User Management (v1.1) & User Activity / Audit Trail (v1.0)
-- ==============================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
    `id` VARCHAR(32) NOT NULL,
    `username` VARCHAR(50) NULL,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(120) NOT NULL UNIQUE,
    `mobile` VARCHAR(20) NOT NULL,
    `role` VARCHAR(50) NOT NULL,
    `user_type` VARCHAR(50) NOT NULL DEFAULT 'Toll Plaza',
    `assigned_plaza` VARCHAR(100) NULL,
    `plazas_json` TEXT NULL,
    `menu_access_json` TEXT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'Pending',
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
    `device_id` VARCHAR(64) NULL,
    `reason` VARCHAR(150) NULL,
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

-- 11. Toll Transactions Table (TRS Report)
CREATE TABLE IF NOT EXISTS `toll_transactions` (
    `id` BIGINT AUTO_INCREMENT NOT NULL,
    `acq_txn_id` VARCHAR(32) NOT NULL UNIQUE,
    `toll_file_name` VARCHAR(50) NOT NULL DEFAULT 'ONLINE',
    `plaza_id` VARCHAR(32) NOT NULL,
    `plaza_name` VARCHAR(120) NOT NULL,
    `lane_id` VARCHAR(32) NOT NULL,
    `tag_id` VARCHAR(64) NOT NULL,
    `vrn` VARCHAR(32) NOT NULL,
    `toll_txn_id` VARCHAR(32) NOT NULL,
    `toll_message_id` VARCHAR(32) NOT NULL,
    `mvc` VARCHAR(16) NULL,
    `tag_vc` VARCHAR(16) NULL,
    `avc` VARCHAR(16) NULL,
    `status` VARCHAR(32) NOT NULL,
    `reason` VARCHAR(64) NULL,
    `txn_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `settled_amount` DECIMAL(10, 2) NULL,
    `txn_date` DATETIME NOT NULL,
    `plaza_post_date` DATETIME NULL,
    `npci_error_code` VARCHAR(32) NULL,
    `npci_settled_date` DATETIME NULL,
    `clearing_cycle` VARCHAR(32) NULL,
    `plaza_settle_date` DATETIME NULL,
    `txn_type` VARCHAR(32) NULL,
    `npci_resp_date` DATETIME NULL,
    `plaza_type` VARCHAR(32) NOT NULL DEFAULT 'Toll',
    `is_violation` VARCHAR(8) NOT NULL DEFAULT 'No',
    `audit_vc` VARCHAR(32) NULL DEFAULT 'NA',
    `violation_settled_amount` DECIMAL(10, 2) NULL,
    `violation_settled_date` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_trs_txn_date` (`txn_date`),
    INDEX `idx_trs_plaza_date` (`plaza_id`, `txn_date`),
    INDEX `idx_trs_status` (`status`),
    INDEX `idx_trs_acq_txn_id` (`acq_txn_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Dispute Batches Table
CREATE TABLE IF NOT EXISTS `dispute_batches` (
    `id` BIGINT AUTO_INCREMENT NOT NULL,
    `batch_id` VARCHAR(64) NOT NULL UNIQUE,
    `file_name` VARCHAR(255) NOT NULL,
    `uploaded_by` VARCHAR(100) NOT NULL DEFAULT 'Master Admin',
    `upload_timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `total_rows` INT NOT NULL DEFAULT 0,
    `matched_rows` INT NOT NULL DEFAULT 0,
    `unmatched_rows` INT NOT NULL DEFAULT 0,
    `duplicate_rows` INT NOT NULL DEFAULT 0,
    `status` VARCHAR(32) NOT NULL DEFAULT 'Processed',
    PRIMARY KEY (`id`),
    INDEX `idx_batch_id` (`batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12.1 Dispute Transactions Table
CREATE TABLE IF NOT EXISTS `dispute_transactions` (
    `id` BIGINT AUTO_INCREMENT NOT NULL,
    `dispute_id` VARCHAR(64) NULL,
    `batch_id` VARCHAR(64) NULL,
    `plaza_name` VARCHAR(120) NOT NULL,
    `plaza_id` VARCHAR(32) NOT NULL,
    `acq_txn_id` VARCHAR(32) NOT NULL,
    `toll_txn_id` VARCHAR(32) NOT NULL,
    `lane_id` VARCHAR(32) NULL DEFAULT 'Lane-01',
    `txn_date_time` DATETIME NOT NULL,
    `txn_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `dispute_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `vehicle_no` VARCHAR(32) NOT NULL,
    `tag_id` VARCHAR(64) NOT NULL,
    `tid` VARCHAR(64) NOT NULL,
    `issuer_id` VARCHAR(32) NOT NULL,
    `int_tracking_no` VARCHAR(32) NULL DEFAULT 'NA',
    `function_code` VARCHAR(64) NOT NULL,
    `function_label` VARCHAR(100) NULL,
    `settlement_indicator` VARCHAR(10) NOT NULL DEFAULT 'Dr',
    `message_reason_code` VARCHAR(100) NULL,
    `member_message_text` VARCHAR(255) NULL,
    `settlement_date` VARCHAR(32) NULL,
    `tat_due_date` VARCHAR(32) NULL,
    `cb_raised_date` VARCHAR(32) NULL,
    `npci_settlement_date` DATE NULL,
    `assigned` BOOLEAN NOT NULL DEFAULT FALSE,
    `assigned_at` DATETIME NULL,
    `assigned_to_plaza` VARCHAR(32) NULL,
    `admin_remarks` VARCHAR(500) NULL,
    `admin_remarks_at` DATETIME NULL,
    `plaza_action` VARCHAR(32) NULL,
    `plaza_action_at` DATETIME NULL,
    `plaza_action_time` VARCHAR(32) NULL,
    `plaza_action_by` VARCHAR(100) NULL,
    `plaza_remarks` VARCHAR(500) NULL,
    `counter_evidence_name` VARCHAR(255) NULL,
    `counter_evidence_url` TEXT NULL,
    `dispute_status` VARCHAR(32) NOT NULL DEFAULT 'NA',
    `lifecycle_status` VARCHAR(64) NOT NULL DEFAULT 'Pending Assignment',
    `closed` BOOLEAN NOT NULL DEFAULT FALSE,
    `closed_at` DATETIME NULL,
    `closed_by` VARCHAR(100) NULL,
    `close_remarks` VARCHAR(500) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_disp_dispute_id` (`dispute_id`),
    INDEX `idx_disp_batch_id` (`batch_id`),
    INDEX `idx_disp_acq_txn_id` (`acq_txn_id`),
    INDEX `idx_disp_txn_date` (`txn_date_time`),
    INDEX `idx_disp_plaza_date` (`plaza_id`, `txn_date_time`),
    INDEX `idx_disp_func_code` (`function_code`),
    INDEX `idx_disp_tag_id` (`tag_id`),
    INDEX `idx_disp_lifecycle` (`lifecycle_status`),
    INDEX `idx_disp_assigned` (`assigned`, `assigned_to_plaza`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Violation Transactions Table (Violation Bulk Action)

CREATE TABLE IF NOT EXISTS `violation_transactions` (
    `id` BIGINT AUTO_INCREMENT NOT NULL,
    `plaza_id` VARCHAR(32) NOT NULL,
    `plaza_name` VARCHAR(120) NOT NULL,
    `vrn` VARCHAR(32) NOT NULL,
    `tag_id` VARCHAR(64) NOT NULL,
    `acq_txn_id` VARCHAR(32) NOT NULL,
    `toll_txn_id` VARCHAR(32) NOT NULL,
    `txn_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `txn_date_time` DATETIME NOT NULL,
    `mvc` VARCHAR(16) NULL,
    `avc` VARCHAR(16) NULL,
    `audit_vc` VARCHAR(16) NULL DEFAULT 'NA',
    `audit_remark` VARCHAR(255) NULL,
    `audit_desc` VARCHAR(255) NULL,
    `violation_img` VARCHAR(16) NOT NULL DEFAULT 'YES',
    `netc_txn_type` VARCHAR(32) NOT NULL DEFAULT 'DEBIT',
    `violation_api_status` VARCHAR(32) NOT NULL DEFAULT 'ACCEPTED',
    `action_status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_viol_txn_date` (`txn_date_time`),
    INDEX `idx_viol_plaza_date` (`plaza_id`, `txn_date_time`),
    INDEX `idx_viol_api_status` (`violation_api_status`),
    INDEX `idx_viol_tag_id` (`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Violation Raw Files Table (Violation Raw File Report)
CREATE TABLE IF NOT EXISTS `violation_raw_files` (
    `id` BIGINT AUTO_INCREMENT NOT NULL,
    `tag_id` VARCHAR(64) NOT NULL,
    `function_code` VARCHAR(16) NOT NULL DEFAULT '763',
    `txn_time` VARCHAR(32) NOT NULL,
    `txn_id` VARCHAR(64) NOT NULL,
    `issuer_id` VARCHAR(32) NOT NULL,
    `acquirer_id` VARCHAR(32) NOT NULL DEFAULT '720030',
    `txn_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `reason_code` VARCHAR(16) NOT NULL DEFAULT '1005',
    `full_partial_indicator` VARCHAR(8) NOT NULL DEFAULT 'P',
    `toll_plaza_id` VARCHAR(32) NOT NULL DEFAULT '501101',
    `tid` VARCHAR(64) NOT NULL,
    `mmt` VARCHAR(64) NULL,
    `internal_tracking_number` VARCHAR(64) NULL DEFAULT 'NA',
    `parsed_date_time` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_raw_tag_id` (`tag_id`),
    INDEX `idx_raw_txn_id` (`txn_id`),
    INDEX `idx_raw_plaza_id` (`toll_plaza_id`),
    INDEX `idx_raw_txn_time` (`txn_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Violation Settlement Reports Table
CREATE TABLE IF NOT EXISTS `violation_settlement_reports` (
    `id` BIGINT AUTO_INCREMENT NOT NULL,
    `plaza_id` VARCHAR(32) NOT NULL,
    `plaza_name` VARCHAR(120) NOT NULL,
    `tag_id` VARCHAR(64) NOT NULL,
    `vrn` VARCHAR(32) NOT NULL,
    `acq_txn_id` VARCHAR(32) NOT NULL,
    `toll_txn_id` VARCHAR(32) NOT NULL,
    `txn_date_time` DATETIME NOT NULL,
    `mvc` VARCHAR(16) NULL,
    `avc` VARCHAR(16) NULL,
    `audit_vc` VARCHAR(16) NULL,
    `audit_remark` VARCHAR(64) NULL,
    `npci_violation_status` VARCHAR(32) NOT NULL DEFAULT 'ACCEPTED',
    `txn_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `violation_adjustment_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `violation_settlement_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `settlement_date` DATE NULL,
    `img_received_time` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_vset_txn_date` (`txn_date_time`),
    INDEX `idx_vset_plaza_date` (`plaza_id`, `txn_date_time`),
    INDEX `idx_vset_tag_id` (`tag_id`),
    INDEX `idx_vset_vrn` (`vrn`),
    INDEX `idx_vset_status` (`npci_violation_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Violation Validate Reports Table (Violation Validate Report)
CREATE TABLE IF NOT EXISTS `violation_validate_reports` (
    `id` BIGINT AUTO_INCREMENT NOT NULL,
    `sr_no` INT NULL,
    `take_action` VARCHAR(50) NOT NULL DEFAULT 'Actioned',
    `plaza_id` VARCHAR(32) NOT NULL,
    `plaza_name` VARCHAR(120) NOT NULL,
    `vrn` VARCHAR(32) NOT NULL,
    `tag_id` VARCHAR(64) NOT NULL,
    `acq_txn_id` VARCHAR(64) NOT NULL,
    `toll_txn_id` VARCHAR(64) NOT NULL,
    `txn_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `txn_date_time` DATETIME NOT NULL,
    `mvc` VARCHAR(20) NULL,
    `avc` VARCHAR(20) NULL,
    `audit_vc` VARCHAR(20) NULL,
    `audit_remark` VARCHAR(50) NULL,
    `audit_desc` VARCHAR(255) NULL,
    `violation_img` VARCHAR(10) NOT NULL DEFAULT 'YES',
    `netc_txn_type` VARCHAR(20) NOT NULL DEFAULT 'DEBIT',
    `violation_api_status` VARCHAR(50) NOT NULL DEFAULT 'APPROVED',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_vval_txn_date` (`txn_date_time`),
    INDEX `idx_vval_plaza_date` (`plaza_id`, `txn_date_time`),
    INDEX `idx_vval_tag_id` (`tag_id`),
    INDEX `idx_vval_vrn` (`vrn`),
    INDEX `idx_vval_status` (`violation_api_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. NHAI Traffic Reports Table (NHAI Traffic Report)
CREATE TABLE IF NOT EXISTS `nhai_traffic_reports` (
    `id` BIGINT AUTO_INCREMENT NOT NULL,
    `plaza_code` VARCHAR(32) NOT NULL,
    `plaza_name` VARCHAR(128) NOT NULL,
    `report_date` DATE NOT NULL,
    `vehicle_class_code` VARCHAR(20) NOT NULL,
    `vehicle_class_name` VARCHAR(100) NOT NULL,
    `journey_type` VARCHAR(50) NOT NULL,
    `toll_fare` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `transaction_count` BIGINT NOT NULL DEFAULT 0,
    `transaction_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `display_order` INT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_nhai_plaza_date` (`plaza_code`, `report_date`),
    INDEX `idx_nhai_date` (`report_date`),
    INDEX `idx_nhai_vc` (`vehicle_class_code`),
    INDEX `idx_nhai_journey` (`journey_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. Transaction Summary Reports Table (Transaction Summary Report)
CREATE TABLE IF NOT EXISTS `transaction_summary_reports` (
    `id` BIGINT AUTO_INCREMENT NOT NULL,
    `plaza_id` VARCHAR(32) NOT NULL,
    `plaza_name` VARCHAR(128) NOT NULL,
    `report_date` DATE NOT NULL,
    `transaction_status` VARCHAR(50) NOT NULL,
    `response_code` VARCHAR(50) NOT NULL,
    `transaction_count` BIGINT NOT NULL DEFAULT 0,
    `transaction_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `display_order` INT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_txn_sum_plaza_date` (`plaza_id`, `report_date`),
    INDEX `idx_txn_sum_date` (`report_date`),
    INDEX `idx_txn_sum_status` (`transaction_status`),
    INDEX `idx_txn_sum_code` (`response_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. Pass Summary Reports Table (Pass Summary Report)
CREATE TABLE IF NOT EXISTS `pass_summary_reports` (
    `id` BIGINT AUTO_INCREMENT NOT NULL,
    `plaza_id` VARCHAR(32) NOT NULL,
    `plaza_name` VARCHAR(128) NOT NULL,
    `report_date` DATE NOT NULL,
    `payment_mode` VARCHAR(50) NOT NULL,
    `pass_type` VARCHAR(100) NOT NULL,
    `pass_count` BIGINT NOT NULL DEFAULT 0,
    `pass_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `display_order` INT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_pass_sum_plaza_date` (`plaza_id`, `report_date`),
    INDEX `idx_pass_sum_date` (`report_date`),
    INDEX `idx_pass_sum_mode` (`payment_mode`),
    INDEX `idx_pass_sum_type` (`pass_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



