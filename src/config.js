import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';

export const firebaseConfig = {
  apiKey: "AIzaSyDJ4hEi2PaQBik4YfIbnGZLIIuQrOhlgFM",
  authDomain: "otb-authentication.firebaseapp.com",
  databaseURL: "https://otb-authentication-default-rtdb.firebaseio.com",
  projectId: "otb-authentication",
  storageBucket: "otb-authentication.appspot.com",
  messagingSenderId: "602902294416",
  appId: "1:602902294416:web:209f123691284884258d15",
  measurementId: "G-29QVCSZLBG"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

if (['localhost', '127.0.0.1', 'bluebot.local', '192.168.5.5'].includes(window.location.hostname)) {
  console.log('using auth emulator');
  firebase.auth().useEmulator('http://localhost:9099');
  // connectAuthEmulator(auth, 'http://localhost:9099');
}

export const db = firebase.database();

export const apiBaseUrl = 'http://127.0.0.1:5001/otb-authentication/us-central1';
export const otbBaseUrl = 'http://127.0.0.1:5001/otb-authentication/us-central1/otb';
