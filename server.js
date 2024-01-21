const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;


app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});


const clients = {};

io.on('connection', (socket) => {

    // console.log("User Connected to the server");
    socket.on('join', (data) => {
        const { roomId, username } = data;
        socket.join(roomId);
        clients[socket.id] = { username, roomId };

        io.to(roomId).emit('chat message', `${username} has joined the chat`);
    });

    socket.on('chat message', (msg) => {
        const { username, roomId } = clients[socket.id];
        io.to(roomId).emit('chat message', `${username}: ${msg}`);
    });

    
    socket.on('disconnect', () => {
        const { username, roomId } = clients[socket.id];
        io.to(roomId).emit('chat message', `${username} has left the chat`);
        
        delete clients[socket.id];
    });
});


server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
