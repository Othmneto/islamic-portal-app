// list_hadith_collections.js
const { MongoClient } = require("mongodb");

// Replace with your MongoDB URI
const MONGO_URI = "mongodb+srv://ahmedothmanofff:1WRxGoQyvSHSRJqK@cluster0.loizc98.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DB_NAME = "translator"; // Try "translator" first, or whatever your main DB is called


async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  // Print all unique hadith collection names
  const collections = await db.collection("hadiths").distinct("collection_name");
  console.log("Available Hadith Collections:");
  collections.forEach((c) => console.log("-", c));

  await client.close();
}

main().catch(console.error);
