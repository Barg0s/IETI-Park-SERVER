const http = require('http');
const app = require('./src/app');
const { initSocket } = require('./src/socket');
const connectDB = require('./src/config/db');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

// Override console methods to add timestamps
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

function getTimestamp() {
    return '[' + new Date().toISOString().replace('T', ' ').substring(0, 19) + ']';
}

console.log = function() {
    Array.prototype.unshift.call(arguments, getTimestamp());
    originalLog.apply(console, arguments);
};
console.warn = function() {
    Array.prototype.unshift.call(arguments, getTimestamp());
    originalWarn.apply(console, arguments);
};
console.error = function() {
    Array.prototype.unshift.call(arguments, getTimestamp());
    originalError.apply(console, arguments);
};

// Connect to MongoDB (non-blocking)
connectDB();

// Create the HTTP server using Express app
const server = http.createServer(app);

// Initialize pure WebSockets on the HTTP server
initSocket(server);

server.listen(PORT, () => {
    console.log(`[SERVER] IETI Park game server running on port ${PORT}`);
});
