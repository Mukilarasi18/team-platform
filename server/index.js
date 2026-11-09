require('dotenv').config();
const express = require('express'), mongoose = require('mongoose'), cors = require('cors');
const path = require('path'), fs = require('fs');
const app = express();
app.use(cors(), express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api', require('./routes'));
// In production, serve the built React app from the same server
const dist = path.join(__dirname, '../client/dist');
app.use(express.static(dist));
app.get('*', (req, res, next) => fs.existsSync(dist) ? res.sendFile(path.join(dist, 'index.html')) : next());
mongoose.connect(process.env.MONGO_URI)
  .then(() => app.listen(process.env.PORT || 5000, () => console.log('Server running, MongoDB connected')))
  .catch(e => console.error('MongoDB connection failed:', e.message));
