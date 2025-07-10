import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { Icon } from 'leaflet';
import { Car, MapPin, Clock, BarChart3, Users, Route } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface VehiclePosition {
  vehicleId: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  speed?: number;
  heading?: number;
}

interface VehicleData {
  id: string;
  name: string;
  positions: VehiclePosition[];
  totalDistance: number;
  status: 'online' | 'offline';
  lastUpdate: Date;
}

interface DayStats {
  date: string;
  totalDistance: number;
  totalTime: number;
  vehiclesCount: number;
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [vehicles, setVehicles] = useState<Map<string, VehicleData>>(new Map());
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [dayStats, setDayStats] = useState<DayStats | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to Socket.IO server (will be running on port 3001)
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    newSocket.on('vehicleUpdate', (data: VehiclePosition) => {
      setVehicles(prev => {
        const newVehicles = new Map(prev);
        const existing = newVehicles.get(data.vehicleId);
        
        if (existing) {
          const newPositions = [...existing.positions, data];
          const totalDistance = calculateTotalDistance(newPositions);
          
          newVehicles.set(data.vehicleId, {
            ...existing,
            positions: newPositions,
            totalDistance,
            lastUpdate: new Date(data.timestamp),
            status: 'online'
          });
        } else {
          newVehicles.set(data.vehicleId, {
            id: data.vehicleId,
            name: `Vehicle ${data.vehicleId}`,
            positions: [data],
            totalDistance: 0,
            status: 'online',
            lastUpdate: new Date(data.timestamp)
          });
        }
        
        return newVehicles;
      });
    });

    newSocket.on('dayStats', (stats: DayStats) => {
      setDayStats(stats);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const calculateTotalDistance = (positions: VehiclePosition[]): number => {
    let total = 0;
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      total += calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    }
    return total;
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const formatDistance = (distance: number): string => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(2)}km`;
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('el-GR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const vehicleArray = Array.from(vehicles.values());
  const selectedVehicleData = selectedVehicle ? vehicles.get(selectedVehicle) : null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Car className="h-8 w-8 text-blue-500" />
            <h1 className="text-xl font-bold">Σύστημα Παρακολούθησης Περιπολιών</h1>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm">
              {isConnected ? 'Συνδεδεμένο' : 'Αποσυνδεδεμένο'}
            </span>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar */}
        <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
          {/* Stats Cards */}
          <div className="p-4 border-b border-gray-700">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-xs text-gray-400">Οχήματα</p>
                    <p className="text-lg font-semibold">{vehicleArray.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Route className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-xs text-gray-400">Σύνολο Km</p>
                    <p className="text-lg font-semibold">
                      {formatDistance(vehicleArray.reduce((sum, v) => sum + v.totalDistance, 0))}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {dayStats && (
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-xs text-gray-400">Σήμερα</p>
                    <p className="text-sm font-semibold">{formatDistance(dayStats.totalDistance)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Vehicles List */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">ΟΧΗΜΑΤΑ</h3>
            <div className="space-y-2">
              {vehicleArray.map(vehicle => (
                <div
                  key={vehicle.id}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    selectedVehicle === vehicle.id
                      ? 'bg-blue-600 border border-blue-500'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  onClick={() => setSelectedVehicle(vehicle.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        vehicle.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                      <span className="font-medium">{vehicle.name}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatTime(vehicle.lastUpdate)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-300">
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-3 w-3" />
                      <span>{formatDistance(vehicle.totalDistance)}</span>
                    </div>
                    <div className="flex items-center space-x-1 mt-1">
                      <Clock className="h-3 w-3" />
                      <span>{vehicle.positions.length} θέσεις</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <MapContainer
            center={[37.9755, 23.7348]} // Athens coordinates
            zoom={10}
            className="w-full h-full"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {vehicleArray.map(vehicle => {
              const lastPosition = vehicle.positions[vehicle.positions.length - 1];
              if (!lastPosition) return null;

              const isSelected = selectedVehicle === vehicle.id;
              
              return (
                <React.Fragment key={vehicle.id}>
                  {/* Show route for selected vehicle */}
                  {isSelected && vehicle.positions.length > 1 && (
                    <Polyline
                      positions={vehicle.positions.map(pos => [pos.latitude, pos.longitude])}
                      color="#3b82f6"
                      weight={3}
                      opacity={0.7}
                    />
                  )}
                  
                  {/* Vehicle marker */}
                  <Marker
                    position={[lastPosition.latitude, lastPosition.longitude]}
                  >
                    <Popup>
                      <div className="text-gray-900">
                        <h4 className="font-semibold">{vehicle.name}</h4>
                        <p className="text-sm">
                          Τελευταία ενημέρωση: {formatTime(vehicle.lastUpdate)}
                        </p>
                        <p className="text-sm">
                          Σύνολο απόστασης: {formatDistance(vehicle.totalDistance)}
                        </p>
                        <p className="text-sm">
                          Θέσεις: {vehicle.positions.length}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                </React.Fragment>
              );
            })}
          </MapContainer>

          {/* Map overlay info */}
          {selectedVehicleData && (
            <div className="absolute top-4 right-4 bg-gray-800 bg-opacity-95 rounded-lg p-4 border border-gray-700">
              <h3 className="font-semibold mb-2">{selectedVehicleData.name}</h3>
              <div className="space-y-1 text-sm">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    selectedVehicleData.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span>{selectedVehicleData.status === 'online' ? 'Online' : 'Offline'}</span>
                </div>
                <div>Απόσταση: {formatDistance(selectedVehicleData.totalDistance)}</div>
                <div>Θέσεις: {selectedVehicleData.positions.length}</div>
                <div>Τελευταία ενημέρωση: {formatTime(selectedVehicleData.lastUpdate)}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;