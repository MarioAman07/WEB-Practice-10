require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;
const url = process.env.MONGO_URI;
const dbName = 'api'; 
let db, itemsCollection;

const client = new MongoClient(url);

app.use(express.json());

// База данных
async function connectDB() {
    try {
        await client.connect();
        console.log('Connected to MongoDB Atlas');
        db = client.db(dbName);
        itemsCollection = db.collection('products'); 
    } catch (err) {
        console.error('Connection error:', err);
        process.exit(1);
    }
}

// 1. Механизм защиты (Задание 14): API Key в заголовках 
const API_KEY = process.env.API_KEY || "my-secret-key-123";

const authMiddleware = (req, res, next) => {
    const userApiKey = req.headers['x-api-key'];

    if (!userApiKey || userApiKey !== API_KEY) {
        // Если ключ неверный, возвращаем 401 Unauthorized 
        return res.status(401).json({ error: "Unauthorized: Invalid or missing API Key" });
    }
    next();
};

// Welcome Page Route
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>API Service | Active</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f4f7f6; color: #333; }
                .container { text-align: center; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                h1 { color: #4a90e2; margin-bottom: 0.5rem; }
                p { font-size: 1.1rem; color: #666; }
                .status-badge { display: inline-block; padding: 5px 12px; background: #2ecc71; color: white; border-radius: 20px; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; }
                .host-info { margin-top: 20px; font-size: 0.9rem; color: #999; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="status-badge">System Live</div>
                <h1>Welcome to the Product API</h1>
                <p>The RESTful service is running smoothly.</p>
                <div class="host-info">
                    Powered by <strong>Node.js</strong> & <strong>MongoDB Atlas</strong><br>
                    Deployed and running on <strong>Render Cloud</strong>
                </div>
            </div>
        </body>
        </html>
    `);
});
// --- REST API ENDPOINTS ---

// GET (Публичные эндпоинты)
app.get('/api/products', async (req, res) => {
    try {
        const items = await itemsCollection.find({}).toArray();
        res.status(200).json(items);
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });

        const item = await itemsCollection.findOne({ _id: new ObjectId(id) });
        if (!item) return res.status(404).json({ error: "Product not found" });

        res.status(200).json(item);
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Защищенные эндпоинты (используют authMiddleware) 

// POST - Создание
app.post('/api/products', authMiddleware, async (req, res) => {
    try {
        const { name, price, category } = req.body;
        if (!name || price === undefined) {
            return res.status(400).json({ error: "Name and price are required" });
        }

        const newItem = { 
            name, 
            price: parseFloat(price), 
            category: category || "general" 
        };
        
        const result = await itemsCollection.insertOne(newItem);
        res.status(201).json({ _id: result.insertedId, ...newItem });
    } catch (err) {
        res.status(500).json({ error: "Could not create product" });
    }
});

// PUT - Полное обновление
app.put('/api/products/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, category } = req.body;
        
        if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });
        if (!name || price === undefined || !category) {
            return res.status(400).json({ error: "All fields are required for PUT" });
        }

        const result = await itemsCollection.replaceOne(
            { _id: new ObjectId(id) },
            { name, price: parseFloat(price), category }
        );

        if (result.matchedCount === 0) return res.status(404).json({ error: "Product not found" });
        res.status(200).json({ message: "Product updated (PUT)" });
    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }
});

// PATCH - Частичное обновление
app.patch('/api/products/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });

        const updateData = { ...req.body };
        delete updateData._id;

        const result = await itemsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData } 
        );

        if (result.matchedCount === 0) return res.status(404).json({ error: "Product not found" });
        res.status(200).json({ message: "Product patched (PATCH)" });
    } catch (err) {
        res.status(500).json({ error: "Patch failed", details: err.message });
    }
});

// DELETE - Удаление
app.delete('/api/products/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });

        const result = await itemsCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) return res.status(404).json({ error: "Product not found" });

        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

connectDB().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});