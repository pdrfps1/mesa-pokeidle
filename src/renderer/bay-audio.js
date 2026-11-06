var MesaBayAudio = (function () {
  function calls(bays, index) {
    if (!Array.isArray(bays) || !Number.isInteger(index) || index < 0 || index >= bays.length) return [];
    const bay = bays[index];
    if (!bay || typeof bay !== 'object') return [];
    return [{ index: index, muted: bay.muted === true }];
  }
  return { calls: calls };
}());
if (typeof module !== 'undefined' && module.exports) module.exports = MesaBayAudio;
