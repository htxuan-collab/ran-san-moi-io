const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const MAP_SIZE = 2000; // Kích thước bản đồ từ -2000 đến 2000

let players = {};
let foods = [];

function createFood() {
    return {
        id: Math.random().toString(36).substr(2, 9),
        x: (Math.random() - 0.5) * (MAP_SIZE * 2 - 100),
        y: (Math.random() - 0.5) * (MAP_SIZE * 2 - 100),
        radius: Math.floor(Math.random() * 4) + 5,
        color: `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`
    };
}

for (let i = 0; i < 150; i++) {
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
            speed: 3,
            score: 10,
            color: `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`,
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

// Game Loop (60 FPS)
setInterval(() => {
    Object.keys(players).forEach(id => {
        const p = players[id];
        if (!p) return;

        // Cập nhật vị trí đầu rắn
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;

        // CHECK VA CHẠM VÁCH BẢN ĐỒ
        if (Math.abs(p.x) >= MAP_SIZE || Math.abs(p.y) >= MAP_SIZE) {
            delete players[id];
            return;
        }

        // Cập nhật thân rắn
        p.body.unshift({ x: p.x, y: p.y });
        if (p.body.length > p.score) {
            p.body.pop();
        }

        // Va chạm thức ăn
        foods.forEach((f, idx) => {
            const dist = Math.hypot(p.x - f.x, p.y - f.y);
            if (dist < 12 + f.radius) {
                p.score += 2;
                foods[idx] = createFood();
            }
        });
    });

    io.emit('state', { players, foods, mapSize: MAP_SIZE });
}, 1000 / 60);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});