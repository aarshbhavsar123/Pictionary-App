const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Dictionary to store connected clients and their usernames
const clients = {};

io.on('connection', (socket) => {

    // Handle the event when a new user joins
    socket.on('join', (data) => {
        const { roomId, username } = data;
        socket.join(roomId);
        clients[socket.id] = { username, roomId };

        // Notify all clients in the room about the new user
        io.to(roomId).emit('chat message', `${username} has joined the chat`);
    });

    // Handle the event when a user sends a message
    socket.on('chat message', (msg) => {
        const { username, roomId } = clients[socket.id];
        io.to(roomId).emit('chat message', `${username}: ${msg}`);
    });

    // Handle the event when a user disconnects
    socket.on('disconnect', () => {
        const { username, roomId } = clients[socket.id];
        io.to(roomId).emit('chat message', `${username} has left the chat`);
        
        delete clients[socket.id];
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
