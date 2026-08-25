const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const globalRouter = require('./routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api', globalRouter);

// PORT
const PORT = process.env.PORT || 3001;

// Sincronización de Base de Datos y Arranque del Servidor
sequelize.sync() // Mantiene tus tablas actualizadas sin borrar los usuarios que creamos
  .then(() => {
    console.log('✔ Base de datos conectada y sincronizada con éxito.');
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ Error al conectar o sincronizar la base de datos:', error);
  });