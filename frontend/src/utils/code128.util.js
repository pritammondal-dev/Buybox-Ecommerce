/**
 * Code 128 (Subset B) Barcode Utility
 * ISO/IEC 15417 Standards-Compliant Implementation
 *
 * Supports printable ASCII 32 to 126 characters.
 * Computes modulo 103 checksum and generates vector bar/space widths
 * suitable for SVG rendering, thermal printing, and 1D optical barcode scanners.
 */

const CODE128_PATTERNS = Object.freeze([
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112", // 100-106 (106 is Stop)
]);

const START_CODE_B = 104;
const STOP_CODE = 106;

/**
 * Encodes an ASCII string into Code 128 (Subset B) modules.
 * Returns bars array: [{ isBar: boolean, width: number, x: number }]
 */
function encodeCode128(text, options = {}) {
  const cleanText = String(text || "").trim();
  if (!cleanText) {
    throw new Error("Text is required for Code 128 encoding");
  }

  const {
    moduleWidth = 2,
    quietZoneModules = 10,
    barHeight = 48,
  } = options;

  const codes = [START_CODE_B];
  let checksumTotal = START_CODE_B;

  for (let i = 0; i < cleanText.length; i++) {
    const charCode = cleanText.charCodeAt(i);
    if (charCode < 32 || charCode > 126) {
      throw new Error(`Unsupported ASCII character in Code 128: '${cleanText[i]}' (code ${charCode})`);
    }
    const val = charCode - 32;
    codes.push(val);
    checksumTotal += val * (i + 1);
  }

  const checksum = checksumTotal % 103;
  codes.push(checksum);
  codes.push(STOP_CODE);

  // Convert codes into widths
  const widths = [];
  for (const c of codes) {
    const pattern = CODE128_PATTERNS[c];
    for (const ch of pattern) {
      widths.push(Number(ch));
    }
  }

  // Calculate layout coordinates
  let currentX = quietZoneModules * moduleWidth;
  const bars = [];

  for (let i = 0; i < widths.length; i++) {
    const w = widths[i] * moduleWidth;
    const isBar = i % 2 === 0; // Even indices are bars, odd are spaces
    if (isBar) {
      bars.push({
        x: currentX,
        width: w,
        height: barHeight,
      });
    }
    currentX += w;
  }

  const totalWidth = currentX + quietZoneModules * moduleWidth;

  return {
    text: cleanText,
    codes,
    checksum,
    widths,
    bars,
    totalWidth,
    totalHeight: barHeight,
    moduleWidth,
    quietZoneModules,
  };
}

/**
 * Independent Code 128 Decoder for test verification
 */
function decodeCode128Widths(widths) {
  const patternToCode = new Map();
  CODE128_PATTERNS.forEach((p, idx) => patternToCode.set(p, idx));

  let pos = 0;
  const decodedCodes = [];
  while (pos < widths.length) {
    const remaining = widths.length - pos;
    const len = remaining === 7 ? 7 : 6;
    const pat = widths.slice(pos, pos + len).join("");
    if (!patternToCode.has(pat)) {
      throw new Error(`Unknown pattern '${pat}' at position ${pos}`);
    }
    decodedCodes.push(patternToCode.get(pat));
    pos += len;
  }

  const start = decodedCodes[0];
  const stop = decodedCodes[decodedCodes.length - 1];
  const checksum = decodedCodes[decodedCodes.length - 2];
  const dataCodes = decodedCodes.slice(1, -2);

  if (start !== START_CODE_B) {
    throw new Error(`Invalid start code: ${start}`);
  }
  if (stop !== STOP_CODE) {
    throw new Error(`Invalid stop code: ${stop}`);
  }

  let calcChecksum = start;
  let text = "";
  dataCodes.forEach((code, idx) => {
    calcChecksum += code * (idx + 1);
    text += String.fromCharCode(code + 32);
  });

  if (calcChecksum % 103 !== checksum) {
    throw new Error(`Checksum mismatch: expected ${checksum}, got ${calcChecksum % 103}`);
  }

  return {
    text,
    checksumValid: true,
    dataCodes,
    checksum,
  };
}

module.exports = {
  CODE128_PATTERNS,
  START_CODE_B,
  STOP_CODE,
  encodeCode128,
  decodeCode128Widths,
};

