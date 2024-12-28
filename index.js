const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
app.use(express.json());
app.use(cookieParser())
app.use(cors( {
  origin: ['http://localhost:5173','https://rooms-booking.netlify.app'],
  credentials: true // Allow credentials (cookies, authorization headers, etc.)
}));
require("dotenv").config();


const verifyToken = (req,res,next)=>{
 const token = req?.cookies?.token;
 if(!token){
  return res.status(401).send({massage:'Unauthorized access'})
 }
// verify token
jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
  if(err){
    return res.status(401).send({massage:'Unauthorized access'})
   }
   req.user= decoded
   next()
})



 

}





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
  const token = jwt.sign(user , process.env.ACCESS_TOKEN_SECRET ,{expiresIn:'5h'})
  res.cookie('token',token,{
    httOnly : true,
    secure:process.env.NODE_ENV === 'production',
    sameSite:process.env.NODE_ENV === 'production' ? 'none': "strict",

  })
  .send({success:true})
})

app.post('/logout',async(req,res)=>{
  res.cookie('token',{
    httOnly : true,
    secure:process.env.NODE_ENV === 'production',
    sameSite:process.env.NODE_ENV === 'production' ? 'none': "strict",

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
      console.log('cuk ck toto',req.cookies)
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

    app.get("/apply",verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      if(req.user.email !== email){
        return res.status(403).send({ message: 'Forbidden access' });
      }
 
      const cursor = ApplyCollection.find(query);
     const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/appl", async (req, res) => {
      try {
        // Extract query parameters
        const { roomId, email, booking_id } = req.query;
    
        // Create a query object
        const query = {};
        
        // Add filters based on provided query parameters
        if (roomId) {
          query.roomId = roomId; // Filter by roomId
        }
        if (email) {
          query.email = email; // Filter by email
        }
        if (booking_id) {
          query.booking_id = booking_id; // Filter by booking_id
        }
    
        // Execute the query
        const cursor = ApplyCollection.find(query);
        const result = await cursor.toArray();
    
        // Check if any results were found
        if (result.length === 0) {
          return res.status(404).send({ message: "No bookings found matching the criteria" });
        }
    
        // Send the result back to the client
        res.status(200).send(result);
      } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).send({ error: "An error occurred while fetching bookings" });
      }
    });



    app.get("/rooms",  async (req, res) => {
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
