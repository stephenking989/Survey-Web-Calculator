/* shared.js — Survey Web Calculator shared angle utilities
 * Loaded by every calculator page via <script src="shared.js">
 * Exposes: window.SurveyCalc.insertDMSSymbol
 *          window.SurveyCalc.parseAngleDMS
 *          window.SurveyCalc.formatDMS
 */
(function(w) {
  'use strict';
  var SC = w.SurveyCalc = w.SurveyCalc || {};

  // ── insertDMSSymbol(el, btn) ─────────────────────────────────────────────
  // Context-aware DMS symbol inserter.
  // Inserts ° if field has none; ' if ° present but ' absent; " if ' present but " absent.
  // If all three already exist, flashes btn green and returns.
  // After insertion, focus returns to el immediately.
  SC.insertDMSSymbol = function(el, btn) {
    var val  = el.value;
    var DEG  = '\u00b0';   // °
    var hasD = val.indexOf(DEG) !== -1;
    var hasM = val.indexOf("'") !== -1;
    var hasS = val.indexOf('"') !== -1;

    var sym;
    if      (!hasD) sym = DEG;
    else if (!hasM) sym = "'";
    else if (!hasS) sym = '"';
    else {
      // Field is complete — flash green
      if (btn) {
        btn.classList.add('dms-btn-done');
        setTimeout(function() { btn.classList.remove('dms-btn-done'); }, 600);
      }
      el.focus();
      return;
    }

    // Insert symbol at cursor (or end of string)
    var start = (el.selectionStart != null) ? el.selectionStart : val.length;
    var end   = (el.selectionEnd   != null) ? el.selectionEnd   : val.length;
    el.value  = val.slice(0, start) + sym + val.slice(end);

    // Advance cursor past inserted symbol
    var pos = start + sym.length;
    try { el.setSelectionRange(pos, pos); } catch (e) {}

    // Return focus to field
    el.focus();

    // Notify live-update listeners
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  };

  // ── parseAngleDMS(raw, fmt) ──────────────────────────────────────────────
  // Parse an angle string to decimal degrees.
  // fmt: 'dms' (default) or 'dd'
  //
  // DMS formats accepted:
  //   Symbolic full:  45° 34' 23"  or  45°34'23"  (spaces optional, closing " optional)
  //   Symbolic D M:   45° 34'      (partial — useful for live calculation)
  //   Symbolic D:     45°          (partial)
  //   Space-separated: 45 34 23   or  45 34 23.5
  //   Letter-separated: 45d34m23s  (s optional)
  //   Compact DMS:    45.3423      (= 45° 34' 23")
  //   Plain integer:  45           (= 45° 0' 0")
  //
  // Returns decimal degrees (number) or null on invalid input.
  SC.parseAngleDMS = function(raw, fmt) {
    if (!raw || !raw.trim()) return null;
    raw = raw.trim();

    if (fmt === 'dd') {
      var n = parseFloat(raw);
      return isNaN(n) ? null : n;
    }

    var neg = raw.charAt(0) === '-';
    if (neg) raw = raw.slice(1).trim();

    // 1. Symbolic full D M S  (spaces optional, closing " optional)
    var full = raw.match(
      /^(\d+(?:\.\d+)?)\s*\u00b0\s*(\d+(?:\.\d+)?)\s*'\s*(\d+(?:\.\d+)?)\s*"?\s*$/
    );
    if (full) {
      var d = parseFloat(full[1]), m = parseFloat(full[2]), s = parseFloat(full[3]);
      if (m >= 60 || s >= 60) return null;
      return _dd(d, m, s, neg);
    }

    // 2. Symbolic D M  (partial — closing ' optional)
    var dm = raw.match(/^(\d+(?:\.\d+)?)\s*\u00b0\s*(\d+(?:\.\d+)?)\s*'?\s*$/);
    if (dm) {
      var d = parseFloat(dm[1]), m = parseFloat(dm[2]);
      if (m >= 60) return null;
      return _dd(d, m, 0, neg);
    }

    // 3. Symbolic D only
    var dOnly = raw.match(/^(\d+(?:\.\d+)?)\s*\u00b0\s*$/);
    if (dOnly) return _dd(parseFloat(dOnly[1]), 0, 0, neg);

    // 4. Space-separated D M S
    var spc = raw.match(
      /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/
    );
    if (spc) {
      var d = parseFloat(spc[1]), m = parseFloat(spc[2]), s = parseFloat(spc[3]);
      if (m >= 60 || s >= 60) return null;
      return _dd(d, m, s, neg);
    }

    // 5. Letter-separated: 45d34m23s  (trailing s optional)
    var ltr = raw.match(
      /^(\d+(?:\.\d+)?)d\s*(\d+(?:\.\d+)?)m\s*(\d+(?:\.\d+)?)s?\s*$/i
    );
    if (ltr) {
      var d = parseFloat(ltr[1]), m = parseFloat(ltr[2]), s = parseFloat(ltr[3]);
      if (m >= 60 || s >= 60) return null;
      return _dd(d, m, s, neg);
    }

    // 6. Compact DMS: 45.3423  →  45° 34' 23"
    var dot = raw.indexOf('.');
    if (dot !== -1) {
      var di = parseInt(raw.slice(0, dot), 10);
      var fr = (raw.slice(dot + 1) + '0000').slice(0, 4);
      var mi = parseInt(fr.slice(0, 2), 10);
      var si = parseInt(fr.slice(2, 4), 10);
      if (!isNaN(di) && mi >= 0 && mi <= 59 && si >= 0 && si <= 59) {
        return _dd(di, mi, si, neg);
      }
    }

    // 7. Plain number (integer degrees or decimal degrees)
    var n = parseFloat(raw);
    if (!isNaN(n)) return neg ? -n : n;

    return null;
  };

  // ── formatDMS(totalSeconds, precision) ──────────────────────────────────
  // Format an angle given as total arc-seconds to a DMS display string.
  // precision: decimal places on seconds field (default 0).
  // Example: formatDMS(164070, 0)  →  "45° 34' 30""
  SC.formatDMS = function(totalSeconds, precision) {
    var dp  = precision || 0;
    var neg = totalSeconds < 0;
    var abs = Math.abs(totalSeconds);
    var d   = Math.floor(abs / 3600);
    var rem = abs - d * 3600;
    var m   = Math.floor(rem / 60);
    var s   = rem - m * 60;

    var factor = Math.pow(10, dp);
    s = Math.round(s * factor) / factor;
    if (s >= 60) { s = 0; m++; }
    if (m >= 60) { m = 0; d++; }

    function p2(n) { return n < 10 ? '0' + n : '' + n; }
    var sStr;
    if (dp > 0) {
      var r     = s.toFixed(dp).split('.');
      sStr = p2(parseInt(r[0], 10)) + '.' + r[1];
    } else {
      sStr = p2(Math.round(s));
    }

    return (neg ? '-' : '') + d + '\u00b0 ' + p2(m) + '\u2032 ' + sStr + '\u2033';
  };

  // ── internal helper ──────────────────────────────────────────────────────
  function _dd(d, m, s, neg) {
    var v = d + m / 60 + s / 3600;
    return neg ? -v : v;
  }

})(window);
