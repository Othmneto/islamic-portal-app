const { MongoClient } = require("mongodb");

const MONGO_URI = "mongodb+srv://ahmedothmanofff:1WRxGoQyvSHSRJqK@cluster0.loizc98.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DB_NAME = "translator";

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  // Print all hadiths (should see your 2 hadiths)
  const hadiths = await db.collection("hadiths").find().toArray();
  console.log("Hadiths in DB:", hadiths);

  // Show collections in DB
  const collections = await db.listCollections().toArray();
  console.log("Collections in this DB:", collections.map(c => c.name));

  await client.close();
}

main().catch(console.error);
