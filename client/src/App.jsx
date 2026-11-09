import { useEffect, useState } from 'react';
import { api } from './api';
import Home from './Home';
import Project from './Project';

function Auth({ onAuth }) {
  const [mode, setMode] = useState('login'), [f, setF] = useState({ name: '', email: '', password: '', role: 'Member' }), [err, setErr] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => {
    e.preventDefault();
    try { const d = await api('/auth/' + mode, { method: 'POST', body: f }); localStorage.setItem('token', d.token); onAuth(d.user); }
    catch (x) { setErr(x.message); }
  };
  return (
    <div className="auth"><form className="card" onSubmit={submit}>
      <h2>Nexus PM</h2><p className="muted">{mode === 'login' ? 'Log in to your workspace' : 'Create your account'}</p>
      {mode === 'register' && <input placeholder="Full name" value={f.name} onChange={set('name')} required />}
      <input type="email" placeholder="Email" value={f.email} onChange={set('email')} required />
      <input type="password" placeholder="Password (min 6)" value={f.password} onChange={set('password')} required />
      {mode === 'register' && <select value={f.role} onChange={set('role')}><option>Member</option><option>Manager</option><option>Admin</option></select>}
      {err && <div className="err">{err}</div>}
      <button className="btn">{mode === 'login' ? 'Log in' : 'Register'}</button>
      <a className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>
        {mode === 'login' ? 'No account? Register' : 'Have an account? Log in'}</a>
    </form></div>
  );
}

function Bell() {
  const [list, setList] = useState([]), [show, setShow] = useState(false);
  const load = () => api('/notifications').then(setList).catch(() => {});
  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, []);
  const unread = list.filter(n => !n.read).length;
  const toggle = async () => { setShow(!show); if (!show && unread) { await api('/notifications/read', { method: 'POST' }); setTimeout(load, 1500); } };
  return (
    <div className="bell"><button className="btn ghost" onClick={toggle}>🔔 {unread > 0 && <span className="badge">{unread}</span>}</button>
      {show && <div className="dropdown card">{list.length ? list.map(n => <div key={n._id} className={'note ' + (n.read ? '' : 'new')}>{n.message}<small>{new Date(n.createdAt).toLocaleString()}</small></div>) : <p className="muted">No notifications</p>}</div>}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null), [ready, setReady] = useState(false), [pid, setPid] = useState(null);
  useEffect(() => { api('/auth/me').then(setUser).catch(() => localStorage.removeItem('token')).finally(() => setReady(true)); }, []);
  if (!ready) return null;
  if (!user) return <Auth onAuth={setUser} />;
  return (
    <>
      <header>
        <b className="logo" onClick={() => setPid(null)}>◆ Nexus PM</b>
        <div className="right"><Bell /><span>{user.name} <span className="pill">{user.role}</span></span>
          <button className="btn ghost" onClick={() => { localStorage.removeItem('token'); setUser(null); setPid(null); }}>Logout</button></div>
      </header>
      <main>{pid ? <Project id={pid} user={user} back={() => setPid(null)} /> : <Home user={user} openProject={setPid} />}</main>
    </>
  );
}
