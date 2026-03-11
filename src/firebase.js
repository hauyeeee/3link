// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDWTDCNUZpgFZeW2_nG2mpVux1WtdgGRU4",
  authDomain: "link-4c3a3.firebaseapp.com",
  projectId: "link-4c3a3",
  storageBucket: "link-4c3a3.firebasestorage.app",
  messagingSenderId: "803881176737",
  appId: "1:803881176737:web:5dec17a0bd50514a31aae0",
  measurementId: "G-JE3SBB5BLG"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 導出資料庫與圖庫，等 App.jsx 可以用
export const db = getFirestore(app);
export const storage = getStorage(app);