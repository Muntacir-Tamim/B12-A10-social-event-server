const express = require("express");
const cors = require("cors");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const admin = require("firebase-admin");
const serviceAccount = require("./serviceKey.json");

const app = express();
const port = 3000;
app.use(cors());
app.use(express.json());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.vhnksmf.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({
      message: "unauthorized access. Token not found!",
    });
  }

  const token = authorization.split(" ")[1];
  try {
    await admin.auth().verifyIdToken(token);

    next();
  } catch (error) {
    res.status(401).send({
      message: "unauthorized access.",
    });
  }
};

async function run() {
  try {
    const db = client.db("socialDB");
    const eventsCollection = db.collection("events");
    const joinedCollection = db.collection("joinedEvents");

    /* =========================
       GET ALL UPCOMING EVENTS
    ========================== */
    app.get("/events", async (req, res) => {
      const result = await eventsCollection.find().toArray();
      res.send(result);
    });

    /* =========================
       GET ALL UPCOMING EVENTS FOR SEARCH
    ========================== */

    app.get("/search", async (req, res) => {
      const search_text = req.query.search;
      const result = await eventsCollection
        .find({
          title: { $regex: search_text, $options: "i" },
        })
        .toArray();
      res.send(result);
    });

    /* =========================
       GET SINGLE EVENT
    ========================== */
    app.get("/events/:id", async (req, res) => {
      const id = req.params.id;
      const result = await eventsCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    /* =========================
           CREATE EVENT
        ========================== */
    app.post("/events", verifyToken, async (req, res) => {
      const event = req.body;
      event.date = new Date(event.date);
      event.createdAt = new Date();
      const result = await eventsCollection.insertOne(event);
      res.send(result);
    });

    // app.post("/events", async (req, res) => {
    //   const event = req.body;
    //   event.date = new Date(event.date);
    //   const result = await eventsCollection.insertOne(event);
    //   res.send(result);
    // });

    /* =========================
           GET EVENTS CREATED BY USER
        ========================== */
    app.get("/my-events/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await eventsCollection
        .find({ creatorEmail: email })
        .toArray();
      res.send(result);
    });

    /* =========================
           GET SINGLE EVENT
        ========================== */

    app.get("/event/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      const result = await eventsCollection.findOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    /* =========================
           UPDATE EVENT (OWNER ONLY)
        ========================== */
    app.put("/update-event/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;

      const result = await eventsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData }
      );

      await joinedCollection.updateMany(
        { eventId: id },
        {
          $set: {
            eventTitle: updatedData.title,
            eventDate: updatedData.date,
            image: updatedData.image,
          },
        }
      );

      res.send(result);
    });

    /* =========================
           DELETE EVENT (OPTIONAL)
        ========================== */
    // app.delete("/events/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const result = await eventsCollection.deleteOne({
    //     _id: new ObjectId(id),
    //   });
    //   res.send(result);
    // });

    /* =========================
       JOIN EVENT (NO DUPLICATE)
    ========================== */

    app.post("/join", verifyToken, async (req, res) => {
      const { eventId, userEmail } = req.body;

      const exists = await joinedCollection.findOne({ eventId, userEmail });

      if (exists) {
        return res.send({
          success: false,
          message: "You have already joined this event",
        });
      }

      const result = await joinedCollection.insertOne(req.body);

      if (result.insertedId) {
        res.send({ success: true, message: "Joined event successfully" });
      }
    });

    /* =========================
           GET JOINED EVENTS (USER)
           SORTED BY DATE
        ========================== */
    app.get("/joined", verifyToken, async (req, res) => {
      const email = req.query.email;

      const result = await joinedCollection
        .find({ userEmail: email })
        .sort({
          eventDate: 1,
        })
        .toArray();

      res.send(result);
    });

    //await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);
// root
app.get("/", (req, res) => {
  res.send("Social Development Events Server Running");
});

app.listen(port, () => {
  console.log(` Server running on port ${port}`);
});
