const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const MAP_SIZE = 2000;

let players = {};
let foods = [];

function createFood() {
    return {
        id: Math.random().toString(36).substr(2, 9),
        x: (Math.random() - 0.5) * (MAP_SIZE * 2 - 200),
        y: (Math.random() - 0.5) * (MAP_SIZE * 2 - 200),
        radius: Math.floor(Math.random() * 4) + 6,
        color: `hsl(${Math.floor(Math.random() * 360)}, 85%, 65%)`
    };
}

for (let i = 0; i < 200; i++) {
    foods.push(createFood());
}

io.on('connection', (socket) => {
    socket.on('join', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name || 'Rắn Săn Mồi',
            x: (Math.random() - 0.5) * 1000,
            y: (Math.random() - 0.5) * 1000,
            angle: 0,
            speed: 4,
            score: 10,
            color: data.color || '#6366f1',
            body: []
        };
        socket.emit('init', { id: socket.id, mapSize: MAP_SIZE });
    });

    socket.on('turn', (angle) => {
        if (players[socket.id]) {
            players[socket.id].angle = angle;
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

// Loop cập nhật Server (60 Tick Rate)
setInterval(() => {
    Object.keys(players).forEach(id => {
        const p = players[id];
        if (!p) return;

        // Di chuyển
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;

        // Va chạm vách
        if (Math.abs(p.x) >= MAP_SIZE || Math.abs(p.y) >= MAP_SIZE) {
            delete players[id];
            return;
        }

        // Tạo mảng thân rắn
        p.body.unshift({ x: p.x, y: p.y });
        if (p.body.length > p.score * 2) {
            p.body.pop();
        }

        // Ăn thức ăn
        foods.forEach((f, idx) => {
            const dist = Math.hypot(p.x - f.x, p.y - f.y);
            if (dist < 14 + f.radius) {
                p.score += 1;
                foods[idx] = createFood();
            }
        });
    });

    io.emit('state', { players, foods, mapSize: MAP_SIZE });
}, 1000 / 60);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});