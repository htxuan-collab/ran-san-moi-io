const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const MAP_SIZE = 1500; // Bán kính bản đồ (-1500 đến 1500)

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

for (let i = 0; i < 250; i++) {
    foods.push(createFood());
}

io.on('connection', (socket) => {
    socket.on('join', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name || 'Rắn Săn Mồi',
            x: (Math.random() - 0.5) * (MAP_SIZE * 1.5),
            y: (Math.random() - 0.5) * (MAP_SIZE * 1.5),
            angle: Math.random() * Math.PI * 2,
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

// Game Loop 60 FPS
setInterval(() => {
    const deadPlayers = new Set();

    // 1. Cập nhật vị trí
    Object.keys(players).forEach(id => {
        const p = players[id];
        if (!p) return;

        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;

        // Cập nhật mảng thân
        p.body.unshift({ x: p.x, y: p.y });
        if (p.body.length > p.score * 2) {
            p.body.pop();
        }

        // VA CHẠM VÁCH BẢN ĐỒ
        if (Math.abs(p.x) >= MAP_SIZE || Math.abs(p.y) >= MAP_SIZE) {
            deadPlayers.add(id);
        }
    });

    // 2. VA CHẠM ĐẦU RẮN VỚI THÂN RẮN KHÁC (HOẶC THÂN CHÍNH MÌNH)
    Object.keys(players).forEach(idA => {
        const pA = players[idA];
        if (!pA || deadPlayers.has(idA)) return;

        Object.keys(players).forEach(idB => {
            const pB = players[idB];
            if (!pB) return;

            // Bỏ qua kiểm tra va chạm vài đốt đầu của chính mình
            const startCheckIdx = (idA === idB) ? 15 : 0;

            for (let i = startCheckIdx; i < pB.body.length; i += 2) {
                const seg = pB.body[i];
                const dist = Math.hypot(pA.x - seg.x, pA.y - seg.y);
                if (dist < 18) { // Khoảng cách chạm
                    deadPlayers.add(idA);
                    break;
                }
            }
        });
    });

    // 3. Xử lý rắn chết -> Biến thành thức ăn
    deadPlayers.forEach(id => {
        const p = players[id];
        if (p) {
            p.body.forEach((seg, idx) => {
                if (idx % 3 === 0) {
                    foods.push({
                        id: Math.random().toString(36).substr(2, 9),
                        x: seg.x + (Math.random() - 0.5) * 10,
                        y: seg.y + (Math.random() - 0.5) * 10,
                        radius: 8,
                        color: p.color
                    });
                }
            });
            delete players[id];
        }
    });

    // 4. Va chạm Ăn thức ăn
    Object.keys(players).forEach(id => {
        const p = players[id];
        if (!p || deadPlayers.has(id)) return;

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