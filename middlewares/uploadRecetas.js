// middlewares/uploadRecetas.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const dest = path.join(__dirname, '..', 'public', 'uploads', 'recetas');
if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dest),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  const ok = /jpeg|jpg|png|gif/i.test(file.mimetype) &&
             /jpeg|jpg|png|gif/i.test(path.extname(file.originalname));
  ok ? cb(null, true) : cb(new Error('Solo se permiten imágenes'));
};

module.exports = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter
});
