import { useEffect, useState } from 'react';
import { api } from './api';

export default function Home({ user, openProject }) {
  const staff = user.role !== 'Member';
  const [ws, setWs] = useState([]), [sel, setSel] = useState(null), [projects, setProjects] = useState([]);
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [pf, setPf] = useState({ name: '', description: '', deadline: '' }), [msg, setMsg] = useState('');
  const loadWs = () => api('/workspaces').then(d => { setWs(d); setSel(s => (s && d.find(w => w._id === s)) ? s : d[0]?._id); });
  const loadP = () => sel && api('/projects?workspace=' + sel).then(setProjects);
  useEffect(() => { loadWs(); }, []);
  useEffect(() => { loadP(); }, [sel]);
  const act = async (fn) => { try { setMsg(''); await fn(); } catch (e) { setMsg(e.message); } };
  const cur = ws.find(w => w._id === sel);

  return (
    <div className="grid2">
      <aside className="card">
        <h3>Workspaces</h3>
        {ws.map(w => <div key={w._id} className={'item ' + (w._id === sel ? 'active' : '')} onClick={() => setSel(w._id)}>{w.name}</div>)}
        {!ws.length && <p className="muted">No workspaces yet.</p>}
        {staff && <div className="row"><input placeholder="New workspace" value={name} onChange={e => setName(e.target.value)} />
          <button className="btn" onClick={() => act(async () => { await api('/workspaces', { method: 'POST', body: { name } }); setName(''); loadWs(); })}>Add</button></div>}
      </aside>
      <section>
        {msg && <div className="err">{msg}</div>}
        {cur ? <>
          <div className="card">
            <h3>{cur.name} — Team ({cur.members.length})</h3>
            <div>{cur.members.map(m => <span key={m._id} className="pill big">{m.name} · {m.role}</span>)}</div>
            {staff && <div className="row"><input placeholder="Add member by registered email" value={email} onChange={e => setEmail(e.target.value)} />
              <button className="btn" onClick={() => act(async () => { await api(`/workspaces/${cur._id}/members`, { method: 'POST', body: { email } }); setEmail(''); loadWs(); })}>Add member</button></div>}
          </div>
          <div className="card">
            <h3>Projects</h3>
            <div className="cards">{projects.map(p => (
              <div key={p._id} className="proj" onClick={() => openProject(p._id)}>
                <b>{p.name}</b><p className="muted">{p.description}</p>
                <small>{p.deadline ? 'Deadline: ' + p.deadline.slice(0, 10) : 'No deadline'}</small>
              </div>))}
              {!projects.length && <p className="muted">No projects in this workspace.</p>}</div>
            {staff && <div className="row wrap">
              <input placeholder="Project name" value={pf.name} onChange={e => setPf({ ...pf, name: e.target.value })} />
              <input placeholder="Description" value={pf.description} onChange={e => setPf({ ...pf, description: e.target.value })} />
              <input type="date" value={pf.deadline} onChange={e => setPf({ ...pf, deadline: e.target.value })} />
              <button className="btn" onClick={() => act(async () => { await api('/projects', { method: 'POST', body: { ...pf, workspace: cur._id } }); setPf({ name: '', description: '', deadline: '' }); loadP(); })}>Create project</button>
            </div>}
          </div>
        </> : <div className="card"><p>{staff ? 'Create a workspace to get started.' : 'Ask a manager to add you to a workspace.'}</p></div>}
      </section>
    </div>
  );
}
