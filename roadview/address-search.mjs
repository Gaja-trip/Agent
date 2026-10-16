import { normalizeQuery, searchAddresses } from './geocoding.mjs';

export function mountAddressSearch({ isReady, onSelect }) {
  const $ = (selector) => document.querySelector(selector);
  const form = $('#address-form');
  const input = $('#address-query');
  const submit = $('#address-submit');
  const results = $('#address-results');
  const status = $('#address-status');
  const error = $('#address-error');
  let request;
  let version = 0;
  let navigating = false;
  const setError = (message = '') => {
    error.textContent = message; error.hidden = !message;
    input.setAttribute('aria-invalid', String(Boolean(message)));
  };
  function refresh() {
    results.querySelectorAll('button').forEach((button) => { button.disabled = navigating || !isReady(); });
  }
  function busy(value) {
    form.setAttribute('aria-busy', String(value));
    submit.disabled = value;
    submit.textContent = value ? '검색 중…' : '검색';
  }
  function clearResults() {
    results.replaceChildren(); results.hidden = true;
    $('#address-result-heading').hidden = true;
  }
  input.addEventListener('input', () => {
    version++; request?.abort(); busy(false); setError(); clearResults(); status.textContent = '';
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const current = ++version;
    request?.abort(); request = new AbortController();
    setError(); clearResults(); status.textContent = '';
    try {
      const query = normalizeQuery(input.value);
      busy(true);
      const response = await searchAddresses(query, { signal: request.signal });
      if (current !== version) return;
      if (!response.results.length) {
        status.textContent = '검색 결과가 없습니다. 시·군·구와 도로명·건물번호 또는 동·지번을 확인해 주세요.';
        return;
      }
      const heading = $('#address-result-heading');
      heading.textContent = response.total > response.results.length ? `검색 결과 ${response.results.length}개 · 주소를 더 자세히 입력해 주세요` : `검색 결과 ${response.results.length}개`;
      heading.hidden = false; results.hidden = false;
      for (const item of response.results) {
        const li = document.createElement('li');
        const button = document.createElement('button'); button.type = 'button'; button.className = 'address-result';
        button.setAttribute('aria-label', `${item.address} 주변 로드뷰 보기`);
        const title = document.createElement('strong'); title.textContent = item.address;
        const detail = document.createElement('span'); detail.className = 'address-detail'; detail.textContent = [item.building, item.alternate].filter(Boolean).join(' · ');
        const coordinates = document.createElement('span'); coordinates.className = 'address-coordinates'; coordinates.textContent = `${item.lat.toFixed(6)}, ${item.lng.toFixed(6)}`;
        const action = document.createElement('span'); action.className = 'address-result-action'; action.textContent = '이 위치로 이동 ↗';
        button.append(title, detail, coordinates, action); li.append(button); results.append(li);
        button.addEventListener('click', async () => {
          if (!isReady() || navigating || current !== version) return;
          navigating = true; refresh(); setError();
          status.textContent = `${item.address} 주변 로드뷰를 찾고 있습니다.`;
          try {
            const outcome = await onSelect(item);
            if (current !== version) return;
            if (!outcome?.ok) { setError(outcome?.error || '로드뷰로 이동하지 못했습니다. 다시 시도해 주세요.'); status.textContent = ''; return; }
            results.querySelectorAll('button').forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
            status.textContent = `${item.address} · 주소에서 최대 500m 이내의 로드뷰를 표시합니다.`;
          } catch {
            if (current === version) { setError('로드뷰로 이동하지 못했습니다. 다시 시도해 주세요.'); status.textContent = ''; }
          } finally { navigating = false; refresh(); }
        });
      }
      status.textContent = isReady() ? '주소를 선택하면 해당 위치 주변의 로드뷰로 이동합니다.' : '로드뷰 연결이 완료되면 검색 결과를 선택할 수 있습니다.';
      refresh();
    } catch (err) {
      if (current === version && err.name !== 'AbortError') setError(err.message);
    } finally { if (current === version) busy(false); }
  });
  return { refresh };
}
