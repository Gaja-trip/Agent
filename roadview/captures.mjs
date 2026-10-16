const day = (value) => /^\d{4}-\d{2}-\d{2}/.exec(String(value ?? ''))?.[0] ?? '';
export function captureList(data) {
  const pasts = typeof data?.getPastList === 'function' ? data.getPastList() : data?.pasts;
  const candidates = [{ panoId: data?.panoId, date: data?.date }, ...(Array.isArray(pasts) ? pasts : [])];
  const dates = new Set();
  return candidates.filter((item) => Number.isSafeInteger(Number(item.panoId)) && Number(item.panoId) > 0 && day(item.date))
    .map((item) => ({ panoId: Number(item.panoId), date: day(item.date) }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((item) => { if (dates.has(item.date)) return false; dates.add(item.date); return true; });
}
export function chooseCaptures(options, preferred = [], count = 4) {
  const used = new Set();
  const slots = Math.min(count, options.length);
  return Array.from({ length: count }, (_, index) => {
    if (index >= slots) return null;
    const available = options.filter((item) => !used.has(item.panoId));
    let selected;
    if (day(preferred[index])) {
      const target = Date.parse(preferred[index]);
      selected = available.reduce((best, item) => Math.abs(Date.parse(item.date) - target) < Math.abs(Date.parse(best.date) - target) ? item : best);
    } else {
      const targetIndex = slots === 1 ? 0 : Math.round(index * (options.length - 1) / (slots - 1));
      selected = available.find((item) => item === options[targetIndex]) ?? available[0];
    }
    used.add(selected.panoId);
    return selected;
  });
}
export const captureLabel = (date) => day(date) ? date.slice(0, 10).replaceAll('-', '.') : '촬영일 정보 없음';
export function readCaptureDates(search) {
  const dates = new URLSearchParams(search).get('dates')?.split(',') ?? [];
  return Array.from({ length: 4 }, (_, i) => day(dates[i]));
}
