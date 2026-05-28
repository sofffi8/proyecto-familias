const { Router } = require('express');
const router = Router();
const User = require('../models/user.model');

// Importamos los archivos de rutas
const authRoutes = require('./auth.routes');
const familyRoutes = require('./family.routes'); 
const deliveryRoutes = require('./delivery.routes'); // <-- NUEVA LÍNEA

// Vinculamos los caminos
router.use('/auth', authRoutes);
router.use('/families', familyRoutes); 
router.use('/deliveries', deliveryRoutes); // <-- NUEVA LÍNEA (quedará bajo /api/deliveries)

// Ruta de usuarios que ya tenías
router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({ attributes: ['id', 'username'] });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
});

module.exports = router;