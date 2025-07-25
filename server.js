import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.use(cors({
  origin: [
    "http://localhost:8082",
    "http://localhost:8081",
    "https://armyfire-production.up.railway.app",
    "http://localhost:4173/"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  }
});



app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'dist')));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Today's file: ${getTodayFilename()}`);
});



// Data storage
const DATA_DIR = './data';
const connectedVehicles = new Set();

console.log(`Data will be saved to: ${DATA_DIR}`);
const vehicleData = new Map();

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Get today's date string
const getTodayString = () => {
  return new Date().toISOString().split('T')[0];
};

// Get today's filename
const getTodayFilename = () => {
  return path.join(DATA_DIR, `${getTodayString()}.json`);
};

// Load today's data
const loadTodayData = () => {
  const filename = getTodayFilename();
  //console.log(filename);
  if (fs.existsSync(filename)) {
    try {
      const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
      console.log(data);
      return data;
    } catch (error) {
      console.error('Error loading today\'s data:', error);
      return {};
    }
  }
  return {};
};

// Save today's data
const saveTodayData = (data) => {
  const filename = getTodayFilename();
  try {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving today\'s data:', error);
  }
};

// Calculate distance between two points
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Calculate total distance for a vehicle
const calculateTotalDistance = (positions) => {
  let total = 0;
  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1];
    const curr = positions[i];
    total += calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
  }
  return total;
};

// Initialize with today's data
let todayData = loadTodayData();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Track vehicle connection
  socket.on('vehicleConnect', (vehicleId) => {
    connectedVehicles.add(vehicleId);
    console.log(`Vehicle ${vehicleId} connected via socket`);

    // Broadcast vehicle connection status
    io.emit('vehicleConnectionStatus', {
      vehicleId,
      connected: true
    });
  });

  // Handle vehicle disconnection
  socket.on('vehicleDisconnect', (vehicleId) => {
    connectedVehicles.delete(vehicleId);
    console.log(`Vehicle ${vehicleId} disconnected via socket`);

    // Broadcast vehicle disconnection status
    io.emit('vehicleConnectionStatus', {
      vehicleId,
      connected: false
    });
  });

  // Send current day stats
  const sendDayStats = () => {
    const vehicles = Object.keys(todayData);
    const totalDistance = vehicles.reduce((sum, vehicleId) => {
      const vehicle = todayData[vehicleId];
      return sum + (vehicle.totalDistance || 0);
    }, 0);

    socket.emit('dayStats', {
      date: getTodayString(),
      totalDistance,
      totalTime: 0, // Can be calculated based on first and last position
      vehiclesCount: vehicles.length
    });
  };

  sendDayStats();

  // Send existing vehicle data
  Object.keys(todayData).filter(vehicleId => connectedVehicles.has(vehicleId)).forEach(vehicleId => {
    const vehicle = todayData[vehicleId];
    if (vehicle.positions && vehicle.positions.length > 0) {
      const lastPosition = vehicle.positions[vehicle.positions.length - 1];
      socket.emit('vehicleUpdate', {
        vehicleId,
        latitude: lastPosition.latitude,
        longitude: lastPosition.longitude,
        timestamp: lastPosition.timestamp,
        speed: lastPosition.speed,
        heading: lastPosition.heading
      });
    }
  });

  // Send current connection statuses
  Object.keys(todayData).forEach(vehicleId => {
    socket.emit('vehicleConnectionStatus', {
      vehicleId,
      connected: connectedVehicles.has(vehicleId)
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// REST API endpoint for receiving location updates from mobile app
app.post('/api/location', (req, res) => {
  const { vehicleId, latitude, longitude, speed, heading } = req.body;

  if (!vehicleId || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const position = {
    latitude,
    longitude,
    timestamp: new Date().toISOString(),
    speed: speed || 0,
    heading: heading || 0
  };

  // Initialize vehicle data if not exists
  if (!todayData[vehicleId]) {
    todayData[vehicleId] = {
      id: vehicleId,
      name: `Vehicle ${vehicleId}`,
      positions: [],
      totalDistance: 0,
      status: 'online',
      lastUpdate: position.timestamp
    };
  }

  // Add position to vehicle data
  todayData[vehicleId].positions.push(position);
  todayData[vehicleId].lastUpdate = position.timestamp;
  todayData[vehicleId].status = 'online';

  // Mark vehicle as connected when it sends location data
  connectedVehicles.add(vehicleId);

  // Calculate total distance
  todayData[vehicleId].totalDistance = calculateTotalDistance(todayData[vehicleId].positions);

  // Save to file
  saveTodayData(todayData);// dokiamstiko


  // Broadcast to all connected clients
  io.emit('vehicleUpdate', {
    vehicleId,
    latitude,
    longitude,
    timestamp: position.timestamp,
    speed,
    heading
  });
  // Broadcast connection status
  io.emit('vehicleConnectionStatus', {
    vehicleId,
    connected: true
  });

  // Send updated day stats
  const vehicles = Object.keys(todayData);
  const totalDistance = vehicles.reduce((sum, vId) => {
    const vehicle = todayData[vId];
    return sum + (vehicle.totalDistance || 0);
  }, 0);

  io.emit('dayStats', {
    date: getTodayString(),
    totalDistance,
    totalTime: 0,
    vehiclesCount: vehicles.length
  });

  res.json({
    success: true,
    totalDistance: todayData[vehicleId].totalDistance,
    positionsCount: todayData[vehicleId].positions.length
  });
});

// API endpoint to get vehicle data
app.get('/api/vehicles', (req, res) => {
  // Only return connected vehicles for real-time view
  const connectedVehicleData = {};
  Object.keys(todayData).forEach(vehicleId => {
    if (connectedVehicles.has(vehicleId)) {
      connectedVehicleData[vehicleId] = todayData[vehicleId];
    }
  });
  res.json(connectedVehicleData);
});

// API endpoint to get all vehicle data (including disconnected)
app.get('/api/vehicles/all', (req, res) => {
  res.json(todayData);
});

// API endpoint to get specific vehicle data
app.get('/api/vehicles/:vehicleId', (req, res) => {
  const { vehicleId } = req.params;
  const vehicle = todayData[vehicleId];

  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }

  res.json(vehicle);
});

// API endpoint to get historical data
app.get('/api/history/:date', (req, res) => {
  const { date } = req.params;

  console.log(date); // dokismiastiko

  const filename = path.join(DATA_DIR, `${date}.json`);

  if (!fs.existsSync(filename)) {
    return res.status(404).json({ error: 'Data not found for this date' });
  }

  try {
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error reading historical data' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Clean up old vehicle data (mark as offline after 5 minutes of inactivity)
setInterval(() => {
  const now = new Date();
  Object.keys(todayData).forEach(vehicleId => {
    const vehicle = todayData[vehicleId];
    const lastUpdate = new Date(vehicle.lastUpdate);
    const timeDiff = now - lastUpdate;

    if (timeDiff > 5 * 60 * 1000) { // 5 minutes
      todayData[vehicleId].status = 'offline';
      // Remove from connected vehicles if offline for too long
      connectedVehicles.delete(vehicleId);

      // Broadcast disconnection
      io.emit('vehicleConnectionStatus', {
        vehicleId,
        connected: false
      });

      saveTodayData(todayData);
    }
  });
}, 60000); // Check every minute

