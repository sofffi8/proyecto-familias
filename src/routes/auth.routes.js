const { Router } = require('express');
const router = Router();
const User = require('../models/user.model'); // Traemos el modelo de usuario

// Ruta para registrar un nuevo compañero
router.post('/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    // Validamos si el usuario ya existe en la base de datos
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ message: 'El nombre de usuario ya está en uso.' });
    }

    // Creamos el nuevo usuario
    const newUser = await User.create({ username, password, role });

    res.status(201).json({ message: 'Usuario registrado con éxito', user: newUser });
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar el usuario', error });
  }
});

// Ruta para iniciar sesión (la completamos más adelante)
router.post('/login', (req, res) => {
  res.send('Aquí irá la lógica del login más adelante');
});

module.exports = router;