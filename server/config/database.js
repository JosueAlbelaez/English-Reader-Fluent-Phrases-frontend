const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI,  {
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
      }
    });

    console.log('MongoDB Connected Successfully');
    console.log('Database:', conn.connection.db.databaseName);
    
    // Verificar las colecciones
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections available:', collections.map(c => c.name));

    return conn;
  } catch (error) {
    console.error('MongoDB Connection Error:', error);
    throw error;
  }
};

module.exports = connectDB;