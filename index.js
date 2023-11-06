const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// MongoDB:-
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dhwvmob.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
// middlewares to validate token
const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  // if no token
  if (!token) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized Access" });
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const Collection = client.db("RHRDB");
    const roomCollection = Collection.collection("Room");
    const reviewCollection = Collection.collection("Reviews");

    // set cookie with jwt
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    // remove cookie
    app.post("/logout", async (req, res) => {
      const user = req.body;
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });
    // Load all available Rooms
    app.get("/room", async (req, res) => {
      const query = { status: "Available" };
      const result = await roomCollection.find(query).toArray();
      res.send(result);
    });
    // Load all booked Rooms
    app.get("/booked", verifyToken, async (req, res) => {
      const query = { status: "Booked" };
      const result = await roomCollection.find(query).toArray();
      res.send(result);
    });
    // Update the check in date
    app.patch("/booked/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const date = req.body.date;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDate = {
        $set: {
          date: date,
        },
      };
      const result = await roomCollection.updateOne(
        filter,
        updateDate,
        options
      );
      res.send(result);
    });

    // Cancel or change status to available
    app.put("/booked/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateStatus = {
        $set: {
          status: "Available",
        },
      };
      const result = await roomCollection.updateOne(
        filter,
        updateStatus,
        options
      );
      res.send(result);
    });

    // Sort the rooms via price
    app.get("/room/:sort", async (req, res) => {
      const sort = req.params.sort;
      const query = { status: "Available" };
      const result = await roomCollection
        .find(query)
        .sort((sort === "asc" && { price: 1 }) || { price: -1 })
        .toArray();
      res.send(result);
    });
    // filter data by id to show details page
    app.get("/room/details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await roomCollection.findOne(query);
      res.send(result);
    });
    // change status to booked
    app.patch("/room/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const date = req.body.date;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateStatus = {
        $set: {
          status: "Booked",
          date: date,
        },
      };
      const result = await roomCollection.updateOne(
        filter,
        updateStatus,
        options
      );
      res.send(result);
    });
    // store the review
    app.post("/review", async (req, res) => {
      const num = req.body.num;
      const rating = req.body.rating;
      const comment = req.body.comment;
      const created = new Date();
      const review = { num, rating, comment, created };
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });
    // Load review
    app.get("/review/:num", async (req, res) => {
      const num = req.params.num;
      console.log(typeof num);
      const query = { num: parseInt(num) };
      const result = await reviewCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("RHR-Hotel is running");
});

app.listen(port, () => {
  console.log(`RHR Hotel is running on ${port}`);
});
