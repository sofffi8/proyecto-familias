const User = require('../models/user.model');

// Controlador para registrar un nuevo compañero
const register = async (req, res) => {
  try {
    const { username, password, role } = req.body;

    // Validamos si el usuario ya existe
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ message: 'El nombre de usuario ya está en uso.' });
    }

    // Creamos el nuevo usuario (Por ahora guardamos la contraseña plana, después le metemos seguridad)
    const newUser = await User.create({ username, password, role });

    res.status(201).json({ message: 'Usuario registrado con éxito', user: newUser });
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar el usuario', error });
  }
};

// Controlador para iniciar sesión
const login = async (req, res) => {
  res.send('Aquí irá la lógica del login más adelante');
};

module.exports = {
  register,
  login
};