const http = require('http');
const app = require('./src/app');
const { initSocket } = require('./src/socket');
const connectDB = require('./src/config/db');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

// Connect to MongoDB (non-blocking)
connectDB();

// Create the HTTP server using Express app
const server = http.createServer(app);

// Initialize pure WebSockets on the HTTP server
initSocket(server);

server.listen(PORT, () => {
    console.log(`[SERVER] IETI Park game server running on port ${PORT}`);
});
