/**
 * npciFileNameParser.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Parser and validator for NPCI FASTag Clearing & Settlement file names.
 *
 * Primary Specification:
 * - 01 File is shared in .csv format by NPCI & system should accept ONLY .csv format.
 * - 01 File is uploaded at Dispute File Upload (/dispute-handling/file-upload).
 * - File name contains alphanumeric combination indicating the date when the file was released by NPCI.
 *
 * Example: 011IBKL2590002223113.csv
 *
 * Breakdown:
 *   - "01"       : File Type (01 = Dispute / Chargeback Raised File)
 *   - "1"        : Subtype / Direction (1 = Acquirer Flow, 2 = Issuer Flow)
 *   - "IBKL"     : 4-character Participant / Bank Identifier (e.g. IDBI Bank Acquirer)
 *   - "259000"   : 6-character Cycle / Stream Routing Code
 *   - "22"       : 2-digit Year (e.g. 22 = 2022, 26 = 2026)
 *   - "231"      : 3-digit Julian Date (Day of the year, e.g. Day 231 = 19 August)
 *   - "13"       : Last 2 digits = Daily file sequence number indicating how many files
 *                  were shared by NPCI on that same day (File #13 on Day 231).
 */

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Converts a year and Julian Day (1-366) into a calendar date.
 * Returns DD-MM-YYYY and detailed locale string.
 */
export function getCalendarDateFromJulian(year, julianDay) {
  const dateObj = new Date(Date.UTC(year, 0, julianDay));
  const pad2 = (n) => String(n).padStart(2, '0');
  const dd = pad2(dateObj.getUTCDate());
  const mm = pad2(dateObj.getUTCMonth() + 1);
  const yyyy = dateObj.getUTCFullYear();

  const formatted = `${dd}-${mm}-${yyyy}`;
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const monthName = dateObj.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  const fullText = `${dayName}, ${dd} ${monthName} ${yyyy}`;

  return { formatted, fullText, dateObj, day: dd, month: mm, year: yyyy };
}

/**
 * Checks whether a given filename has a .csv extension.
 */
export function isCsvFile(fileName) {
  if (!fileName || typeof fileName !== 'string') return false;
  return fileName.trim().toLowerCase().endsWith('.csv');
}

/**
 * Parses an NPCI 01 File Name.
 *
 * @param {string} fileName - e.g. '011IBKL2590002223113.csv'
 * @returns {object} Parsed metadata & validation status
 */
export function parseNpci01FileName(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    return {
      isValid: false,
      isCsv: false,
      is01File: false,
      error: 'Please choose a valid file.',
    };
  }

  const cleanName = fileName.trim();
  const isCsv = cleanName.toLowerCase().endsWith('.csv');
  const baseName = cleanName.replace(/\.csv$/i, '');

  // 1. Strict CSV check
  if (!isCsv) {
    const extMatch = cleanName.match(/\.[^.]+$/);
    const ext = extMatch ? extMatch[0] : 'unknown';
    return {
      isValid: false,
      isCsv: false,
      is01File: false,
      baseName,
      fileName: cleanName,
      error: `Only .csv format is accepted for NPCI 01 Dispute files. System rejected '${ext}' file.`,
      warning: 'NPCI only distributes 01 dispute files in CSV format.',
    };
  }

  const is01File = baseName.startsWith('01');

  // Check if minimum length holds
  if (baseName.length < 7) {
    return {
      isValid: false,
      isCsv: true,
      is01File,
      baseName,
      fileName: cleanName,
      error: 'File name is too short to be a valid NPCI file.',
      warning: 'Expected standard NPCI alphanumeric format (e.g. 011IBKL2590002223113.csv).',
    };
  }

  // 2. User Specification:
  // "in this file last two digits are file number in same day how many files shared by NPCI & after last two digit next three digits shows Julian date on which day file shared by NPCI"
  const fileNumberStr = baseName.slice(-2);
  const julianStr = baseName.slice(-5, -2);
  const yearCandidateStr = baseName.slice(-7, -5);

  const isLast2Numeric = /^\d{2}$/.test(fileNumberStr);
  const isPrev3Numeric = /^\d{3}$/.test(julianStr);

  if (!isLast2Numeric || !isPrev3Numeric) {
    return {
      isValid: false,
      isCsv: true,
      is01File,
      baseName,
      fileName: cleanName,
      error: 'File name does not match the NPCI 01 structure: last 2 digits must be the daily file number and preceding 3 digits must be the Julian date.',
      warning: 'Example valid format: 011IBKL2590002223113.csv',
    };
  }

  const fileNumber = parseInt(fileNumberStr, 10);
  const julianDay = parseInt(julianStr, 10);

  // 3. Resolve Year
  let year = new Date().getFullYear();
  if (/^\d{2}$/.test(yearCandidateStr)) {
    const yy = parseInt(yearCandidateStr, 10);
    // Assume years between 2000 and 2099
    year = 2000 + yy;
  }

  // Validate Julian Day range
  const maxDays = isLeapYear(year) ? 366 : 365;
  if (julianDay < 1 || julianDay > maxDays) {
    return {
      isValid: false,
      isCsv: true,
      is01File,
      baseName,
      fileName: cleanName,
      error: `Invalid Julian day (${julianStr}). Year ${year} has days between 001 and ${maxDays}.`,
    };
  }

  // 4. Calculate calendar release date
  const { formatted: releaseDate, fullText: releaseDateLong } = getCalendarDateFromJulian(year, julianDay);

  // 5. Extract Participant / Bank Code & Flow
  // Standard NPCI structure:
  // Position 0-1: '01'
  // Position 2: '1' (Direction: Acquirer = 1, Issuer = 2)
  // Position 3-6: 4-character Bank Code (e.g. IBKL)
  let flowCode = '1';
  let flowLabel = 'Acquirer Flow';
  let bankCode = 'NPCI';
  let cycleCode = '';

  if (baseName.length >= 7) {
    flowCode = baseName.charAt(2);
    flowLabel = flowCode === '1' ? 'Acquirer Flow (1)' : flowCode === '2' ? 'Issuer Flow (2)' : `Flow (${flowCode})`;

    const bankSegment = baseName.slice(3, 7);
    if (/^[A-Za-z0-9]{4}$/.test(bankSegment)) {
      bankCode = bankSegment.toUpperCase();
    }
  }

  if (baseName.length >= 13) {
    cycleCode = baseName.slice(7, 13);
  }

  const breakdown = [
    { label: 'File Type', code: '01', desc: 'Dispute / Chargeback Raised File' },
    { label: 'Direction', code: flowCode, desc: flowLabel },
    { label: 'Acquirer / Bank', code: bankCode, desc: `Bank Code: ${bankCode}` },
    ...(cycleCode ? [{ label: 'Settlement Stream', code: cycleCode, desc: `Cycle Code: ${cycleCode}` }] : []),
    { label: 'Release Year', code: String(year).slice(-2), desc: `Calendar Year ${year}` },
    { label: 'Julian Date', code: julianStr, desc: `Day ${julianDay} of ${maxDays} (${releaseDate})` },
    { label: 'Daily File Sequence', code: fileNumberStr, desc: `File #${fileNumberStr} (Total #${fileNumber} on same day)` },
  ];

  return {
    isValid: true,
    isCsv: true,
    is01File: true,
    fileName: cleanName,
    baseName,
    fileType: '01',
    fileTypeLabel: '01 File (NPCI Chargeback / Dispute Raised File)',
    flowCode,
    flowLabel,
    bankCode,
    cycleCode,
    fileNumberStr,
    fileNumber,
    fileNumberLabel: `File #${fileNumberStr} (Sequence #${fileNumber} on same day)`,
    julianDateStr: julianStr,
    julianDay,
    year,
    releaseDate, // Standard DD-MM-YYYY
    releaseDateFormatted: releaseDate,
    releaseDateLong,
    breakdown,
  };
}

export default parseNpci01FileName;
