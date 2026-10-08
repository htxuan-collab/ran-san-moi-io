const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
    pingInterval: 10000,
    pingTimeout: 5000
});

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const MAP_SIZE = 1600;

let rooms = {
    'casual': { name: 'Phòng Thường', players: {}, foods: [] },
    'ranked': { name: 'Phòng Đua Top', players: {}, foods: [] },
    'pro': { name: 'Phòng Cao Thủ', players: {}, foods: [] }
};

const FRUIT_TYPES = [
    { type: 'orb', icon: '🔮', points: 1, radius: 7 },
    { type: 'apple', icon: '🍎', points: 2, radius: 10 },
    { type: 'strawberry', icon: '🍓', points: 3, radius: 11 },
    { type: 'banana', icon: '🍌', points: 3, radius: 12 },
    { type: 'grape', icon: '🍇', points: 4, radius: 12 },
    { type: 'orange', icon: '🍊', points: 2, radius: 10 }
];

function createFood() {
    const fruit = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
    return {
        id: Math.random().toString(36).substr(2, 6),
        x: Math.floor((Math.random() - 0.5) * (MAP_SIZE * 2 - 200)),
        y: Math.floor((Math.random() - 0.5) * (MAP_SIZE * 2 - 200)),
        type: fruit.type,
        icon: fruit.icon,
        points: fruit.points,
        radius: fruit.radius,
        color: `hsl(${Math.floor(Math.random() * 360)}, 85%, 65%)`
    };
}

Object.keys(rooms).forEach(rKey => {
    for (let i = 0; i < 220; i++) {
        rooms[rKey].foods.push(createFood());
    }
});

function respawnPlayer(p) {
    p.x = Math.floor((Math.random() - 0.5) * (MAP_SIZE * 1.2));
    p.y = Math.floor((Math.random() - 0.5) * (MAP_SIZE * 1.2));
    p.angle = Math.random() * Math.PI * 2;
    p.body = [];
    p.score = Math.max(10, Math.floor(p.score * 0.7));
}

io.on('connection', (socket) => {
    let currentRoom = 'casual';

    socket.on('join', (data) => {
        currentRoom = data.room || 'casual';
        socket.join(currentRoom);

        rooms[currentRoom].players[socket.id] = {
            id: socket.id,
            name: data.name || 'Chiến Binh',
            x: Math.floor((Math.random() - 0.5) * (MAP_SIZE * 1.2)),
            y: Math.floor((Math.random() - 0.5) * (MAP_SIZE * 1.2)),
            angle: Math.random() * Math.PI * 2,
            speed: 5,
            score: 10,
            lives: 3,
            color: data.color || '#8b5cf6',
            headType: data.headType || 'dragon',
            bodyStyle: data.bodyStyle || 'solid',
            body: []
        };

        socket.emit('init', { id: socket.id, mapSize: MAP_SIZE, room: currentRoom });
    });

    socket.on('turn', (angle) => {
        if (rooms[currentRoom] && rooms[currentRoom].players[socket.id]) {
            rooms[currentRoom].players[socket.id].angle = angle;
        }
    });

    socket.on('disconnect', () => {
        if (rooms[currentRoom] && rooms[currentRoom].players[socket.id]) {
            delete rooms[currentRoom].players[socket.id];
        }
    });
});

setInterval(() => {
    Object.keys(rooms).forEach(rKey => {
        const room = rooms[rKey];
        const hitPlayers = new Set();
        const players = room.players;
        const foods = room.foods;

        Object.keys(players).forEach(id => {
            const p = players[id];
            if (!p) return;

            p.x += Math.cos(p.angle) * p.speed;
            p.y += Math.sin(p.angle) * p.speed;

            p.body.unshift({ x: Math.round(p.x), y: Math.round(p.y) });
            if (p.body.length > p.score * 2) {
                p.body.pop();
            }

            if (Math.abs(p.x) >= MAP_SIZE || Math.abs(p.y) >= MAP_SIZE) {
                hitPlayers.add(id);
            }
        });

        Object.keys(players).forEach(idA => {
            const pA = players[idA];
            if (!pA || hitPlayers.has(idA)) return;

            Object.keys(players).forEach(idB => {
                const pB = players[idB];
                if (!pB) return;

                const startIndex = (idA === idB) ? 14 : 0;
                for (let i = startIndex; i < pB.body.length; i += 2) {
                    const seg = pB.body[i];
                    const dx = pA.x - seg.x;
                    const dy = pA.y - seg.y;
                    if (dx * dx + dy * dy < 484) { // 22^2
                        hitPlayers.add(idA);
                        break;
                    }
                }
            });
        });

        hitPlayers.forEach(id => {
            const p = players[id];
            if (!p) return;

            for (let i = 0; i < p.body.length; i += 3) {
                const seg = p.body[i];
                const f = createFood();
                f.x = seg.x;
                f.y = seg.y;
                foods.push(f);
            }

            p.lives -= 1;
            if (p.lives > 0) {
                respawnPlayer(p);
            } else {
                delete players[id];
            }
        });

        Object.keys(players).forEach(id => {
            const p = players[id];
            if (!p || hitPlayers.has(id)) return;

            for (let i = foods.length - 1; i >= 0; i--) {
                const f = foods[i];
                const dx = p.x - f.x;
                const dy = p.y - f.y;
                const distSq = dx * dx + dy * dy;
                const maxDist = 16 + f.radius;

                if (distSq < maxDist * maxDist) {
                    p.score += f.points;
                    foods[i] = createFood();
                }
            }
        });

        io.to(rKey).emit('state', { players, foods, mapSize: MAP_SIZE });
    });
}, 1000 / 60);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});