const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static files (including the HTML file)
app.use(express.static(path.join(__dirname)));

// Rooms storage
const rooms = {};

app.post('/create-room', (req, res) => {
    const roomId = generateRoomId();
    rooms[roomId] = { clients: [], drawingUser: null, wordToDraw: null, guessedWords: [] };
    res.json({ roomId });
});
app.post('/generate-word', (req, res) => {
    const { roomId, username } = req.query;
    const room = rooms[roomId];

    // Check if the user is in the room and is the drawing user
    if (room && room.clients.length > 0 && room.clients[0].username === username) {
        room.wordToDraw = generateRandomWord();
        io.to(roomId).emit('generated-word', { wordToDraw: room.wordToDraw });
        res.json({ success: true, wordToDraw: room.wordToDraw });
    } else {
        res.json({ success: false, message: 'You do not have permission to generate a word.' });
    }
});

app.post('/join-room', (req, res) => {
    const { roomId, username } = req.body;

    // Check if the user has already joined a room
    if (getClientDataByUsername(username)) {
        res.json({ success: false, message: 'You have already joined a room.' });
        return;
    }

    if (rooms[roomId]) {
        rooms[roomId].clients.push({ username, socketId: null });
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Room not found' });
    }
});

app.post('/start-drawing', (req, res) => {
    const { roomId, username } = req.body;
    const room = rooms[roomId];

    // Check if the user is the owner of the room
    if (room && room.clients.length > 0 && room.clients[0].username === username) {
        room.drawingUser = username;
        room.wordToDraw = generateRandomWord();
        io.to(roomId).emit('chat message', `${username} has started drawing. Word to draw: ${room.wordToDraw}`);
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'You do not have permission to start drawing.' });
    }
});

app.post('/generate-word', (req, res) => {
    const { roomId, username } = req.body;
    const room = rooms[roomId];

    // Check if the user is in the room and is the drawing user
    if (room && room.clients.length > 0 && room.clients[0].username === username) {
        room.wordToDraw = generateRandomWord();
        io.to(roomId).emit('generated-word', { wordToDraw: room.wordToDraw });
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'You do not have permission to generate a word.' });
    }
});

io.on('connection', (socket) => {
    socket.on('join', (data) => {
        const { roomId, username } = data;
        const clientData = getClientDataByUsername(username);

        // Check if the user has already joined a room
        if (clientData && clientData.socketId !== null) {
            socket.emit('chat message', 'You have already joined a room.');
            return;
        }

        // If the user hasn't joined the room yet, proceed
        socket.join(roomId);
        const room = rooms[roomId];

        // Update the socketId for the corresponding username
        if (clientData) {
            clientData.socketId = socket.id;
        }

        io.to(roomId).emit('chat message', `${username} has joined the chat`);

        // Broadcast drawing events only to users in the same room
        socket.on('draw', (drawingData) => {
            io.to(roomId).emit('draw', drawingData);
        });

        socket.on('guess', (guessData) => {
            const { username, roomId } = getClientData(socket.id);
            const room = rooms[roomId];

            if (room.drawingUser && room.drawingUser !== username) {
                const isCorrectGuess = guessData.guess.toLowerCase() === room.wordToDraw.toLowerCase();
                const message = isCorrectGuess
                    ? `${username} guessed it correctly! The word was: ${room.wordToDraw}`
                    : `${username} made a wrong guess: ${guessData.guess}`;
                io.to(roomId).emit('chat message', message);

                // Store the guessed words for later display
                room.guessedWords.push({
                    username,
                    guess: guessData.guess,
                    isCorrect: isCorrectGuess,
                });
            }
        });

        socket.on('disconnect', () => {
            const { username, roomId } = getClientData(socket.id);
            io.to(roomId).emit('chat message', `${username} has left the chat`);
            removeClient(socket.id, roomId);

            // Check if the user leaving was the drawing user
            if (room.drawingUser === username) {
                io.to(roomId).emit('chat message', `${username} was drawing. The game has ended.`);
                room.drawingUser = null;
                room.wordToDraw = null;
                room.guessedWords = [];
            }
        });
    });
});

function getClientData(socketId) {
    for (const roomId in rooms) {
        const clients = rooms[roomId].clients;
        const client = clients.find((client) => client.socketId === socketId);
        if (client) {
            const { username } = client;
            return { username, roomId };
        }
    }
}

function getClientDataByUsername(username) {
    for (const roomId in rooms) {
        const clients = rooms[roomId].clients;
        const clientData = clients.find((client) => client.username === username);
        if (clientData) {
            return { roomId, ...clientData };
        }
    }
}

function removeClient(socketId, roomId) {
    const clients = rooms[roomId].clients;
    const index = clients.findIndex((client) => client.socketId === socketId);
    if (index !== -1) {
        clients.splice(index, 1);
    }
}

function generateRoomId() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}



server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
