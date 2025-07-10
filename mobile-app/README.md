# Vehicle Tracking Expo App

Expo React Native εφαρμογή για την παρακολούθηση οχημάτων που στέλνει τη θέση σε real-time στον server.

## Χαρακτηριστικά

- **Background Location Tracking** - Συνεχής παρακολούθηση με Expo Location
- **Offline Support** - Αποθήκευση θέσεων όταν δεν υπάρχει σύνδεση
- **Real-time Updates** - Αποστολή θέσης κάθε 5 δευτερόλεπτα
- **Network Monitoring** - Παρακολούθηση κατάστασης δικτύου με Expo Network
- **Notifications** - Ειδοποιήσεις για την κατάσταση tracking
- **Easy Development** - Χρήση Expo για εύκολη ανάπτυξη και testing

## Εγκατάσταση

### Προαπαιτούμενα

1. Node.js (>= 16)
2. Expo CLI: `npm install -g @expo/cli`
3. Expo Go app στο κινητό σας (για testing)

### Βήματα Εγκατάστασης

1. Μεταβείτε στον φάκελο mobile-app:
```bash
cd mobile-app
```

2. Εγκαταστήστε τις dependencies:
```bash
npm install
```

3. Ξεκινήστε το Expo development server:
```bash
npx expo start
```

4. Σκανάρετε το QR code με το Expo Go app ή πατήστε:
   - `a` για Android emulator
   - `i` για iOS simulator

## Ρύθμιση

### Server URL
Αλλάξτε το `serverUrl` στην εφαρμογή να δείχνει στη σωστή IP διεύθυνση του server σας:
```
http://YOUR_SERVER_IP:3001
```

### Vehicle ID
Ορίστε ένα μοναδικό ID για κάθε όχημα (π.χ. PATROL-001, PATROL-002)

## Expo Modules που χρησιμοποιούνται

- **expo-location** - Για geolocation και background tracking
- **expo-network** - Για monitoring της σύνδεσης
- **expo-task-manager** - Για background tasks
- **expo-background-fetch** - Για background updates
- **expo-notifications** - Για notifications
- **expo-constants** - Για device constants

## Background Tracking

Η εφαρμογή χρησιμοποιεί:
- **expo-location** με background location updates
- **expo-task-manager** για background tasks
- **Foreground service** για Android
- **Background App Refresh** για iOS

## Χρήση

1. **Ρυθμίσεις**: Εισάγετε το Vehicle ID και Server URL
2. **Αποθήκευση**: Πατήστε "Αποθήκευση Ρυθμίσεων"
3. **Δοκιμή**: Πατήστε "Δοκιμή Σύνδεσης" για να βεβαιωθείτε ότι ο server είναι προσβάσιμος
4. **Έναρξη**: Ενεργοποιήστε το switch "Παρακολούθηση"

## Development με Expo

### Expo Go (Development)
```bash
npx expo start
```

### Build για Production

#### Android APK
```bash
npx expo build:android
```

#### iOS IPA
```bash
npx expo build:ios
```

#### EAS Build (Recommended)
```bash
npm install -g eas-cli
eas build --platform android
eas build --platform ios
```

## Permissions

### Android
- `ACCESS_FINE_LOCATION` - Για ακριβή τοποθεσία
- `ACCESS_BACKGROUND_LOCATION` - Για background tracking
- `FOREGROUND_SERVICE` - Για foreground service
- `INTERNET` - Για αποστολή δεδομένων

### iOS
- `NSLocationWhenInUseUsageDescription` - Τοποθεσία όταν χρησιμοποιείται
- `NSLocationAlwaysAndWhenInUseUsageDescription` - Τοποθεσία πάντα
- `UIBackgroundModes` - Background location updates

## Troubleshooting

### Δεν λειτουργεί το background tracking
- Βεβαιωθείτε ότι έχετε δώσει όλα τα permissions
- Στο Android, απενεργοποιήστε το battery optimization
- Στο iOS, ενεργοποιήστε το Background App Refresh

### Σφάλματα σύνδεσης
- Ελέγξτε ότι ο server τρέχει στο σωστό port
- Βεβαιωθείτε ότι η IP διεύθυνση είναι σωστή
- Για testing με Expo Go, χρησιμοποιήστε την IP του υπολογιστή σας

### Expo Go Limitations
- Το background tracking μπορεί να είναι περιορισμένο στο Expo Go
- Για πλήρη λειτουργικότητα, κάντε build την εφαρμογή

## API Integration

Η εφαρμογή στέλνει POST requests στο endpoint:
```
POST /api/location
```

Με JSON payload:
```json
{
  "vehicleId": "PATROL-001",
  "latitude": 37.9755,
  "longitude": 23.7348,
  "speed": 30,
  "heading": 90,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Πλεονεκτήματα του Expo

- ✅ **Εύκολη ανάπτυξη** - Δεν χρειάζεται Android Studio/Xcode
- ✅ **Hot reloading** - Άμεση προεπισκόπηση αλλαγών
- ✅ **Cross-platform** - Ένας κώδικας για Android και iOS
- ✅ **Managed workflow** - Αυτόματη διαχείριση native dependencies
- ✅ **Easy testing** - Testing με Expo Go app
- ✅ **OTA Updates** - Over-the-air updates χωρίς app store

## Σημειώσεις

- Η εφαρμογή αποθηκεύει τις αποτυχημένες αποστολές τοπικά
- Το background tracking λειτουργεί καλύτερα σε production build
- Για development, χρησιμοποιήστε την IP διεύθυνση του υπολογιστή σας
- Για production, συνιστάται η χρήση HTTPS και authentication