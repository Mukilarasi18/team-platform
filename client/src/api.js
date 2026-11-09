export const api = async (url, opt = {}) => {
  const t = localStorage.getItem('token'), form = opt.body instanceof FormData;
  const res = await fetch('/api' + url, {
    ...opt,
    headers: { ...(form ? {} : { 'Content-Type': 'application/json' }), ...(t && { Authorization: 'Bearer ' + t }) },
    body: opt.body && !form ? JSON.stringify(opt.body) : opt.body
  });
  if (opt.raw && res.ok) return res.blob();
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'Something went wrong');
  return d;
};
