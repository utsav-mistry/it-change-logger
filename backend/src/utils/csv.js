/**
 * Zero-dependency CSV builder.
 * Replaces the deprecated json2csv package.
 */

/**
 * Escape a single field value for CSV.
 * Wraps in double-quotes and escapes internal double-quotes.
 */
function escapeField(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // If the value contains a comma, newline, or double-quote, wrap in quotes
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Convert an array of plain objects to a CSV string.
 * Column order follows the keys of the first row.
 * @param {Object[]} rows
 * @returns {string}
 */
function objectsToCSV(rows) {
    if (!rows || rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const lines = [
        headers.map(escapeField).join(','),
        ...rows.map(row => headers.map(h => escapeField(row[h])).join(',')),
    ];
    return lines.join('\r\n');
}

module.exports = { objectsToCSV };
