
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCYG4qz1syDa0FdycNexxojNx9LSxkkRwY",
  authDomain: "qlnv-2fa4a.firebaseapp.com",
  projectId: "qlnv-2fa4a",
  storageBucket: "qlnv-2fa4a.firebasestorage.app",
  messagingSenderId: "857771949500",
  appId: "1:857771949500:web:13f6ef3c36da7df7aa7fb9"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// Xuất các công cụ để dùng trong app
export const db = getFirestore(app);
export const auth = getAuth(app);
