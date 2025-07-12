import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Icon } from 'leaflet';
import { Car, MapPin, Clock, BarChart3, Users, Route, Download, Calendar, Bell, BellOff } from 'lucide-react';
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

interface VehicleConnectionStatus {
  vehicleId: string;
  connected: boolean;
}
// Component to handle map centering
const MapController = ({ center, zoom }: { center: [number, number] | null, zoom?: number }) => {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom(), {
        animate: true,
        duration: 1
      });
    }
  }, [center, zoom, map]);

  return null;
};




function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [vehicles, setVehicles] = useState<Map<string, VehicleData>>(new Map());
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [dayStats, setDayStats] = useState<DayStats | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showOfflineVehicles, setShowOfflineVehicles] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [connectedVehicles, setConnectedVehicles] = useState<Set<string>>(new Set());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  // Function to handle vehicle selection and map centering
  const handleVehicleSelect = (vehicleId: string) => {
    setSelectedVehicle(vehicleId);

    // Center map on selected vehicle
    const vehicle = vehicles.get(vehicleId);
    if (vehicle && vehicle.positions.length > 0) {
      const lastPosition = vehicle.positions[vehicle.positions.length - 1];
      setMapCenter([lastPosition.latitude, lastPosition.longitude]);
    }
  };



  // Function to check if vehicle is active (sent data within last minute)
  const isVehicleActive = (vehicle: VehicleData): boolean => {
    const now = new Date();
    const lastUpdate = new Date(vehicle.lastUpdate);
    const timeDiff = now.getTime() - lastUpdate.getTime();
    return timeDiff <= 60000; // 1 minute = 60000 milliseconds
  };

  useEffect(() => {
    // Connect to Socket.IO server (will be running on port 3001)
    const newSocket = io("https://armyfire-production.up.railway.app", {
      transports: ["websocket"],
      withCredentials: true,
    });
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
    newSocket.on('vehicleConnectionStatus', (status: VehicleConnectionStatus) => {
      setConnectedVehicles(prev => {
        const newConnected = new Set(prev);
        if (status.connected) {
          newConnected.add(status.vehicleId);
        } else {
          newConnected.delete(status.vehicleId);
        }
        return newConnected;
      });
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
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  const exportData = async (date?: string) => {
    try {
      const exportDate = date || getTodayString();
      const response = await fetch(`http://localhost:3001/api/history/${exportDate}`);

      if (!response.ok) {
        if (response.status === 404) {
          alert(`Δεν βρέθηκαν δεδομένα για την ημερομηνία ${exportDate}`);
          return;
        }
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vehicle-data-${exportDate}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`Τα δεδομένα εξήχθησαν επιτυχώς: vehicle-data-${exportDate}.json`);
    } catch (error) {
      console.error('Export error:', error);
      alert(`Σφάλμα κατά την εξαγωγή: ${error.message}`);
    }
  };

  const loadHistoricalData = async (date: string) => {
    try {
      console.log(date);
      const response = await fetch(`http://localhost:3001/api/history/${date}`);

      if (!response.ok) {
        if (response.status === 404) {
          // Clear vehicles and show empty state instead of error
          setVehicles(new Map());
          setConnectedVehicles(new Set());
          setDayStats({
            date: date,
            totalDistance: 0,
            totalTime: 0,
            vehiclesCount: 0
          });
          return;
        }
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log(data);// dokimastiko
      const vehicleMap = new Map();
      let totalDistance = 0;

      Object.keys(data).forEach(vehicleId => {
        const vehicle = data[vehicleId];
        totalDistance += vehicle.totalDistance || 0;
        vehicleMap.set(vehicleId, {
          ...vehicle,
          lastUpdate: new Date(vehicle.lastUpdate),
          positions: vehicle.positions.map(pos => ({
            ...pos,
            timestamp: new Date(pos.timestamp)
          }))
        });
      });

      setVehicles(vehicleMap);
      // For historical data, show all vehicles as "connected" for display purposes
      setConnectedVehicles(new Set(Object.keys(data)));
      setDayStats({
        date: date,
        totalDistance: totalDistance,
        totalTime: 0,
        vehiclesCount: Object.keys(data).length
      });
    } catch (error) {
      console.error('Load historical data error:', error);
      // Clear vehicles for failed requests
      setVehicles(new Map());
      setConnectedVehicles(new Set());
      setDayStats({
        date: date,
        totalDistance: 0,
        totalTime: 0,
        vehiclesCount: 0
      });

      // Only show error for network issues, not for missing data
      if (error.message.includes('Failed to fetch')) {
        console.log(`Δεν υπάρχουν δεδομένα για την ημερομηνία ${date}`);
      } else {
        alert(`Σφάλμα κατά τη φόρτωση δεδομένων: ${error.message}`);
      }
    }
  };

  const getTodayString = () => {
    return new Date().toISOString().split('T')[0];
  };

  const isToday = (date: string) => {
    return date === getTodayString();
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    if (isToday(date)) {
      // If today is selected, reconnect to real-time updates
      if (socket) {
        socket.connect();
      }
    } else {
      // If historical date is selected, disconnect from real-time and load historical data
      if (socket) {
        socket.disconnect();
      }
      loadHistoricalData(date);
    }
  };

  const vehicleArray = Array.from(vehicles.values());
  const selectedVehicleData = selectedVehicle ? vehicles.get(selectedVehicle) : null;
  // Filter vehicles based on offline visibility setting and activity
  const filteredVehicles = vehicleArray.filter(vehicle => {
    // For today's data, only show vehicles that are socket-connected
    if (isToday(selectedDate) && !connectedVehicles.has(vehicle.id)) {
      return false;
    }
    // Always hide vehicles that haven't sent data for more than 1 minute (only for today)
    if (isToday(selectedDate) && !isVehicleActive(vehicle)) {
      return false;
    }

    // Apply offline filter
    if (showOfflineVehicles) return true;
    return vehicle.status === 'online';
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Car className="h-8 w-8 text-blue-500" />
            <h1 className="text-xl font-bold">Σύστημα Παρακολούθησης Περιπολιών</h1>
            {notificationsEnabled && (
              <div className="flex items-center space-x-1 text-green-400">
                <Bell className="h-4 w-4" />
                <span className="text-xs">Notifications ON</span>
              </div>
            )}
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
            {/* Date Selector */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-400 mb-2">ΗΜΕΡΟΜΗΝΙΑ</label>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                />
                {!isToday(selectedDate) && (
                  <span className="text-xs text-yellow-400">Ιστορικά δεδομένα</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-xs text-gray-400">Οχήματα</p>
                    <p className="text-lg font-semibold">{filteredVehicles.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Route className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-xs text-gray-400">Σύνολο Km</p>
                    <p className="text-lg font-semibold">
                      {formatDistance(filteredVehicles.reduce((sum, v) => sum + v.totalDistance, 0))}
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
            {/* Export and Filter Controls */}
            <div className="mt-4 space-y-2">
              <button
                onClick={() => exportData(selectedDate)}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-3 rounded-md transition-colors flex items-center justify-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Εξαγωγή Δεδομένων</span>
              </button>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Εμφάνιση offline οχημάτων</span>
                <button
                  onClick={() => setShowOfflineVehicles(!showOfflineVehicles)}
                  className={`w-12 h-6 rounded-full transition-colors ${showOfflineVehicles ? 'bg-blue-600' : 'bg-gray-600'
                    }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${showOfflineVehicles ? 'translate-x-6' : 'translate-x-1'
                    }`}></div>
                </button>
              </div>
            </div>
          </div>

          {/* Vehicles List */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">ΟΧΗΜΑΤΑ</h3>
            {filteredVehicles.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500 mb-2">
                  {isToday(selectedDate) ? (
                    <div>
                      <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Δεν υπάρχουν ενεργά οχήματα</p>
                    </div>
                  ) : (
                    <div>
                      <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Δεν υπάρχουν δεδομένα</p>
                      <p className="text-xs mt-1">για την {selectedDate}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredVehicles.map(vehicle => (
                  <div
                    key={vehicle.id}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${selectedVehicle === vehicle.id
                      ? 'bg-blue-600 border border-blue-500'
                      : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    onClick={() => handleVehicleSelect(vehicle.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${vehicle.status === 'online' ? 'bg-green-500' : 'bg-red-500'
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
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <MapContainer
            center={[39.6390, 22.4191]} // Larisa coordinates
            zoom={10}
            className="w-full h-full"
          >
            <MapController center={mapCenter} zoom={14} />
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {filteredVehicles.map(vehicle => {
              const lastPosition = vehicle.positions[vehicle.positions.length - 1];
              if (!lastPosition) return null;

              const isSelected = selectedVehicle === vehicle.id;
              // Create custom icon based on vehicle status
              const vehicleIcon = new Icon({
                iconUrl: vehicle.status === 'online'
                  ? 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png'
                  : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyLjUgMEMxOS40MDM2IDAgMjUgNS41OTY0NCAyNSAxMi41QzI1IDE5LjQwMzYgMTkuNDAzNiAyNSAxMi41IDI1QzUuNTk2NDQgMjUgMCAxOS40MDM2IDAgMTIuNUMwIDUuNTk2NDQgNS41OTY0NCAwIDEyLjUgMFoiIGZpbGw9IiM5Q0EzQUYiLz4KPHBhdGggZD0iTTEyLjUgNDFMMTIuNSAyNSIgc3Ryb2tlPSIjOUNBM0FGIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                shadowSize: [41, 41]
              });

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
                    icon={vehicleIcon}
                  >
                    <Popup>
                      <div className="text-gray-900">
                        <h4 className="font-semibold">{vehicle.name}</h4>
                        <p className="text-sm">
                          Κατάσταση: <span className={vehicle.status === 'online' ? 'text-green-600' : 'text-red-600'}>
                            {vehicle.status === 'online' ? 'Online' : 'Offline'}
                          </span>
                        </p>
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
                  <div className={`w-2 h-2 rounded-full ${isToday(selectedDate) && !isVehicleActive(selectedVehicleData)
                    ? 'bg-gray-500'
                    : selectedVehicleData.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                  <span>
                    {isToday(selectedDate) && !isVehicleActive(selectedVehicleData)
                      ? 'Αδρανές'
                      : selectedVehicleData.status === 'online' ? 'Online' : 'Offline'}
                  </span>
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