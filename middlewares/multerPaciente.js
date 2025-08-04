const multer = require('multer');
const path = require('path');

// Directorio de subida
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/pacientes');
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `pac_${Date.now()}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowedTypes.test(ext));
};

module.exports = multer({ storage, fileFilter });
