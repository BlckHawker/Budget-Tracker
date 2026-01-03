import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI

if(!uri) {
    throw new Error("Please add your Mongo URI to the .env file");
}

const client = new MongoClient(uri);
const clientPromise = client.connect()

//export client promise
export default clientPromise