/**
 * Paysonic Audit Diff Utility
 * Computes deep before / after differences for change audit inspection
 */

export const buildDiff = (before, after) => {
  if (!before && !after) return [];
  if (!before && after) {
    return Object.keys(after).map((key) => ({
      field: formatFieldName(key),
      rawKey: key,
      before: null,
      after: formatValue(after[key]),
      type: 'added',
    }));
  }
  if (before && !after) {
    return Object.keys(before).map((key) => ({
      field: formatFieldName(key),
      rawKey: key,
      before: formatValue(before[key]),
      after: null,
      type: 'removed',
    }));
  }

  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const diffs = [];

  for (const key of allKeys) {
    const valBefore = before[key];
    const valAfter = after[key];

    // Normalize comparison
    const strBefore = JSON.stringify(valBefore !== undefined ? valBefore : null);
    const strAfter = JSON.stringify(valAfter !== undefined ? valAfter : null);

    if (strBefore !== strAfter) {
      diffs.push({
        field: formatFieldName(key),
        rawKey: key,
        before: valBefore !== undefined ? formatValue(valBefore) : null,
        after: valAfter !== undefined ? formatValue(valAfter) : null,
        type: valBefore === undefined ? 'added' : valAfter === undefined ? 'removed' : 'modified',
      });
    }
  }

  return diffs;
};

const formatFieldName = (key) => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
};

const formatValue = (val) => {
  if (val === null || val === undefined) return 'None';
  if (typeof val === 'boolean') return val ? 'True' : 'False';
  if (Array.isArray(val)) return val.length ? val.join(', ') : 'Empty list';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

export default {
  buildDiff,
};
