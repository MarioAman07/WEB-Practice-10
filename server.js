const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = 3000;

const url = 'mongodb://127.0.0.1:27017';
const client = new MongoClient(url);
const dbName = 'shop';
let db, productsCollection;

app.use(express.json());

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

async function connectDB() {
    try {
        await client.connect();
        console.log('Connected successfully to MongoDB');
        db = client.db(dbName);
        productsCollection = db.collection('products');
    } catch (err) {
        console.error('MongoDB connection error:', err);
    }
}

app.get('/api/products', async (req, res) => {
    try {
        const { category, minPrice, sort, fields } = req.query;
        
        let query = {};
        if (category) {
            query.category = category;
        }
        if (minPrice) {
            query.price = { $gte: parseFloat(minPrice) };
        }

        let sortOptions = {};
        if (sort === 'price') {
            sortOptions.price = 1;
        }

        let projection = {};
        if (fields) {
            const fieldsArray = fields.split(',');
            fieldsArray.forEach(field => {
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

app.post('/api/products', async (req, res) => {
    const { name, price, category } = req.body;
    if (!name || !price || !category) return res.status(400).json({ error: "Missing required fields" });

    try {
        const newProduct = { name, price: parseFloat(price), category };
        const result = await productsCollection.insertOne(newProduct);
        res.status(201).json({ message: "Product created", productId: result.insertedId });
    } catch (err) {
        res.status(500).json({ error: "Could not create product" });
    }
});

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
});