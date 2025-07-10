import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Switch,
  TextInput,
  ScrollView,
  StatusBar,
  Platform,
  AppState,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

const LOCATION_TASK_NAME = 'background-location-task';

interface LocationData {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: string;
}

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    const location = locations[0];
    
    if (location) {
      try {
        // Get stored settings
        const vehicleId = await AsyncStorage.getItem('vehicleId') || 'PATROL-001';
        const serverUrl = await AsyncStorage.getItem('serverUrl') || 'http://192.168.1.100:3001';
        
        const locationData: LocationData = {
          vehicleId,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          speed: location.coords.speed || 0,
          heading: location.coords.heading || 0,
          timestamp: new Date().toISOString(),
        };

        // Try to send location
        await sendLocationToServer(locationData, serverUrl);
      } catch (error) {
        console.error('Background task error:', error);
      }
    }
  }
});

const sendLocationToServer = async (locationData: LocationData, serverUrl: string) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${serverUrl}/api/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(locationData),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Send location error:', error);
    // Store failed location for retry
    await storeFailedLocation(locationData);
    return false;
  }
};

const storeFailedLocation = async (locationData: LocationData) => {
  try {
    const failedLocations = await AsyncStorage.getItem('failedLocations');
    const locations = failedLocations ? JSON.parse(failedLocations) : [];
    locations.push(locationData);
    
    // Keep only last 100 failed locations
    if (locations.length > 100) {
      locations.splice(0, locations.length - 100);
    }
    
    await AsyncStorage.setItem('failedLocations', JSON.stringify(locations));
  } catch (error) {
    console.error('Error storing failed location:', error);
  }
};

const App = () => {
  const [vehicleId, setVehicleId] = useState('PATROL-001');
  const [serverUrl, setServerUrl] = useState('http://192.168.1.100:3001');
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [lastSentTime, setLastSentTime] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [sentCount, setSentCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    loadSettings();
    requestPermissions();
    checkNetworkStatus();
    
    // Monitor app state changes
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' && isTracking) {
        console.log('App went to background, continuing tracking...');
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, []);

  const loadSettings = async () => {
    try {
      const savedVehicleId = await AsyncStorage.getItem('vehicleId');
      const savedServerUrl = await AsyncStorage.getItem('serverUrl');
      
      if (savedVehicleId) setVehicleId(savedVehicleId);
      if (savedServerUrl) setServerUrl(savedServerUrl);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem('vehicleId', vehicleId);
      await AsyncStorage.setItem('serverUrl', serverUrl);
      Alert.alert('Επιτυχία', 'Οι ρυθμίσεις αποθηκεύτηκαν');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Σφάλμα', 'Δεν ήταν δυνατή η αποθήκευση των ρυθμίσεων');
    }
  };

  const requestPermissions = async () => {
    try {
      // Request location permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        Alert.alert(
          'Άδεια Τοποθεσίας',
          'Η εφαρμογή χρειάζεται πρόσβαση στην τοποθεσία για να λειτουργήσει'
        );
        return false;
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        Alert.alert(
          'Background Location',
          'Για καλύτερη λειτουργία, επιτρέψτε την πρόσβαση στην τοποθεσία στο background'
        );
      }

      // Request notification permissions
      const { status: notificationStatus } = await Notifications.requestPermissionsAsync();
      if (notificationStatus !== 'granted') {
        Alert.alert(
          'Notifications',
          'Η εφαρμογή χρειάζεται άδεια για notifications'
        );
      }

      return true;
    } catch (error) {
      console.error('Permission error:', error);
      return false;
    }
  };

  const checkNetworkStatus = async () => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      setIsConnected(networkState.isConnected ?? false);
    } catch (error) {
      console.error('Network check error:', error);
    }
  };

  const getCurrentLocation = async (): Promise<LocationData> => {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 10,
    });

    const locationData: LocationData = {
      vehicleId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      speed: location.coords.speed || 0,
      heading: location.coords.heading || 0,
      timestamp: new Date().toISOString(),
    };

    return locationData;
  };

  const sendLocationToServerLocal = async (locationData: LocationData) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${serverUrl}/api/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(locationData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setSentCount(prev => prev + 1);
        setLastSentTime(new Date());
        return true;
      } else {
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (error) {
      console.error('Send location error:', error);
      setErrorCount(prev => prev + 1);
      await storeFailedLocation(locationData);
      return false;
    }
  };

  const retryFailedLocations = async () => {
    try {
      const failedLocations = await AsyncStorage.getItem('failedLocations');
      if (!failedLocations) return;

      const locations = JSON.parse(failedLocations);
      const successfulRetries = [];

      for (const location of locations) {
        const success = await sendLocationToServerLocal(location);
        if (success) {
          successfulRetries.push(location);
        }
      }

      // Remove successful retries
      const remainingFailed = locations.filter(
        (loc: LocationData) => !successfulRetries.includes(loc)
      );
      
      await AsyncStorage.setItem('failedLocations', JSON.stringify(remainingFailed));
    } catch (error) {
      console.error('Error retrying failed locations:', error);
    }
  };

  const startTracking = async () => {
    if (!vehicleId.trim()) {
      Alert.alert('Σφάλμα', 'Παρακαλώ εισάγετε Vehicle ID');
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      return;
    }

    try {
      // Start background location tracking
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000, // 5 seconds
        distanceInterval: 10, // 10 meters
        foregroundService: {
          notificationTitle: 'Παρακολούθηση Οχήματος',
          notificationBody: 'Η εφαρμογή παρακολουθεί τη θέση του οχήματος',
        },
      });

      setIsTracking(true);
      setSentCount(0);
      setErrorCount(0);

      // Send initial location
      const location = await getCurrentLocation();
      setCurrentLocation(location);
      await sendLocationToServerLocal(location);

      Alert.alert('Επιτυχία', 'Η παρακολούθηση ξεκίνησε');
    } catch (error) {
      console.error('Start tracking error:', error);
      Alert.alert('Σφάλμα', 'Δεν ήταν δυνατή η έναρξη της παρακολούθησης');
    }
  };

  const stopTracking = async () => {
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      setIsTracking(false);
      Alert.alert('Επιτυχία', 'Η παρακολούθηση σταμάτησε');
    } catch (error) {
      console.error('Stop tracking error:', error);
      Alert.alert('Σφάλμα', 'Δεν ήταν δυνατή η διακοπή της παρακολούθησης');
    }
  };

  const testConnection = async () => {
    try {
      await checkNetworkStatus();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${serverUrl}/api/vehicles`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        Alert.alert('Επιτυχία', 'Η σύνδεση με τον server είναι επιτυχής');
      } else {
        Alert.alert('Σφάλμα', `Server error: ${response.status}`);
      }
    } catch (error) {
      Alert.alert('Σφάλμα', `Δεν ήταν δυνατή η σύνδεση: ${error.message}`);
    }
  };

  const sendTestLocation = async () => {
    try {
      const location = await getCurrentLocation();
      setCurrentLocation(location);
      const success = await sendLocationToServerLocal(location);
      
      if (success) {
        Alert.alert('Επιτυχία', 'Η θέση στάλθηκε επιτυχώς');
      } else {
        Alert.alert('Σφάλμα', 'Δεν ήταν δυνατή η αποστολή της θέσης');
      }
    } catch (error) {
      Alert.alert('Σφάλμα', `Location error: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1f2937" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Παρακολούθηση Οχήματος</Text>
        <View style={[styles.statusIndicator, { 
          backgroundColor: isConnected ? '#10b981' : '#ef4444' 
        }]} />
      </View>

      <ScrollView style={styles.content}>
        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ρυθμίσεις</Text>
          
          <Text style={styles.label}>Vehicle ID</Text>
          <TextInput
            style={styles.input}
            value={vehicleId}
            onChangeText={setVehicleId}
            placeholder="π.χ. PATROL-001"
            placeholderTextColor="#9ca3af"
          />
          
          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://192.168.1.100:3001"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
          />
          
          <TouchableOpacity style={styles.secondaryButton} onPress={saveSettings}>
            <Text style={styles.secondaryButtonText}>Αποθήκευση Ρυθμίσεων</Text>
          </TouchableOpacity>
        </View>

        {/* Control Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Έλεγχος</Text>
          
          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>Παρακολούθηση</Text>
            <Switch
              value={isTracking}
              onValueChange={isTracking ? stopTracking : startTracking}
              trackColor={{ false: '#374151', true: '#3b82f6' }}
              thumbColor={isTracking ? '#ffffff' : '#9ca3af'}
            />
          </View>
          
          <TouchableOpacity style={styles.secondaryButton} onPress={testConnection}>
            <Text style={styles.secondaryButtonText}>Δοκιμή Σύνδεσης</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.secondaryButton} onPress={sendTestLocation}>
            <Text style={styles.secondaryButtonText}>Αποστολή Δοκιμαστικής Θέσης</Text>
          </TouchableOpacity>
        </View>

        {/* Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Κατάσταση</Text>
          
          <View style={styles.statusGrid}>
            <View style={styles.statusCard}>
              <Text style={styles.statusValue}>{sentCount}</Text>
              <Text style={styles.statusLabel}>Επιτυχείς</Text>
            </View>
            <View style={styles.statusCard}>
              <Text style={styles.statusValue}>{errorCount}</Text>
              <Text style={styles.statusLabel}>Σφάλματα</Text>
            </View>
          </View>
          
          {currentLocation && (
            <View style={styles.locationInfo}>
              <Text style={styles.locationTitle}>Τρέχουσα Θέση</Text>
              <Text style={styles.locationText}>
                Lat: {currentLocation.latitude.toFixed(6)}
              </Text>
              <Text style={styles.locationText}>
                Lng: {currentLocation.longitude.toFixed(6)}
              </Text>
              <Text style={styles.locationText}>
                Ταχύτητα: {currentLocation.speed.toFixed(1)} m/s
              </Text>
            </View>
          )}
          
          {lastSentTime && (
            <Text style={styles.lastSent}>
              Τελευταία αποστολή: {lastSentTime.toLocaleTimeString('el-GR')}
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    backgroundColor: '#1f2937',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : Constants.statusBarHeight + 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  label: {
    color: '#d1d5db',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  secondaryButton: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    marginTop: 15,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  switchLabel: {
    color: '#ffffff',
    fontSize: 16,
  },
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statusCard: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 15,
    flex: 0.48,
    alignItems: 'center',
  },
  statusValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statusLabel: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
  },
  locationInfo: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
  },
  locationTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  locationText: {
    color: '#d1d5db',
    fontSize: 14,
    marginBottom: 4,
  },
  lastSent: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default App;