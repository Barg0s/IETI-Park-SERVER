const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // En sprint 1, si Proxmox/Mongoose fa fallar la connexio, no volem que el joc caigui
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ietipark';
        await mongoose.connect(uri);
        console.log('[DB] MongoDB database connected successfully');
    } catch (error) {
        console.warn('[DB] Warning: MongoDB connection failed. Continuing in-memory mode for Sprint 1.');
        console.warn(`[DB] Error details: ${error.message}`);
    }
};

module.exports = connectDB;
