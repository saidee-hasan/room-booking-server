const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const cookie = require('cookie-parser');
app.use(express.json());
app.use(cookie())
app.use(cors());
require("dotenv").config();

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@hotel.q9chu.mongodb.net/?retryWrites=true&w=majority&appName=Hotel`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const roomsCollection = client.db("hotel").collection("rooms");
    const ApplyCollection = client.db("hotel").collection("apply");
    const reviewCollection = client.db("hotel").collection("review");

 
app.post('/jwt',async(req,res)=>{

  const user = req.body;
  const token = jwt.sign(user , process.env.JWT_SECRET ,{expiresIn:'1h'})
  res.cookie('token',token,{
    httOnly : true,
    secure:false,

  })
  .send({success:true})
})


    app.post("/apply", async (req, res) => {
      const newApply = req.body;
      const query = { email: newApply.email, booking_id: newApply.booking_id };
      try {
        const existingEntry = await ApplyCollection.findOne(query);
        console.log(existingEntry);
        if (existingEntry) {
          // If it exists, return a message or update the existing entry
          return res.status(400).send({ message: "Entry already exists." });
        }

        // If it does not exist, insert the new entry
        const result = await ApplyCollection.insertOne(newApply);

        // Update the room count
        const filter = { _id: new ObjectId(newApply.booking_id) };
        const update = { $inc: { room_count: 1 } };
        await roomsCollection.updateOne(filter, update);

        // Send the result of the insert operation back to the client
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/review", async (req, res) => {
      const roomId = req.query.roomId;

      let query = {};
      if (roomId) {
        query = {
          roomId: roomId,
        };
      }

      const cursor = reviewCollection.find(query).sort({ timestamp: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/review", async (req, res) => {
      const newReview = req.body;
      newReview.timestamp = new Date();
      const result = await reviewCollection.insertOne(newReview);
      res.send(result);
    });

    app.put("/apply/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDate = req.body;

      console.log(updateDate, id);
      const date = {
        $set: {
          selectedDate: updateDate.selectedDate,
        },
      };

      try {
        const result = await ApplyCollection.updateOne(query, date, {
          upsert: true,
        });
        res.send(result);
      } catch (error) {
        console.error("Error updating coffee:", error);
        res.status(500).send("Error updating coffee");
      }
    });

    app.delete("/apply/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      console.log(query);
      const result = await ApplyCollection.deleteOne(query);
      console.log(result);
      res.send(result);
    });

    app.get("/apply", async (req, res) => {
      const id = req.query.booking_id;

      let query = {};
      if (id) {
        query = {
          booking_id: id,
        };
      }

      const result = await ApplyCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/rooms", async (req, res) => {
      const email = req.query.email;
      const { minPrice, maxPrice } = req.query;

      let query = {};

      if (minPrice) query.price = { $gte: Number(minPrice) };

      if (maxPrice) {
        query.price = query.price
          ? { ...query.price, $lte: Number(maxPrice) }
          : { $lte: Number(maxPrice) };
      }

      if (email) {
        query.email = email;
      }

      try {
        const rooms = await roomsCollection.find(query).toArray();
        res.json(rooms); // Send the rooms as response
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch rooms" });
      }
    });
    app.get("/rooms/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await roomsCollection.findOne(query);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running ");
});

app.listen(port, () => {
  console.log(`Room is Counting ${port}`);
});
