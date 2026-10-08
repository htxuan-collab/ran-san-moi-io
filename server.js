const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const MAP_SIZE = 1500;

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

function respawnPlayer(p) {
    p.x = (Math.random() - 0.5) * (MAP_SIZE * 1.2);
    p.y = (Math.random() - 0.5) * (MAP_SIZE * 1.2);
    p.angle = Math.random() * Math.PI * 2;
    p.body = [];
    p.score = Math.max(10, Math.floor(p.score * 0.7)); // Giữ lại 70% điểm khi hồi sinh
}

io.on('connection', (socket) => {
    socket.on('join', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name || 'Rắn Săn Mồi',
            x: (Math.random() - 0.5) * (MAP_SIZE * 1.2),
            y: (Math.random() - 0.5) * (MAP_SIZE * 1.2),
            angle: Math.random() * Math.PI * 2,
            speed: 4,
            score: 10,
            lives: 3, // Khởi tạo 3 mạng
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
    const hitPlayers = new Set();

    // 1. Cập nhật vị trí rắn
    Object.keys(players).forEach(id => {
        const p = players[id];
        if (!p) return;

        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;

        // Cập nhật thân
        p.body.unshift({ x: p.x, y: p.y });
        if (p.body.length > p.score * 2) {
            p.body.pop();
        }

        // KIỂM TRA VA CHẠM VÁCH
        if (Math.abs(p.x) >= MAP_SIZE || Math.abs(p.y) >= MAP_SIZE) {
            hitPlayers.add(id);
        }
    });

    // 2. KIỂM TRA VA CHẠM ĐẦU RẮN ĐÂM VÀO THÂN
    Object.keys(players).forEach(idA => {
        const pA = players[idA];
        if (!pA || hitPlayers.has(idA)) return;

        Object.keys(players).forEach(idB => {
            const pB = players[idB];
            if (!pB) return;

            // Bỏ qua 12 đốt đầu tiên của chính mình để không tự cắn cổ
            const startIndex = (idA === idB) ? 12 : 0;

            for (let i = startIndex; i < pB.body.length; i++) {
                const seg = pB.body[i];
                const dist = Math.hypot(pA.x - seg.x, pA.y - seg.y);
                if (dist < 20) { // Khoảng cách va chạm cực nhạy
                    hitPlayers.add(idA);
                    break;
                }
            }
        });
    });

    // 3. XỬ LÝ MẠNG & HỒI SINH/GAME OVER
    hitPlayers.forEach(id => {
        const p = players[id];
        if (!p) return;

        // Rơi hạt thức ăn tại vị trí chết
        p.body.forEach((seg, idx) => {
            if (idx % 2 === 0) {
                foods.push({
                    id: Math.random().toString(36).substr(2, 9),
                    x: seg.x + (Math.random() - 0.5) * 15,
                    y: seg.y + (Math.random() - 0.5) * 15,
                    radius: 7,
                    color: p.color
                });
            }
        });

        p.lives -= 1; // Trừ 1 mạng

        if (p.lives > 0) {
            // Còn mạng -> Hồi sinh tại chỗ mới
            respawnPlayer(p);
        } else {
            // Hết mạng -> Chết hẳn
            delete players[id];
        }
    });

    // 4. Ăn thức ăn
    Object.keys(players).forEach(id => {
        const p = players[id];
        if (!p || hitPlayers.has(id)) return;

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