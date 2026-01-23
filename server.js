require('dotenv').config(); // 1. Load environment variables from .env (must be the first line)
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();

// 2. Use system PORT for deployment or 3000 for local development
const PORT = process.env.PORT || 3000;

// 3. Get connection string from environment variable (no hardcoded secrets!)
const url = process.env.MONGO_URI; 
const dbName = 'api';
let db, productsCollection;

// Create client instance once
const client = new MongoClient(url);

app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Database connection function
async function connectDB() {
    try {
        if (!url) {
            throw new Error("CRITICAL ERROR: MONGO_URI is not defined in .env");
        }
        await client.connect();
        console.log('Connected successfully to MongoDB');
        db = client.db(dbName);
        productsCollection = db.collection('products');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1); // Terminate process if DB connection fails
    }
}

// --- ROUTES ---

// GET /api/products - Get all products with filtering, sorting, and projection
app.get('/api/products', async (req, res) => {
    try {
        const { category, minPrice, sort, fields } = req.query;
        
        let query = {};
        if (category) query.category = category;
        if (minPrice) query.price = { $gte: parseFloat(minPrice) };

        let sortOptions = {};
        if (sort === 'price') sortOptions.price = 1;

        let projection = {};
        if (fields) {
            fields.split(',').forEach(field => {
                projection[field.trim()] = 1;
            });
        }

        const products = await productsCollection
            .find(query)
            .project(projection)
            .sort(sortOptions)
            .toArray();

        res.json({
            count: products.length,
            products: products
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// GET /api/products/:id - Get a single product by ID
app.get('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID format" });

    try {
        const product = await productsCollection.findOne({ _id: new ObjectId(id) });
        if (!product) return res.status(404).json({ error: "Product not found" });
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// POST /api/products - Add a new product
app.post('/api/products', async (req, res) => {
    const { name, price, category } = req.body;
    if (!name || !price || !category) {
        return res.status(400).json({ error: "Missing required fields (name, price, category)" });
    }

    try {
        const newProduct = { name, price: parseFloat(price), category };
        const result = await productsCollection.insertOne(newProduct);
        res.status(201).json({ message: "Product created", productId: result.insertedId });
    } catch (err) {
        res.status(500).json({ error: "Could not create product" });
    }
});

app.get('/', (req, res) => {
    res.send('API is running. Go to /api/products to see data.');
});

// Connect to DB first, then start the server
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});