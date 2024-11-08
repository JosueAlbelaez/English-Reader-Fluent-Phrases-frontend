const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const { exec } = require('child_process');
require('dotenv').config();

const bookRoutes = require('./routes/book.routes');
const translationRoutes = require('./routes/translation.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/books', bookRoutes);
app.use('/api/translation', translationRoutes);

// Test route
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    message: 'Something went wrong!', 
    error: err.message
  });
});

// Función para matar el proceso que está usando un puerto específico (Windows)
const killProcessOnPort = (port) => {
  return new Promise((resolve, reject) => {
    exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
      if (error || !stdout) {
        console.log('No process found on port', port);
        resolve();
        return;
      }

      // Obtener el PID del proceso
      const lines = stdout.split('\n');
      const line = lines.find(l => l.includes(`LISTENING`));
      if (line) {
        const pid = line.trim().split(/\s+/).pop();
        // Matar el proceso
        exec(`taskkill /F /PID ${pid}`, (err) => {
          if (err) {
            console.log('Error killing process:', err);
            reject(err);
            return;
          }
          console.log(`Killed process ${pid} on port ${port}`);
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
};

// Connect to database and start server
const startServer = async () => {
  try {
    // Primero intentamos matar cualquier proceso en el puerto
    try {
      await killProcessOnPort(PORT);
      console.log(`Port ${PORT} has been freed`);
    } catch (err) {
      console.log('Could not kill process, but continuing...');
    }

    // Conectar a la base de datos
    await connectDB();

    // Intentar iniciar el servidor
    const server = app.listen(PORT, () => {
      console.log(`
========================================================
  Server is running successfully:
  - Port: ${PORT}
  - Environment: ${process.env.NODE_ENV || 'development'}
  - Database: Connected successfully
========================================================
      `);
    });

    // Manejar errores del servidor
    server.on('error', async (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is still in use. Please try a different port.`);
        process.exit(1);
      } else {
        console.error('Server error:', err);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Iniciar el servidor
startServer();

// Handle process termination
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Performing graceful shutdown...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT. Performing graceful shutdown...');
  process.exit(0);
});

module.exports = app;