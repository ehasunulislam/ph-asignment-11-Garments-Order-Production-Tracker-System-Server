const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// stripe import
const stripe = require("stripe")(process.env.STRIPE_SECRET);

/* form firebase path start */
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-admin-sdk.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
/* form firebase path end */

// middleware
app.use(cors());
app.use(express.json());

// custom middleware
const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if(!token) {
    return res.status(401).send({message: 'unauthorized access'});
  }

  try{
    const idToken = token.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    console.log("decoded in the token", decoded);
    req.decoded_email = decoded.email;
    next();
  }
  catch(err) {
    return res.status(401).send({message: 'unauthorized access'})
  }
};

/* mongoDB functionality start */
const uri = `mongodb+srv://${process.env.DV_USER}:${process.env.DB_PASS}@ic-cluster.qdhi4wp.mongodb.net/?appName=ic-cluster`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    /* collection start */
    const db = client.db("garmentsDB");
    const userCollection = db.collection("users");
    const productCollection = db.collection("products");
    const commentCollection = db.collection("comments");
    const cartCollection = db.collection("carts");
    const reviewCollection = db.collection("reviews");
    /* collection end */

    /* user APIs start */
    // get method for all-users
    app.get("/all-user", async (req, res) => {
      const cursor = userCollection.find().sort({ createdAt: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    // get method for user's email
    app.get("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const result = await userCollection.findOne({ email });

        if (!result) {
          return res.send({});
        }

        res.send(result);
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // get method for user's role
    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await userCollection.findOne(query);

      res.send({ role: result?.role || "user" });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const email = req.body.email;
      const query = { email: email };
      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exists" });
      } else {
        const result = await userCollection.insertOne(user);
        res.send(result);
      }
    });

    // put method for Approved User By Admin
    app.put("/approve-user/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        // Update status for "Approved"
        const updateDoc = {
          $set: { status: "Approved" },
        };

        const result = await userCollection.updateOne(query, updateDoc);

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "User approved successfully" });
        } else {
          res.send({
            success: false,
            message: "User not found or already approved",
          });
        }
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // put method for change user's role by admin
    app.put("/change-role/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const { role } = req.body;

        const updateDoc = {
          $set: { role: role },
        };

        const result = await userCollection.updateOne(query, updateDoc);

        if (result.modifiedCount > 0) {
          res.send({
            success: true,
            message: "User role updated successfully",
          });
        } else {
          res.send({ success: false, message: "Failed to update role" });
        }
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // put method for blocked user by admin
    app.put("/blocked-user/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: { status: "blocked" },
        };

        const result = await userCollection.updateOne(query, updateDoc);

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "User blocked successfully" });
        } else {
          res.send({ success: false, message: "Failed to block user" });
        }
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // put method for Un-blocked user by admin
    app.put("/unblocked-user/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: { status: "active" },
        };

        const result = await userCollection.updateOne(query, updateDoc);

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "User unblocked successfully" });
        } else {
          res.send({ success: false, message: "Failed to unblock user" });
        }
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // delete method for single user (for admin)
    app.delete("/delete-user/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await userCollection.deleteOne(query);
      res.send(result);
    });
    /* user APIs end */

    /* product APIs start  */
    // get method for latest-product
    app.get("/products", async (req, res) => {
      const cursor = productCollection.find().sort({ createdAt: -1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    // get method for all-products
    app.get("/all-products", async (req, res) => {
      const cursor = productCollection.find().sort({ createdAt: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    // get method for single product with id
    app.get("/all-products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.findOne(query);
      res.send(result);
    });

    // get method for single product with email for (sell-info)
    app.get("/selling-products/:email", async (req, res) => {
      try {
        const email = req.params.email;
        // console.log("Searching product for email:", email);

        const query = { createdBy: email }; // define the query
        const result = await productCollection.find(query).toArray();

        res.send(result);
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // post method for upload-product-from
    app.post("/products", async (req, res) => {
      try {
        const product = req.body;

        // Convert numbers
        product.price = Number(product.price);
        product.availableQuantity = Number(product.availableQuantity);
        product.minimumOrderQuantity = Number(product.minimumOrderQuantity);
        product.createdAt = new Date();

        const result = await productCollection.insertOne(product);
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // update method for single product
    app.put("/update-product/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const {
          productName,
          description,
          availableQuantity,
          minimumOrderQuantity,
          demoVideo,
        } = req.body;

        const updateDoc = {
          productName,
          description,
          availableQuantity: Number(availableQuantity),
          minimumOrderQuantity: Number(minimumOrderQuantity),
          demoVideo,
        };

        const result = await productCollection.updateOne(query, {
          $set: updateDoc,
        });

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "Product updated successfully" });
        } else {
          res.send({
            success: false,
            message: "No changes made or product not found",
          });
        }
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // delete method for single Product
    app.delete("/delete-product/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await productCollection.deleteOne(query);

        res.send(result);
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });
    /* product APIs end  */

    /* cart APIs start */
    // get method for single product with email
    app.get("/carts/:email", verifyFBToken, async (req, res) => {
      try {
        const email = req.params.email;

        if(req.params.email !== req.decoded_email) {
          return res.status(403).send({message: "forbidden access"})
        }

        const result = await cartCollection .find({ userEmail: email }) .toArray();
        res.send({ success: true, data: result });
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // get method for single product with id for payment
    app.get("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.findOne(query);
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      try {
        const { productId, productName, orderedQty, userEmail, paymentStatus } =
          req.body;

        // find products
        const product = await productCollection.findOne({
          _id: new ObjectId(productId),
        });
        if (!product)
          return res.status(404).send({ error: "Product not found" });

        // validation
        if (orderedQty < product.minimumOrderQuantity) {
          return res.status(400).send({
            error: `Minimum order quantity is ${product.minimumOrderQuantity}`,
          });
        }

        if (orderedQty > product.availableQuantity) {
          return res.status(400).send({ error: "Not enough stock available" });
        }

        // total price
        const totalPrice = orderedQty * product.price;

        // create order
        const order = {
          productId,
          productName,
          orderedQty,
          totalPrice,
          userEmail,
          paymentStatus,
          createdAt: new Date(),
        };
        const result = await cartCollection.insertOne(order);

        // update stock in the collections
        await productCollection.updateOne(
          { _id: new ObjectId(productId) },
          { $inc: { availableQuantity: -orderedQty } }
        );

        res.send({
          success: true,
          message: "Order placed successfully",
          order,
        });
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });
    /* cart APIs end */

    /* comment APIs start */
    app.get("/comments",  async (req, res) => {
      const cursor = commentCollection.find().sort({ createdAt: -1 });
      const result = await cursor.toArray();
      // console.log("headers", req.headers);
      res.send(result);
    });

    app.post("/comments", async (req, res) => {
      try {
        const commentsInfo = req.body;
        const result = await commentCollection.insertOne(commentsInfo);
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });
    /* comment APIs end */

    /* payment related APIs start */
    app.post("/create-checkout-session", async (req, res) => {
      try {
        const { cartId, productName, totalPrice, userEmail } = req.body;

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: totalPrice * 100,
                product_data: {
                  name: productName,
                },
              },
              quantity: 1,
            },
          ],
          customer_email: userEmail,
          mode: "payment",
          success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?cartId=${cartId}`,
          cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
        });

        res.send({ url: session.url });
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    // after payment pay status should changes by paid
    app.patch("/carts/payment-success/:id", async (req, res) => {
      const id = req.params.id;
      const result = await cartCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { paymentStatus: "paid" } }
      );
      res.send(result);
    });
    /* payment related APIs end */

    /* review related APIs start */
    app.get("/reviews", async (req, res) => {
      const cursor = reviewCollection.find().sort({date: -1});
      const result = await cursor.toArray();
      res.send(result);
    });
    /* review related APIs end */

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
/* mongoDB functionality end */

app.get("/", (req, res) => {
  res.send("Garments");
});

app.listen(port, () => {
  console.log(`Server is running on port http://localhost:${port}`);
});
