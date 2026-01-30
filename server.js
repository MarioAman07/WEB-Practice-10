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