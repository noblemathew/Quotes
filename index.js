import fetch from "node-fetch";
import cloudinary from "cloudinary";
import admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";

// Initialize Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://quotes-5fa17-default-rtdb.firebaseio.com"
});
const db = admin.database();

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function fetchAndUploadImages() {
  const accessKey = process.env.UNSPLASH_KEY;
  const res = await fetch(`https://api.unsplash.com/photos/random?query=motivational,quotes&count=50&orientation=portrait&client_id=${accessKey}`);
  const images = await res.json();

  const today = new Date().toISOString().split("T")[0];
  const dbRef = db.ref(`daily_images/${today}`);

  for (const img of images) {
    const imageResponse = await fetch(img.urls.full);
    const buffer = await imageResponse.arrayBuffer();
    
    // Upload to Cloudinary
    await new Promise((resolve, reject) => {
      cloudinary.v2.uploader.upload_stream(
        { folder: `daily_images/${today}`, public_id: uuidv4() },
        async (error, result) => {
          if (error) return reject(error);
          // Save URL in Firebase
          await dbRef.push({
            url: result.secure_url,
            author: img.user.name
          });
          console.log("Uploaded:", result.secure_url);
          resolve();
        }
      ).end(Buffer.from(buffer));
    });
  }
  console.log("All 50 images uploaded successfully!");
}

fetchAndUploadImages();
