# Σύστημα Παρακολούθησης Περιπολιών

Ένα σύστημα real-time παρακολούθησης οχημάτων με Socket.io, React, και Node.js.

## Χαρακτηριστικά

- **Real-time tracking** οχημάτων με Socket.io
- **Δωρεάν χάρτες** με OpenStreetMap/Leaflet
- **Αποθήκευση δεδομένων** σε JSON files ανά ημέρα
- **Υπολογισμός απόστασης** για κάθε όχημα
- **Mobile-friendly** interface
- **Εμφάνιση διαδρομών** και real-time θέσεων

## Εγκατάσταση

1. Εγκαταστήστε τις dependencies:
```bash
npm install
```

2. Ξεκινήστε τον server:
```bash
npm run server
```

3. Σε άλλο terminal, ξεκινήστε το frontend:
```bash
npm run dev
```

## Χρήση

### Frontend Dashboard
- Ανοίξτε http://localhost:5173 για το dashboard
- Εμφανίζει real-time θέσεις οχημάτων
- Στατιστικά και ιστορικό διαδρομών

### Mobile Simulator
- Ανοίξτε `mobile-simulator.html` στον browser
- Προσομοιώνει mobile app που στέλνει θέσεις
- Μπορείτε να στείλετε θέσεις μεμονωμένα ή αυτόματα

### Mobile App Integration
Για να συνδέσετε React Native app, στείλτε POST request στο:
```
http://localhost:3001/api/location
```

Με JSON body:
```json
{
  "vehicleId": "PATROL-001",
  "latitude": 37.9755,
  "longitude": 23.7348,
  "speed": 30,
  "heading": 90
}
```

## API Endpoints

- `POST /api/location` - Αποστολή θέσης οχήματος
- `GET /api/vehicles` - Λήψη όλων των οχημάτων
- `GET /api/vehicles/:vehicleId` - Λήψη συγκεκριμένου οχήματος
- `GET /api/history/:date` - Λήψη ιστορικών δεδομένων (format: YYYY-MM-DD)

## Αρχεία Δεδομένων

Τα δεδομένα αποθηκεύονται στον φάκελο `data/` με την μορφή:
- `2024-01-15.json` - Δεδομένα για 15 Ιανουαρίου 2024
- `2024-01-16.json` - Δεδομένα για 16 Ιανουαρίου 2024

## Δομή Δεδομένων

```json
{
  "PATROL-001": {
    "id": "PATROL-001",
    "name": "Vehicle PATROL-001",
    "positions": [
      {
        "latitude": 37.9755,
        "longitude": 23.7348,
        "timestamp": "2024-01-15T10:30:00.000Z",
        "speed": 30,
        "heading": 90
      }
    ],
    "totalDistance": 15.5,
    "status": "online",
    "lastUpdate": "2024-01-15T10:30:00.000Z"
  }
}
```

## Τεχνολογίες

- **Frontend**: React, TypeScript, Tailwind CSS, Leaflet
- **Backend**: Node.js, Express, Socket.io
- **Χάρτες**: OpenStreetMap (δωρεάν)
- **Αποθήκευση**: JSON files
- **Real-time**: Socket.io

## Παραμετροποίηση

Μπορείτε να αλλάξετε:
- Port του server στο `server.js` (default: 3001)
- Διάστημα offline detection (default: 5 λεπτά)
- Κεντρικές συντεταγμένες χάρτη στο `App.tsx`