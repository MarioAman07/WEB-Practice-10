require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;
const url = process.env.MONGO_URI;
const dbName = 'shop';
let db, itemsCollection;

const client = new MongoClient(url);

app.use(express.json());

// Database Connection
async function connectDB() {
    try {
        await client.connect();
        console.log('Connected to MongoDB Atlas');
        db = client.db(dbName);
        itemsCollection = db.collection('items'); // Как требует задание 13
    } catch (err) {
        console.error('Connection error:', err);
        process.exit(1);
    }
}

// --- REST API ENDPOINTS ---

// 1. GET ALL ITEMS
app.get('/api/products', async (req, res) => {
    try {
        const items = await itemsCollection.find({}).toArray();
        res.status(200).json(items);
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 2. POST (CREATE)
app.post('/api/products', async (req, res) => {
    try {
        const { name, price, category } = req.body;
        if (!name || !price) return res.status(400).json({ error: "Name and price are required" });

        const newItem = { name, price: parseFloat(price), category: category || "general" };
        const result = await itemsCollection.insertOne(newItem);
        res.status(201).json({ _id: result.insertedId, ...newItem });
    } catch (err) {
        res.status(500).json({ error: "Could not create item" });
    }
});

// 3. PUT (FULL UPDATE) - Заменяет объект целиком
app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, category } = req.body;
        
        if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });
        if (!name || !price || !category) return res.status(400).json({ error: "All fields are required for PUT" });

        const result = await itemsCollection.replaceOne(
            { _id: new ObjectId(id) },
            { name, price: parseFloat(price), category }
        );

        if (result.matchedCount === 0) return res.status(404).json({ error: "Item not found" });
        res.status(200).json({ message: "Item updated (PUT)" });
    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }
});

// 4. PATCH (PARTIAL UPDATE) - Обновляет только присланные поля
app.patch('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });

        const result = await itemsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: req.body }
        );

        if (result.matchedCount === 0) return res.status(404).json({ error: "Item not found" });
        res.status(200).json({ message: "Item patched (PATCH)" });
    } catch (err) {
        res.status(500).json({ error: "Patch failed" });
    }
});

// 5. DELETE
app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid ID" });

        const result = await itemsCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) return res.status(404).json({ error: "Item not found" });

        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

connectDB().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});