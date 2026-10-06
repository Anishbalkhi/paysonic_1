/**
 * NPCI Function Codes, Plaza Master, and Transaction Master Constants
 * as specified in Paysonic Dispute & Chargeback Management Specification v1.0
 */

export const FUNCTION_CODES = [
  { code: 762, label: 'Credit Adjustment', desc: 'Credit Adjustment' },
  { code: 763, label: 'Debit Adjustment', desc: 'Debit Adjustment' },
  { code: 450, label: 'Debit Chargeback Raised', desc: 'Debit Chargeback Raised' },
  { code: 470, label: 'Debit Chargeback Acceptance', desc: 'Debit Chargeback Acceptance' },
  { code: 500, label: 'Chargeback Deemed Acceptance', desc: 'Chargeback Deemed Acceptance' },
  { code: 205, label: 'Re-presentment Raised (CB Decline)', desc: 'Re-presentment Raised (CB Decline)' },
  { code: 261, label: 'Re-presentment Acceptance', desc: 'Re-presentment Acceptance' },
  { code: 262, label: 'Re-presentment Deemed Acceptance', desc: 'Re-presentment Deemed Acceptance' },
  { code: 451, label: 'Credit Chargeback Raised', desc: 'Credit Chargeback Raised' },
  { code: 452, label: 'Credit Chargeback Acceptance', desc: 'Credit Chargeback Acceptance' },
  { code: 502, label: 'Credit Chargeback Deemed Acceptance', desc: 'Credit Chargeback Deemed Acceptance' },
  { code: 471, label: 'Pre-Arbitration Raised', desc: 'Pre-Arbitration Raised' },
  { code: 473, label: 'Pre-Arbitration Declined', desc: 'Pre-Arbitration Declined' },
  { code: 474, label: 'Pre-Arbitration Acceptance', desc: 'Pre-Arbitration Acceptance' },
  { code: 509, label: 'Pre-Arbitration Deemed Acceptance', desc: 'Pre-Arbitration Deemed Acceptance' },
  { code: 479, label: 'Arbitration Raised', desc: 'Arbitration Raised' },
  { code: 480, label: 'Arbitration Acceptance', desc: 'Arbitration Acceptance' },
  { code: 481, label: 'Arbitration Continuation', desc: 'Arbitration Continuation' },
  { code: 482, label: 'Arbitration Withdrawal', desc: 'Arbitration Withdrawal' },
  { code: 483, label: 'Arbitration Verdict', desc: 'Arbitration Verdict' },
  { code: 504, label: 'Arbitration Deemed Continuation', desc: 'Arbitration Deemed Continuation' },
  { code: 680, label: 'Goodfaith Raised', desc: 'Goodfaith Raised' },
  { code: 681, label: 'Goodfaith Raise Acceptance', desc: 'Goodfaith Raise Acceptance' },
  { code: 682, label: 'Goodfaith Raise Decline', desc: 'Goodfaith Raise Decline' },
  { code: 505, label: 'Goodfaith Deemed Decline', desc: 'Goodfaith Deemed Decline' },
];

export const FUNCTION_CODE_MAP = FUNCTION_CODES.reduce((acc, f) => {
  acc[f.code] = f.label;
  return acc;
}, {});

export const DEFAULT_PLAZAS = [
  { id: '501101', name: 'MUMBAI PLAZA NH-04' },
  { id: '502202', name: 'PUNE BYPASS PLAZA' },
  { id: '503303', name: 'NASHIK TOLL PLAZA' },
  { id: '504404', name: 'KOLHAPUR PLAZA' },
  { id: '505505', name: 'SOLAPUR PLAZA NH-65' },
  { id: '908895', name: 'JAIPUR' },
  { id: '787887', name: 'JEET' },
  { id: '787878', name: 'PLAZA 1' },
  { id: '121212', name: 'OCTOBER' },
  { id: '111111', name: 'PAY PAY 1' },
  { id: '111679', name: 'PAY 1' },
  { id: '161616', name: 'ARCON' },
  { id: '161619', name: 'ARCON' },
  { id: '745643', name: 'ERHSHR' },
  { id: '222222', name: 'PAY1' },
  { id: '000000', name: 'DELL' },
];

export const PLAZA_MAP = DEFAULT_PLAZAS.reduce((acc, p) => {
  acc[p.id] = p.name;
  return acc;
}, {});

/**
 * Transaction Master Authority:
 * Used for RRN / Acq Txn ID lookup and matching against real onboarded plazas
 */
export const TRANSACTION_MASTER = {
  '102047735808524718': { tollTxnId: 'AM020905', vrn: 'MH12VL3467', tagId: '34161FA820328EB002947820', plazaId: '501101', plazaName: 'MUMBAI PLAZA NH-04', txnDate: '02-09-2026 05:30:00', txnAmount: 5.00 },
  '102047735808524720': { tollTxnId: 'AM020906', vrn: 'MH12VL3467', tagId: '34161FA820328EB002947820', plazaId: '502202', plazaName: 'PUNE BYPASS PLAZA', txnDate: '02-09-2026 06:30:00', txnAmount: 5.00 },
  '102047735808524714': { tollTxnId: 'AM020903', vrn: 'MH12VL3467', tagId: '34161FA820328EB002947820', plazaId: '503303', plazaName: 'NASHIK TOLL PLAZA', txnDate: '02-09-2026 03:30:00', txnAmount: 5.00 },
  '102047735808524716': { tollTxnId: 'AM020904', vrn: 'MH12VL3467', tagId: '34161FA820328EB002947820', plazaId: '504404', plazaName: 'KOLHAPUR PLAZA', txnDate: '02-09-2026 04:30:00', txnAmount: 5.00 },
  '102047735808524712': { tollTxnId: 'AM020902', vrn: 'MH12VL3467', tagId: '34161FA820328EB002947820', plazaId: '505505', plazaName: 'SOLAPUR PLAZA NH-65', txnDate: '02-09-2026 02:30:00', txnAmount: 5.00 },
  '102047735808524722': { tollTxnId: 'AM020907', vrn: 'MH12VL3467', tagId: '34161FA820328EB002947820', plazaId: '908895', plazaName: 'JAIPUR', txnDate: '02-09-2026 07:30:00', txnAmount: 5.00 },
  '102047735808524706': { tollTxnId: 'SK030902', vrn: '34MH51FA820', tagId: '34161FA82032866C03B7B640', plazaId: '787887', plazaName: 'JEET', txnDate: '03-09-2026 10:00:00', txnAmount: 25.00 },
  '102047735808524702': { tollTxnId: 'ZP030902', vrn: 'GH92DD6152', tagId: '34161FA82033E8260213B680', plazaId: '787878', plazaName: 'PLAZA 1', txnDate: '02-09-2026 02:00:00', txnAmount: 5.00 },
  '102047735808524700': { tollTxnId: 'ZP030901', vrn: 'GH92DD6152', tagId: '34161FA82033E8260213B680', plazaId: '121212', plazaName: 'OCTOBER', txnDate: '02-09-2026 01:00:00', txnAmount: 5.00 },
  '102047735808524698': { tollTxnId: 'ZP020929', vrn: 'GH92DD6152', tagId: '34161FA82032866C020F7D20', plazaId: '111111', plazaName: 'PAY PAY 1', txnDate: '02-09-2026 11:00:00', txnAmount: 80.00 },
  '102047735808524696': { tollTxnId: 'ZP020928', vrn: 'GH92DD6152', tagId: '34161FA82032866C020F7D20', plazaId: '161616', plazaName: 'ARCON', txnDate: '02-09-2026 10:00:00', txnAmount: 80.00 },
  '102047735808524451': { tollTxnId: 'IBKL-350', vrn: 'GH92DD6152', tagId: '34161FA82032866C03B7B640', plazaId: '745643', plazaName: 'ERHSHR', txnDate: '30-08-2026 12:00:00', txnAmount: 5.00 },
  '102047735808524453': { tollTxnId: 'IBKL-351', vrn: 'GH92DD6152', tagId: '34161FA82032866C03B7B640', plazaId: '501101', plazaName: 'MUMBAI PLAZA NH-04', txnDate: '30-08-2026 13:00:00', txnAmount: 5.00 },
  '102047735808524455': { tollTxnId: 'IBKL-352', vrn: 'GH92DD6152', tagId: '34161FA82032866C03B7B640', plazaId: '502202', plazaName: 'PUNE BYPASS PLAZA', txnDate: '30-08-2026 14:00:00', txnAmount: 5.00 },
  '102047735808524457': { tollTxnId: 'IBKL-353', vrn: 'GH92DD6152', tagId: '34161FA82032866C03B7B640', plazaId: '503303', plazaName: 'NASHIK TOLL PLAZA', txnDate: '30-08-2026 15:00:00', txnAmount: 5.00 },
  '102047735808524459': { tollTxnId: 'IBKL-354', vrn: 'GH92DD6152', tagId: '34161FA82032866C03B7B640', plazaId: '504404', plazaName: 'KOLHAPUR PLAZA', txnDate: '30-08-2026 16:00:00', txnAmount: 5.00 },
};

export const DEFAULT_TAT_DAYS = 7;
