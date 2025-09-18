import fetch from "node-fetch";
import cloudinary from "cloudinary";
import admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";

// Initialize Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://quoteapp-8f9fd-default-rtdb.firebaseio.com"
});
const db = admin.database();

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function main() {
  try {
    // Dates
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0]; // "2025-09-18"
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // 1️⃣ Delete yesterday’s Cloudinary folder
    try {
      await cloudinary.v2.api.delete_resources_by_prefix(`daily_images/${yesterdayStr}/`);
      await cloudinary.v2.api.delete_folder(`daily_images/${yesterdayStr}`);
      console.log("Deleted yesterday’s Cloudinary folder:", yesterdayStr);
    } catch (err) {
      console.log("No Cloudinary folder to delete or error:", err.message);
    }

    // 2️⃣ Delete yesterday’s Firebase DB entry
    try {
      await db.ref(`daily_images/${yesterdayStr}`).remove();
      console.log("Deleted yesterday’s Firebase DB entry:", yesterdayStr);
    } catch (err) {
      console.log("No Firebase entry to delete or error:", err.message);
    }

    const unsplashKey = process.env.UNSPLASH_KEY;
    const response = await fetch(`https://api.unsplash.com/photos/random?query=quotes&count=50&orientation=portrait&client_id=${unsplashKey}`);
    const images = await response.json();

    // 4️⃣ Upload to Cloudinary and save URLs in Firebase
    const batchRef = db.ref(`daily_images/${todayStr}`);
    for (const img of images) {
      const imageId = uuidv4();
      const cloudRes = await cloudinary.v2.uploader.upload(img.urls.full, {
        folder: `daily_images/${todayStr}`,
        public_id: imageId
      });

      await batchRef.child(imageId).set({
        url: cloudRes.secure_url,
        author: img.user.name
      });

      console.log(`Uploaded image ${imageId}: ${cloudRes.secure_url}`);
    }

    console.log("All 40 images uploaded successfully for today:", todayStr);
  } catch (err) {
    console.error("Error in daily image workflow:", err);
  }
}

main();
