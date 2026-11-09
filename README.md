# Nexus PM - Team Collaboration & Project Management Platform
MERN app: React (Vite) + Express + MongoDB.

## Run locally
1. Put your MongoDB Atlas connection string in `server/.env` (MONGO_URI).
2. `npm run install-all`
3. `npm run seed`   (demo data)
4. `npm run dev`    -> open http://localhost:5173

Demo logins (password `123456`): admin@demo.com, manager@demo.com, member@demo.com

## Roles
- Admin: everything, sees all workspaces/projects
- Manager: create workspaces/projects/tasks, add members, assign tasks
- Member: view projects they belong to, move/update status of tasks assigned to them, comment, upload files

## Deploy (Render, single service)
Build command: `npm run install-all && npm run build`  | Start command: `npm start`
Env vars: MONGO_URI, JWT_SECRET. (Uploaded files use local disk, which resets on Render free tier.)
