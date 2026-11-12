/** Whether this device has seen the first-time tour. Stored on the device, not the account. */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'lendr.tour.seen.v1';

export async function hasSeenTour() {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'yes';
  } catch {
    // If storage isn't available, don't keep showing the tour.
    return true;
  }
}

export async function markTourSeen() {
  try {
    await AsyncStorage.setItem(KEY, 'yes');
  } catch {
    // Not worth bothering anyone about.
  }
}
