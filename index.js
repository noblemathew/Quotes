import fetch from "node-fetch";
import cloudinary from "cloudinary";
import admin from "firebase-admin";

// 🔑 Load secrets from environment variables
const UNSPLASH_KEY = process.env.UNSPLASH_KEY;
const CLOUDINARY_URL = process.env.CLOUDINARY_URL;
const FIREBASE_KEY = JSON.parse(process.env.FIREBASE_KEY);

// ✅ Cloudinary setup
cloudinary.v2.config({
  cloud_name: CLOUDINARY_URL.split("@")[1],
  api_key: CLOUDINARY_URL.split("//")[1].split(":")[0],
  api_secret: CLOUDINARY_URL.split(":")[2].split("@")[0]
});

// ✅ Firebase setup
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(FIREBASE_KEY),
    databaseURL: "https://quotes-app-india-default-rtdb.firebaseio.com/"
  });
}
const db = admin.database();

async function fetchImages() {
  try {
    console.log("📸 Fetching 30 Unsplash motivational images...");

    const response = await fetch(
      `https://api.unsplash.com/photos/random?query=motivational,inspiration,success,nature&count=30&orientation=portrait&client_id=${UNSPLASH_KEY}`,
      { timeout: 20000 } // 20s timeout
    );

    if (!response.ok) throw new Error(`Unsplash error: ${response.status}`);
    const images = await response.json();

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const ref = db.ref(`daily_images/${today}`);

    // Clear old entries first
    await ref.remove();

    console.log("☁️ Uploading to Cloudinary in parallel...");
    const uploads = images.map(img =>
      cloudinary.v2.uploader.upload(img.urls.regular, {
        folder: "daily_quotes",
        transformation: [{ aspect_ratio: "9:16", crop: "fill" }]
      })
    );

    const results = await Promise.all(uploads);

    // Save URLs to Firebase
    const updates = {};
    results.forEach((res, i) => {
      updates[`img${i}`] = { url: res.secure_url };
    });

    await ref.update(updates);

    console.log(`✅ Uploaded & saved ${results.length} images for ${today}`);
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    // Close Firebase & exit cleanly
    db.goOffline();
    process.exit(0);
  }
}

fetchImages();
