import fetch from "node-fetch";
import cloudinary from "cloudinary";
import admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";

// 1️⃣ Initialize Firebase
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("❌ FIREBASE_SERVICE_ACCOUNT is missing");
  process.exit(1);
}
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
});
const db = admin.database();

// 2️⃣ Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function main() {
  try {
    // 🗓️ Dates
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0]; // e.g. "2025-09-20"
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // 3️⃣ Delete yesterday’s Cloudinary folder
    try {
      await cloudinary.v2.api.delete_resources_by_prefix(`daily_images/${yesterdayStr}/`);
      await cloudinary.v2.api.delete_folder(`daily_images/${yesterdayStr}`);
      console.log("✅ Deleted yesterday’s Cloudinary folder:", yesterdayStr);
    } catch (err) {
      console.log("⚠️ No Cloudinary folder to delete:", err.message);
    }

    // 4️⃣ Delete yesterday’s Firebase DB entry
    try {
      await db.ref(`daily_images/${yesterdayStr}`).remove();
      console.log("✅ Deleted yesterday’s Firebase DB entry:", yesterdayStr);
    } catch (err) {
      console.log("⚠️ No Firebase entry to delete:", err.message);
    }

    // 5️⃣ Fetch 50 motivational portrait images from Unsplash
    const unsplashKey = process.env.UNSPLASH_KEY;
    const query = "motivational,inspiration,success,nature";
    const response = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&count=50&orientation=portrait&client_id=${unsplashKey}`
    );
    const images = await response.json();

    if (!Array.isArray(images)) {
      console.error("❌ Unexpected Unsplash response:", images);
      process.exit(1);
    }

    // 6️⃣ Upload to Cloudinary + Save in Firebase
    const batchRef = db.ref(`daily_images/${todayStr}`);
    for (const img of images) {
      try {
        const imageId = uuidv4();
        const cloudRes = await cloudinary.v2.uploader.upload(img.urls.full, {
          folder: `daily_images/${todayStr}`,
          public_id: imageId
        });

        await batchRef.child(imageId).set({
          url: cloudRes.secure_url,
          author: img.user?.name || "Unknown"
        });

        console.log(`✅ Uploaded ${imageId}: ${cloudRes.secure_url}`);
      } catch (err) {
        console.error("❌ Upload failed for one image:", err.message);
      }
    }

    console.log(`🎉 All images uploaded successfully for ${todayStr}`);
  } catch (err) {
    console.error("💥 Error in daily workflow:", err);
  }
}

main();
