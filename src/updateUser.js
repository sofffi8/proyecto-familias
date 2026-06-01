const User = require('./models/user.model'); // Asegurate que la ruta al modelo sea correcta

async function updateUsername() {
  try {
    // Buscamos al usuario que se llama "luciana"
    const usuario = await User.findOne({ where: { username: 'luciana' } });

    if (usuario) {
      // Le cambiamos el nombre a "local"
      usuario.username = 'local';
      await usuario.save();
      console.log('¡Éxito! El nombre cambió de Luciana a Local.');
    } else {
      console.log('No se encontró ningún usuario con el nombre Luciana.');
    }
  } catch (error) {
    console.error('Hubo un error al cambiar el nombre:', error);
  }
}

updateUsername();